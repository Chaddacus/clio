import io
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from apps.core.services import (
    AudioProcessingService,
    TextFormattingService,
    WhisperTranscriptionService,
)


class TestWhisperTranscriptionServiceInit:
    @patch('apps.core.services.settings')
    def test_raises_when_no_api_key(self, mock_settings):
        mock_settings.OPENAI_API_KEY = ''
        with pytest.raises(ValueError, match="OpenAI API key not configured"):
            WhisperTranscriptionService()

    @patch('apps.core.services.OpenAI')
    @patch('apps.core.services.settings')
    def test_initializes_with_valid_key(self, mock_settings, mock_openai):
        mock_settings.OPENAI_API_KEY = 'test-key'
        mock_settings.WHISPER_MODEL = 'whisper-1'
        mock_settings.WHISPER_TEMPERATURE = 0
        mock_settings.WHISPER_FORMAT_TEXT = False
        mock_settings.WHISPER_PARAGRAPH_BREAK_SECONDS = 2.0
        mock_settings.WHISPER_MAX_SENTENCE_LENGTH = 150
        service = WhisperTranscriptionService()
        assert service.model == 'whisper-1'
        mock_openai.assert_called_once_with(api_key='test-key')


class TestTranscribeAudio:
    @patch('apps.core.services.OpenAI')
    @patch('apps.core.services.settings')
    def test_success_path(self, mock_settings, mock_openai):
        mock_settings.OPENAI_API_KEY = 'test-key'
        mock_settings.WHISPER_MODEL = 'whisper-1'
        mock_settings.WHISPER_TEMPERATURE = 0
        mock_settings.WHISPER_FORMAT_TEXT = False
        mock_settings.WHISPER_PARAGRAPH_BREAK_SECONDS = 2.0
        mock_settings.WHISPER_MAX_SENTENCE_LENGTH = 150

        mock_response = SimpleNamespace(
            text='Hello world',
            language='en',
            duration=5.0,
            segments=[],
        )
        mock_client = MagicMock()
        mock_client.audio.transcriptions.create.return_value = mock_response
        mock_openai.return_value = mock_client

        service = WhisperTranscriptionService()

        audio = io.BytesIO(b'\x00' * 1024)
        audio.name = 'test.wav'
        result = service.transcribe_audio(audio)

        assert result['success'] is True
        assert result['text'] == 'Hello world'
        assert result['language'] == 'en'
        assert result['duration'] == 5.0

    @patch('apps.core.services.OpenAI')
    @patch('apps.core.services.settings')
    def test_failure_returns_generic_error(self, mock_settings, mock_openai):
        mock_settings.OPENAI_API_KEY = 'test-key'
        mock_settings.WHISPER_MODEL = 'whisper-1'
        mock_settings.WHISPER_TEMPERATURE = 0
        mock_settings.WHISPER_FORMAT_TEXT = False
        mock_settings.WHISPER_PARAGRAPH_BREAK_SECONDS = 2.0
        mock_settings.WHISPER_MAX_SENTENCE_LENGTH = 150

        mock_client = MagicMock()
        mock_client.audio.transcriptions.create.side_effect = Exception("API down")
        mock_openai.return_value = mock_client

        service = WhisperTranscriptionService()

        audio = io.BytesIO(b'\x00' * 1024)
        audio.name = 'test.wav'
        result = service.transcribe_audio(audio)

        assert result['success'] is False
        assert 'API down' not in result['error']  # Should not leak internal error


class TestRetryLogic:
    @patch('apps.core.services.OpenAI')
    @patch('apps.core.services.settings')
    @patch('apps.core.services.time.sleep')
    def test_retries_on_transient_error(self, mock_sleep, mock_settings, mock_openai):
        mock_settings.OPENAI_API_KEY = 'test-key'
        mock_settings.WHISPER_MODEL = 'whisper-1'
        mock_settings.WHISPER_TEMPERATURE = 0
        mock_settings.WHISPER_FORMAT_TEXT = False
        mock_settings.WHISPER_PARAGRAPH_BREAK_SECONDS = 2.0
        mock_settings.WHISPER_MAX_SENTENCE_LENGTH = 150

        # First call fails with timeout, second succeeds
        mock_response = SimpleNamespace(
            text='Hello', language='en', duration=1.0, segments=[],
        )

        class TimeoutError(Exception):
            pass

        mock_client = MagicMock()
        mock_client.audio.transcriptions.create.side_effect = [
            TimeoutError("Connection timed out"),
            mock_response,
        ]
        mock_openai.return_value = mock_client

        service = WhisperTranscriptionService()

        audio = io.BytesIO(b'\x00' * 1024)
        audio.name = 'test.wav'
        result = service.transcribe_audio(audio)

        assert result['success'] is True
        assert mock_sleep.called


