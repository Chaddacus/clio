"""Tests for apps/voice_notes/tasks.py."""
from unittest.mock import MagicMock, patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.voice_notes.models import VoiceNote
from apps.voice_notes.tasks import retranscribe_voice_note_task, transcribe_voice_note_task


def _minimal_wav():
    """Return a minimal valid WAV SimpleUploadedFile."""
    import struct

    sample_rate = 8000
    num_samples = sample_rate
    data_size = num_samples
    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF',
        36 + data_size,
        b'WAVE',
        b'fmt ',
        16,
        1,
        1,
        sample_rate,
        sample_rate,
        1,
        8,
        b'data',
        data_size,
    )
    return SimpleUploadedFile('test.wav', header + b'\x80' * num_samples, content_type='audio/wav')


def _make_mock_service(success=True, text='Hello', language='en', confidence_score=0.9, segments=None):
    service = MagicMock()
    if success:
        service.transcribe_audio.return_value = {
            'success': True,
            'text': text,
            'language': language,
            'confidence_score': confidence_score,
            'segments': segments if segments is not None else [],
        }
    else:
        service.transcribe_audio.return_value = {
            'success': False,
            'error': 'Failed',
        }
    return service


def _create_note(user):
    """Create a VoiceNote with a real WAV upload so audio_file stores cleanly in DB."""
    return VoiceNote.objects.create(
        user=user,
        title='Untitled',
        status='processing',
        audio_file=_minimal_wav(),
    )


@pytest.mark.django_db
class TestTranscribeVoiceNoteTask:
    @patch('apps.voice_notes.tasks.AudioProcessingService.get_audio_duration', return_value=5.0)
    @patch('apps.voice_notes.tasks.get_transcription_service')
    def test_transcribe_task_happy_path(self, mock_factory, mock_duration, user):
        mock_factory.return_value = _make_mock_service()
        note = _create_note(user)

        transcribe_voice_note_task(note.id)

        note.refresh_from_db()
        assert note.status == 'completed'
        assert note.transcription == 'Hello'
        assert note.language_detected == 'en'
        assert note.confidence_score == pytest.approx(0.9)

    @patch('apps.voice_notes.tasks.get_transcription_service')
    def test_transcribe_task_not_found(self, mock_factory):
        """Non-existent ID should return silently without raising."""
        transcribe_voice_note_task(99999)
        mock_factory.assert_not_called()

    @patch('apps.voice_notes.tasks.AudioProcessingService.get_audio_duration', return_value=5.0)
    @patch('apps.voice_notes.tasks.get_transcription_service')
    def test_transcribe_task_failure(self, mock_factory, mock_duration, user):
        mock_factory.return_value = _make_mock_service(success=False)
        note = _create_note(user)

        transcribe_voice_note_task(note.id)

        note.refresh_from_db()
        assert note.status == 'failed'

    @patch('apps.voice_notes.tasks.AudioProcessingService.get_audio_duration', return_value=5.0)
    @patch('apps.voice_notes.tasks.get_transcription_service')
    def test_error_message_sanitized(self, mock_factory, mock_duration, user):
        """Exception details must not leak into error_message; generic text only.

        Celery's self.retry(exc=exc) re-raises the original exception (not
        celery.exceptions.Retry) when called outside a real broker context, so
        we catch Exception broadly and verify the note state afterward.
        """
        secret_message = 'super secret internal error xyz'
        mock_service = MagicMock()
        mock_service.transcribe_audio.side_effect = Exception(secret_message)
        mock_factory.return_value = mock_service
        note = _create_note(user)

        with pytest.raises(Exception):
            transcribe_voice_note_task(note.id)

        note.refresh_from_db()
        assert note.status == 'failed'
        assert secret_message not in note.error_message
        assert note.error_message  # non-empty generic message


@pytest.mark.django_db
class TestRetranscribeVoiceNoteTask:
    @patch('apps.voice_notes.tasks.get_transcription_service')
    def test_retranscribe_task_happy_path(self, mock_factory, user):
        mock_factory.return_value = _make_mock_service(text='New transcription')
        note = _create_note(user)
        note.transcription = 'Old text'
        note.status = 'completed'
        note.save(update_fields=['transcription', 'status'])

        retranscribe_voice_note_task(note.id)

        note.refresh_from_db()
        assert note.status == 'completed'
        assert note.transcription == 'New transcription'

    @patch('apps.voice_notes.tasks.get_transcription_service')
    def test_retranscribe_task_not_found(self, mock_factory):
        """Non-existent ID should return silently without raising."""
        retranscribe_voice_note_task(99999)
        mock_factory.assert_not_called()
