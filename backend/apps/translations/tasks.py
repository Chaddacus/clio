"""Celery task that fills a NoteTranslation row.

The row is created by the API in 'pending' state; this task runs the provider,
validates the output against the contract, and writes either 'completed' with
text + aligned segments or 'failed' with a user-safe message. It never touches
VoiceNote.transcription or the TranscriptionSegment rows.

Retry policy: only transient provider failures (rate limit, 5xx, connection)
are retried, and the row stays 'pending' while a retry is scheduled so the UI
keeps polling. Configuration errors, refusals, truncation, and contract
violations fail immediately; a retry would repeat the same outcome at cost.

Invalidation race: the transcript can change while the provider call is in
flight, which deletes the row. Every write here is a conditional UPDATE on the
row's pk; zero rows affected means the result is for a transcript that no
longer exists and is discarded. A plain save() would re-insert the stale row.
"""
import logging
import time

from celery import shared_task

from apps.core.middleware import set_request_id

from .models import NoteTranslation
from .services import get_translation_provider, join_units, units_from_note, validate_units

logger = logging.getLogger(__name__)

USER_ERROR = "Translation failed. Please try again."
RETRY_DELAY_SECONDS = 15


@shared_task(bind=True, max_retries=2)
def translate_voice_note_task(self, translation_id: int, trace_id: str = '') -> None:
    set_request_id(trace_id)
    started = time.monotonic()
    try:
        translation = NoteTranslation.objects.select_related('voice_note').get(id=translation_id)
    except NoteTranslation.DoesNotExist:
        logger.error("Translation %d not found", translation_id)
        return

    note = translation.voice_note
    units, source_language = units_from_note(note)
    if not units:
        _fail(translation, "Nothing to translate yet.", log="note has no transcript")
        return

    try:
        provider = get_translation_provider()
        result = provider.translate(units, source_language, translation.target_language)
    except Exception as exc:
        # Configuration or programming error. Log the type only: provider
        # exceptions can embed request or response content.
        logger.error("Translation task error for %d: %s", translation_id, type(exc).__name__)
        _fail(translation, USER_ERROR, log=type(exc).__name__)
        return

    provenance = {
        'provider': result.provider,
        'model': result.model,
        'prompt_version': result.prompt_version,
        'input_tokens': result.input_tokens,
        'output_tokens': result.output_tokens,
        'source_language': source_language,
    }

    if not result.success:
        if result.retryable and self.request.retries < self.max_retries:
            if not _write(translation, **provenance):
                return
            logger.warning(
                "Translation %d transient failure (%s); retry %d/%d in %ds",
                translation.id, result.error, self.request.retries + 1, self.max_retries, RETRY_DELAY_SECONDS,
            )
            raise self.retry(countdown=RETRY_DELAY_SECONDS)
        _fail(translation, USER_ERROR, log=result.error, **provenance)
        return

    contract_error = validate_units(units, result.units)
    if contract_error:
        _fail(translation, USER_ERROR, log=f"contract violation: {contract_error}", **provenance)
        return

    segments = (
        [] if (len(units) == 1 and units[0].id == 0)
        else [{'segment_id': u['id'], 'text': u['text']} for u in result.units]
    )
    if _write(translation, status='completed', error_message='', text=join_units(result.units),
              segments=segments, **provenance):
        logger.info(
            "Translation %d completed: note=%d target=%s units=%d elapsed_ms=%d",
            translation.id, note.id, translation.target_language, len(units),
            int((time.monotonic() - started) * 1000),
        )


def _write(translation: NoteTranslation, **fields) -> bool:
    """Conditional UPDATE of the row. False means it was invalidated meanwhile."""
    updated = NoteTranslation.objects.filter(pk=translation.pk).update(**fields)
    if not updated:
        logger.info("Translation %d was invalidated while in flight; result discarded", translation.pk)
    return bool(updated)


def _fail(translation: NoteTranslation, user_message: str, log: str = '', **provenance) -> None:
    logger.warning("Translation %d failed: %s", translation.pk, log or user_message)
    _write(translation, status='failed', error_message=user_message, **provenance)
