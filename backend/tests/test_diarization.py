import struct
from types import SimpleNamespace
from unittest import mock

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework_simplejwt.tokens import AccessToken

from apps.core.services import (
    DeepgramTranscriptionService,
    WhisperTranscriptionService,
    get_transcription_service,
)
from apps.voice_notes.models import Speaker, VoiceNote
from apps.voice_notes.views import create_segments_for_note


def _wav_bytes(payload=2048):
    data = b'\x80' * payload
    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF', 36 + len(data), b'WAVE', b'fmt ', 16, 1, 1,
        8000, 8000, 1, 8, b'data', len(data),
    )
    return header + data


def _auth(api_client, user):
    api_client.cookies['access_token'] = str(AccessToken.for_user(user))


def _note(user, **kwargs):
    return VoiceNote.objects.create(
        user=user,
        audio_file=SimpleUploadedFile('clip.wav', _wav_bytes(), content_type='audio/wav'),
        status='completed',
        **kwargs,
    )


# A trimmed diarized Deepgram response (shape verified in
# docs/DEEPGRAM_DIARIZATION_RESEARCH.md).
DIARIZED_PAYLOAD = {
    'metadata': {'duration': 9.3},
    'results': {
        'channels': [{
            'detected_language': 'en',
            'alternatives': [{
                'transcript': 'Hello world. How are you today?',
                'confidence': 0.99,
                'words': [],
            }],
        }],
        'utterances': [
            {'start': 0.4, 'end': 5.4, 'transcript': 'Hello world.', 'speaker': 0, 'confidence': 0.88},
            {'start': 6.1, 'end': 9.3, 'transcript': 'How are you today?', 'speaker': 1, 'confidence': 0.91},
        ],
    },
}


class TestTranscriptionFactory:
    def test_returns_deepgram_when_key_set(self, settings):
        settings.DEEPGRAM_API_KEY = 'dg-test-key'
        assert isinstance(get_transcription_service(), DeepgramTranscriptionService)

    def test_returns_whisper_when_key_absent(self, settings):
        settings.DEEPGRAM_API_KEY = ''
        with mock.patch.object(WhisperTranscriptionService, '__init__', return_value=None):
            assert isinstance(get_transcription_service(), WhisperTranscriptionService)


class TestDeepgramParsing:
    def test_parses_speaker_labeled_segments(self, settings, audio_file):
        settings.DEEPGRAM_API_KEY = 'dg-test-key'
        service = DeepgramTranscriptionService()

        response = mock.Mock(status_code=200)
        response.json.return_value = DIARIZED_PAYLOAD
        response.raise_for_status.return_value = None

        with mock.patch('apps.core.services.requests.post', return_value=response) as post:
            result = service.transcribe_audio(audio_file, language='auto')

        # auto language => detect_language requested
        assert post.call_args.kwargs['params']['detect_language'] == 'true'
        assert post.call_args.kwargs['params']['diarize'] == 'true'
        assert post.call_args.kwargs['headers']['Authorization'] == 'Token dg-test-key'

        assert result['success'] is True
        assert result['text'] == 'Hello world. How are you today?'
        assert result['language'] == 'en'
        assert result['confidence_score'] == 0.99
        assert result['duration'] == 9.3
        assert [s.speaker for s in result['segments']] == ['Speaker 1', 'Speaker 2']
        assert result['segments'][0].text == 'Hello world.'

    def test_explicit_language_is_passed_through(self, settings, audio_file):
        settings.DEEPGRAM_API_KEY = 'dg-test-key'
        service = DeepgramTranscriptionService()
        response = mock.Mock(status_code=200)
        response.json.return_value = DIARIZED_PAYLOAD
        response.raise_for_status.return_value = None
        with mock.patch('apps.core.services.requests.post', return_value=response) as post:
            service.transcribe_audio(audio_file, language='es')
        params = post.call_args.kwargs['params']
        assert params['language'] == 'es'
        assert 'detect_language' not in params

    def test_http_error_returns_failure(self, settings, audio_file):
        settings.DEEPGRAM_API_KEY = 'dg-test-key'
        service = DeepgramTranscriptionService()
        with mock.patch('apps.core.services.requests.post', side_effect=ValueError('boom')):
            result = service.transcribe_audio(audio_file, language='auto')
        assert result['success'] is False
        assert result['segments'] == []


