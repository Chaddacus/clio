"""Celery task that fills a NoteTranslation row.

The row is created by the API in 'pending' state; this task runs the provider,
validates the output against the contract, and writes either 'completed' with
text + aligned segments or 'failed' with a user-safe message. It never touches
VoiceNote.transcription or the TranscriptionSegment rows.

Retry policy: only transient provider failures (rate limit, 5xx, connection)
are retried, and the row stays 'pending' while a retry is scheduled so the UI
keeps polling. Configuration errors, refusals, truncation, and contract
violations fail immediately; a retry would repeat the same outcome at cost.
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
        # Configuration or programming error. Log the type, not the message:
        # provider exceptions can embed request or response content.
        logger.error("Translation task error for %d: %s", translation_id, type(exc).__name__, exc_info=True)
        _fail(translation, USER_ERROR, log=type(exc).__name__)
        return

    translation.provider = result.provider
    translation.model = result.model
    translation.prompt_version = result.prompt_version
    translation.input_tokens = result.input_tokens
    translation.output_tokens = result.output_tokens
    translation.source_language = source_language

    if not result.success:
        if result.retryable and self.request.retries < self.max_retries:
            translation.save()
            logger.warning(
                "Translation %d transient failure (%s); retry %d/%d in %ds",
                translation.id, result.error, self.request.retries + 1, self.max_retries, RETRY_DELAY_SECONDS,
            )
            raise self.retry(countdown=RETRY_DELAY_SECONDS)
        _fail(translation, USER_ERROR, log=result.error)
        return

    contract_error = validate_units(units, result.units)
    if contract_error:
        _fail(translation, USER_ERROR, log=f"contract violation: {contract_error}")
        return

    translation.text = join_units(result.units)
    translation.segments = (
        [] if (len(units) == 1 and units[0].id == 0)
        else [{'segment_id': u['id'], 'text': u['text']} for u in result.units]
    )
    translation.status = 'completed'
    translation.error_message = ''
    translation.save()
    logger.info(
        "Translation %d completed: note=%d target=%s units=%d elapsed_ms=%d",
        translation.id, note.id, translation.target_language, len(units),
        int((time.monotonic() - started) * 1000),
    )


def _fail(translation: NoteTranslation, user_message: str, log: str = '') -> None:
    logger.warning("Translation %d failed: %s", translation.id, log or user_message)
    translation.status = 'failed'
    translation.error_message = user_message
    translation.save()