class TestCalculateAverageConfidence:
    @patch('apps.core.services.OpenAI')
    @patch('apps.core.services.settings')
    def test_with_segments(self, mock_settings, mock_openai):
        mock_settings.OPENAI_API_KEY = 'test-key'
        mock_settings.WHISPER_MODEL = 'whisper-1'
        mock_settings.WHISPER_TEMPERATURE = 0
        mock_settings.WHISPER_FORMAT_TEXT = False
        mock_settings.WHISPER_PARAGRAPH_BREAK_SECONDS = 2.0
        mock_settings.WHISPER_MAX_SENTENCE_LENGTH = 150

        service = WhisperTranscriptionService()
        segments = [
            SimpleNamespace(avg_logprob=-0.5),
            SimpleNamespace(avg_logprob=-0.3),
        ]
        confidence = service._calculate_average_confidence(segments)
        assert confidence is not None
        assert 0 <= confidence <= 1

    @patch('apps.core.services.OpenAI')
    @patch('apps.core.services.settings')
    def test_empty_segments(self, mock_settings, mock_openai):
        mock_settings.OPENAI_API_KEY = 'test-key'
        mock_settings.WHISPER_MODEL = 'whisper-1'
        mock_settings.WHISPER_TEMPERATURE = 0
        mock_settings.WHISPER_FORMAT_TEXT = False
        mock_settings.WHISPER_PARAGRAPH_BREAK_SECONDS = 2.0
        mock_settings.WHISPER_MAX_SENTENCE_LENGTH = 150

        service = WhisperTranscriptionService()
        assert service._calculate_average_confidence([]) is None


class TestAudioValidation:
    def test_valid_audio(self):
        audio = MagicMock()
        audio.content_type = 'audio/wav'
        audio.size = 5000
        valid, msg = AudioProcessingService.validate_audio_format(audio)
        assert valid is True

    def test_invalid_content_type(self):
        audio = MagicMock()
        audio.content_type = 'text/plain'
        audio.size = 5000
        valid, msg = AudioProcessingService.validate_audio_format(audio)
        assert valid is False
        assert 'Unsupported' in msg

    def test_too_small(self):
        audio = MagicMock()
        audio.content_type = 'audio/wav'
        audio.size = 100
        valid, msg = AudioProcessingService.validate_audio_format(audio)
        assert valid is False
        assert 'too small' in msg

    def test_too_large(self):
        audio = MagicMock()
        audio.content_type = 'audio/wav'
        audio.size = 100 * 1024 * 1024
        valid, msg = AudioProcessingService.validate_audio_format(audio)
        assert valid is False
        assert 'too large' in msg


class TestTextFormatting:
    @pytest.fixture
    def formatter(self):
        with patch('apps.core.services.settings') as mock_settings:
            mock_settings.WHISPER_PARAGRAPH_BREAK_SECONDS = 2.0
            mock_settings.WHISPER_MAX_SENTENCE_LENGTH = 150
            mock_settings.WHISPER_FORMAT_TEXT = True
            return TextFormattingService()

    def test_basic_formatting(self, formatter):
        result = formatter.format_transcription("hello world. This is a test.")
        assert result
        assert result[0].isupper()

    def test_empty_text(self, formatter):
        result = formatter.format_transcription("")
        assert result == ""

    def test_segment_based_formatting(self, formatter):
        segments = [
            SimpleNamespace(text="Hello world.", start=0.0, end=1.0),
            SimpleNamespace(text="This is next.", start=1.1, end=2.0),
            SimpleNamespace(text="After a pause.", start=5.0, end=6.0),
        ]
        result = formatter.format_transcription("Hello world. This is next. After a pause.", segments)
        assert '\n\n' in result  # Should have paragraph break at the 3s pause
