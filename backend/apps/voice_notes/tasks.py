import logging
from datetime import timedelta

from celery import shared_task

from apps.core.services import AudioProcessingService, WhisperTranscriptionService

from .models import VoiceNote
from .views import _update_storage, create_segments_for_note

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=10)
def transcribe_voice_note_task(self, note_id: int, language: str = 'auto') -> None:
    """Async task to transcribe a voice note via OpenAI Whisper."""
    try:
        note = VoiceNote.objects.get(id=note_id)
    except VoiceNote.DoesNotExist:
        logger.error("Voice note %d not found for transcription", note_id)
        return

    try:
        transcription_service = WhisperTranscriptionService()

        duration = AudioProcessingService.get_audio_duration(note.audio_file)
        if duration:
            note.duration = timedelta(seconds=duration)

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
        logger.info("Transcription task completed for note %d, status=%s", note_id, note.status)

    except Exception as exc:
        logger.error("Transcription task failed for note %d: %s", note_id, exc, exc_info=True)
        note.status = 'failed'
        note.error_message = str(exc)
        note.save()
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, default_retry_delay=10)
def retranscribe_voice_note_task(self, note_id: int, language: str = 'auto') -> None:
    """Async task to re-transcribe a voice note with a different language."""
    try:
        note = VoiceNote.objects.get(id=note_id)
    except VoiceNote.DoesNotExist:
        logger.error("Voice note %d not found for retranscription", note_id)
        return

    try:
        from django.db import transaction

        transcription_service = WhisperTranscriptionService()
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
            logger.info("Re-transcription task completed for note %d", note_id)
        else:
            note.status = 'failed'
            note.error_message = result.get('error', 'Re-transcription failed')
            note.save()

    except Exception as exc:
        logger.error("Re-transcription task failed for note %d: %s", note_id, exc, exc_info=True)
        note.status = 'failed'
        note.error_message = str(exc)
        note.save()
        raise self.retry(exc=exc)
