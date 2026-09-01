"""Spoken-language handling for the Deepgram transcription path.

Regression guard for the report "Spanish audio comes back as English".
These tests pin the contract that the auto path asks Deepgram to detect the
language and that whatever it detects is what the note stores, for every
language the app offers. Provider responses are recorded shapes (see
docs/adr/004-language-detection-strategy.md); the live provider check lives
in tests/live/.
"""
from typing import Optional
from unittest import mock

import pytest

from apps.core.services import DeepgramTranscriptionService
from apps.voice_notes.models import VoiceNote


def _payload(transcript: str, detected: Optional[str], confidence: float = 0.99) -> dict:
    channel = {
        'alternatives': [{'transcript': transcript, 'confidence': 0.97, 'words': []}],
    }
    if detected is not None:
        channel['detected_language'] = detected
        channel['language_confidence'] = confidence
    return {
        'metadata': {'duration': 7.5},
        'results': {
            'channels': [channel],
            'utterances': [
                {'start': 0.0, 'end': 7.5, 'transcript': transcript, 'speaker': 0, 'confidence': 0.97},
            ],
        },
    }


def _mock_response(payload: dict) -> mock.Mock:
    response = mock.Mock(status_code=200)
    response.json.return_value = payload
    response.raise_for_status.return_value = None
    return response


@pytest.fixture
def deepgram(settings):
    settings.DEEPGRAM_API_KEY = 'dg-test-key'
    return DeepgramTranscriptionService()


OFFERED_LANGUAGES = [code for code, _ in VoiceNote.LANGUAGE_CHOICES if code != 'auto']


class TestAutoLanguagePath:
    def test_auto_requests_detection_not_a_fixed_language(self, deepgram, audio_file):
        with mock.patch(
            'apps.core.services.requests.post', return_value=_mock_response(_payload('Hola', 'es'))
        ) as post:
            deepgram.transcribe_audio(audio_file, language='auto')
        params = post.call_args.kwargs['params']
        assert params['detect_language'] == 'true'
        assert 'language' not in params

    @pytest.mark.parametrize('detected', OFFERED_LANGUAGES)
    def test_detected_language_is_stored_verbatim(self, deepgram, audio_file, detected):
        with mock.patch(
            'apps.core.services.requests.post',
            return_value=_mock_response(_payload('texto', detected)),
        ):
            result = deepgram.transcribe_audio(audio_file, language='auto')
        assert result['success'] is True
        assert result['language'] == detected

    def test_spanish_text_is_kept_not_translated(self, deepgram, audio_file):
        spanish = 'Hola, soy tu hermana. Mañana tengo cita con el médico.'
        with mock.patch(
            'apps.core.services.requests.post', return_value=_mock_response(_payload(spanish, 'es'))
        ):
            result = deepgram.transcribe_audio(audio_file, language='auto')
        assert result['text'] == spanish
        assert result['segments'][0].text == spanish
        assert result['language'] == 'es'

    def test_regional_code_is_normalised_to_base_language(self, deepgram, audio_file):
        with mock.patch(
            'apps.core.services.requests.post', return_value=_mock_response(_payload('Olá', 'pt-BR'))
        ):
            result = deepgram.transcribe_audio(audio_file, language='auto')
        assert result['language'] == 'pt'

    def test_missing_detection_falls_back_to_auto(self, deepgram, audio_file):
        with mock.patch(
            'apps.core.services.requests.post', return_value=_mock_response(_payload('...', None))
        ):
            result = deepgram.transcribe_audio(audio_file, language='auto')
        assert result['language'] == 'auto'


class TestExplicitLanguagePath:
    @pytest.mark.parametrize('requested', ['es', 'ko', 'zh'])
    def test_explicit_language_is_sent_and_stored(self, deepgram, audio_file, requested):
        with mock.patch(
            'apps.core.services.requests.post', return_value=_mock_response(_payload('texto', None))
        ) as post:
            result = deepgram.transcribe_audio(audio_file, language=requested)
        params = post.call_args.kwargs['params']
        assert params['language'] == requested
        assert 'detect_language' not in params
        assert result['language'] == requested
