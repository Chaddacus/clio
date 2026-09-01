import logging
import time
from datetime import timedelta

from celery import shared_task

from apps.core.middleware import set_request_id
from apps.core.services import AudioProcessingService, get_transcription_service
from apps.translations.services import invalidate_translations_for_note

from .models import VoiceNote
from .views import _update_storage, create_segments_for_note

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=10)
def transcribe_voice_note_task(self, note_id: int, language: str = 'auto', trace_id: str = '') -> None:
    """Async task to transcribe a voice note via the configured provider."""
    set_request_id(trace_id)  # continue the trace from the originating request
    started = time.monotonic()
    try:
        note = VoiceNote.objects.get(id=note_id)
    except VoiceNote.DoesNotExist:
        logger.error("Voice note %d not found for transcription", note_id)
        return

    try:
        transcription_service = get_transcription_service()

        duration = AudioProcessingService.get_audio_duration(note.audio_file)
        if duration:
            note.duration = timedelta(seconds=duration)
            # Persist duration before the (slow) transcription call so the UI can
            # show the clip length and a meaningful estimate while it processes.
            note.save(update_fields=['duration'])

        result = transcription_service.transcribe_audio(note.audio_file, language)

        if result['success']:
            note.transcription = result['text']
            note.language_detected = result['language']
            note.confidence_score = result['confidence_score']
            note.status = 'completed'

            if not note.title or note.title == 'Untitled':
                words = result['text'].split()[:8]
                note.title = ' '.join(words) + ('...' if len(words) == 8 else '')

            create_segments_for_note(note, result['segments'])
        else:
            note.status = 'failed'
            note.error_message = result['error']

        note.save()
        _update_storage(note.user, note.file_size_bytes)
        logger.info(
            "Transcription task completed for note %d, status=%s, elapsed_ms=%d",
            note_id, note.status, int((time.monotonic() - started) * 1000),
        )

    except Exception as exc:
        logger.error("Transcription task failed for note %d: %s", note_id, exc, exc_info=True)
        note.status = 'failed'
        note.error_message = "Transcription failed. Please try again."
        note.save()
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, default_retry_delay=10)
def retranscribe_voice_note_task(self, note_id: int, language: str = 'auto', trace_id: str = '') -> None:
    """Async task to re-transcribe a voice note with a different language."""
    set_request_id(trace_id)  # continue the trace from the originating request
    try:
        note = VoiceNote.objects.get(id=note_id)
    except VoiceNote.DoesNotExist:
        logger.error("Voice note %d not found for retranscription", note_id)
        return

    try:
        from django.db import transaction

        transcription_service = get_transcription_service()
        result = transcription_service.transcribe_audio(note.audio_file, language)

        if result['success']:
            with transaction.atomic():
                note.transcription = result['text']
                note.language_detected = result['language']
                note.confidence_score = result.get('confidence_score')
                note.status = 'completed'
                note.error_message = ""
                note.save()
                note.segments.all().delete()
                if result.get('segments'):
                    create_segments_for_note(note, result['segments'])
                # Stored translations derive from the old transcript and its
                # segment ids; they are wrong now (translations public contract).
                invalidate_translations_for_note(note.id)
            logger.info("Re-transcription task completed for note %d", note_id)
        else:
            note.status = 'failed'
            note.error_message = result.get('error', 'Re-transcription failed')
            note.save()

    except Exception as exc:
        logger.error("Re-transcription task failed for note %d: %s", note_id, exc, exc_info=True)
        note.status = 'failed'
        note.error_message = "Transcription failed. Please try again."
        note.save()
        raise self.retry(exc=exc)
