import struct
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status

from apps.core.middleware import get_request_id, set_request_id
from apps.voice_notes.models import VoiceNote


def _wav_bytes(payload=2048):
    data = b'\x80' * payload
    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF', 36 + len(data), b'WAVE', b'fmt ', 16, 1, 1,
        8000, 8000, 1, 8, b'data', len(data),
    )
    return header + data


class TestTraceContext:
    def test_set_request_id_roundtrip(self):
        assert set_request_id('trace-abc') == 'trace-abc'
        assert get_request_id() == 'trace-abc'

    def test_set_request_id_generates_when_empty(self):
        generated = set_request_id('')
        assert generated
        assert get_request_id() == generated


@pytest.mark.django_db
class TestTracePropagation:
    def test_inbound_trace_id_is_persisted_and_dispatched(self, authenticated_client, user, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        upload = SimpleUploadedFile('note.wav', _wav_bytes(), content_type='audio/wav')
        with patch('apps.voice_notes.tasks.transcribe_voice_note_task.delay') as mock_delay:
            resp = authenticated_client.post(
                '/api/notes/', {'audio_file': upload, 'title': 'Traced'}, format='multipart',
                HTTP_X_REQUEST_ID='trace-from-browser',
            )
        assert resp.status_code == status.HTTP_202_ACCEPTED
        note = VoiceNote.objects.get(user=user)
        # the browser-supplied trace id is persisted on the note...
        assert note.trace_id == 'trace-from-browser'
        # ...and carried into the async task so the whole chain shares it.
        mock_delay.assert_called_once_with(note.id, trace_id='trace-from-browser')

    def test_trace_id_echoed_in_response_header(self, authenticated_client):
        resp = authenticated_client.get('/api/stats/', HTTP_X_REQUEST_ID='trace-xyz')
        assert resp.headers.get('X-Request-ID') == 'trace-xyz'

    def test_trace_id_exposed_on_detail(self, authenticated_client, user):
        note = VoiceNote.objects.create(
            user=user, title='t', status='completed', trace_id='trace-persisted',
            audio_file=SimpleUploadedFile('a.wav', _wav_bytes(), content_type='audio/wav'),
        )
        resp = authenticated_client.get(f'/api/notes/{note.id}/')
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['trace_id'] == 'trace-persisted'