@pytest.mark.django_db
class TestSpeakerSync:
    def test_create_segments_sets_speaker_and_builds_roster(self, user):
        note = _note(user)
        segments = [
            SimpleNamespace(start=0, end=1, text='hi', speaker='Speaker 1', confidence=0.9),
            SimpleNamespace(start=1, end=2, text='yo', speaker='Speaker 2', confidence=0.8),
            SimpleNamespace(start=2, end=3, text='ok', speaker='Speaker 1', confidence=0.7),
        ]
        create_segments_for_note(note, segments)

        assert note.segments.count() == 3
        assert sorted(note.segments.values_list('speaker_id', flat=True)) == [
            'Speaker 1', 'Speaker 1', 'Speaker 2',
        ]
        # distinct speaker roster, names default to the label
        speakers = list(note.speakers.values_list('label', 'name'))
        assert speakers == [('Speaker 1', 'Speaker 1'), ('Speaker 2', 'Speaker 2')]

    def test_whisper_segments_create_no_speakers(self, user):
        note = _note(user)
        # Whisper-shaped segments: avg_logprob, no speaker attribute
        segments = [SimpleNamespace(start=0, end=1, text='hi', avg_logprob=-0.2)]
        create_segments_for_note(note, segments)
        assert note.segments.count() == 1
        assert note.segments.first().speaker_id == ''
        assert note.speakers.count() == 0

    def test_resync_replaces_old_roster(self, user):
        note = _note(user)
        create_segments_for_note(note, [
            SimpleNamespace(start=0, end=1, text='a', speaker='Speaker 1', confidence=0.9),
        ])
        note.segments.all().delete()
        create_segments_for_note(note, [
            SimpleNamespace(start=0, end=1, text='b', speaker='Speaker 2', confidence=0.9),
        ])
        assert list(note.speakers.values_list('label', flat=True)) == ['Speaker 2']


@pytest.mark.django_db
class TestSpeakerRenameEndpoint:
    def test_owner_can_rename(self, api_client, user):
        note = _note(user)
        speaker = Speaker.objects.create(voice_note=note, label='Speaker 1', name='Speaker 1')
        _auth(api_client, user)
        resp = api_client.patch(f'/api/speakers/{speaker.id}/', {'name': 'Sam'}, format='json')
        assert resp.status_code == status.HTTP_200_OK
        speaker.refresh_from_db()
        assert speaker.name == 'Sam'

    def test_foreign_speaker_is_not_found(self, api_client, user, user_b):
        note_b = _note(user_b)
        foreign = Speaker.objects.create(voice_note=note_b, label='Speaker 1', name='Speaker 1')
        _auth(api_client, user)
        resp = api_client.patch(f'/api/speakers/{foreign.id}/', {'name': 'Hacker'}, format='json')
        assert resp.status_code == status.HTTP_404_NOT_FOUND
        foreign.refresh_from_db()
        assert foreign.name == 'Speaker 1'

    def test_empty_name_rejected(self, api_client, user):
        note = _note(user)
        speaker = Speaker.objects.create(voice_note=note, label='Speaker 1', name='Speaker 1')
        _auth(api_client, user)
        resp = api_client.patch(f'/api/speakers/{speaker.id}/', {'name': '   '}, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_label_is_read_only(self, api_client, user):
        note = _note(user)
        speaker = Speaker.objects.create(voice_note=note, label='Speaker 1', name='Speaker 1')
        _auth(api_client, user)
        resp = api_client.patch(
            f'/api/speakers/{speaker.id}/', {'name': 'Sam', 'label': 'HACKED'}, format='json'
        )
        assert resp.status_code == status.HTTP_200_OK
        speaker.refresh_from_db()
        assert speaker.label == 'Speaker 1'
