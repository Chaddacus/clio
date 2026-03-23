import json
import logging
import os
import re
import subprocess
import tempfile
import threading
import time
import wave
from typing import Any, Optional

from django.conf import settings
from openai import OpenAI

logger = logging.getLogger(__name__)

MAX_RETRIES = 2
RETRY_BACKOFF_SECONDS = 1


class CircuitBreaker:
    """Simple circuit breaker for external API calls."""
    def __init__(self, threshold: int = 5, reset_timeout: float = 60.0):
        self.threshold = threshold
        self.reset_timeout = reset_timeout
        self._failure_count = 0
        self._last_failure_time: Optional[float] = None
        self._lock = threading.Lock()

    def record_failure(self) -> None:
        with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()

    def record_success(self) -> None:
        with self._lock:
            self._failure_count = 0
            self._last_failure_time = None

    def is_open(self) -> bool:
        with self._lock:
            if self._failure_count < self.threshold:
                return False
            if self._last_failure_time and (time.time() - self._last_failure_time) > self.reset_timeout:
                self._failure_count = 0
                return False
            return True


_openai_circuit = CircuitBreaker()


class WhisperTranscriptionService:
    def __init__(self) -> None:
        if not settings.OPENAI_API_KEY:
            raise ValueError("OpenAI API key not configured")

        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = getattr(settings, 'WHISPER_MODEL', 'whisper-1')
        self.temperature = getattr(settings, 'WHISPER_TEMPERATURE', 0)
        self.format_text = getattr(settings, 'WHISPER_FORMAT_TEXT', True)
        self.text_formatter = TextFormattingService()
        logger.info("WhisperTranscriptionService initialized, model=%s", self.model)

    def transcribe_audio(self, audio_file: Any, language: str = 'auto') -> dict[str, Any]:
        temp_file_path = None
        try:
            file_name = getattr(audio_file, 'name', 'audio_file')
            logger.info("Starting transcription for %s", file_name)

            with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_file:
                if hasattr(audio_file, 'chunks'):
                    for chunk in audio_file.chunks():
                        temp_file.write(chunk)
                else:
                    audio_file.seek(0)
                    temp_file.write(audio_file.read())
                temp_file_path = temp_file.name

            if os.path.getsize(temp_file_path) == 0:
                raise ValueError("Temporary audio file is empty")

            response = self._call_openai_with_retry(temp_file_path, language)

            os.unlink(temp_file_path)
            temp_file_path = None

            segments = getattr(response, 'segments', [])
            formatted_text = (
                self.text_formatter.format_transcription(response.text, segments)
                if self.format_text else response.text
            )

            logger.info(
                "Transcription complete: %d chars, language=%s",
                len(formatted_text),
                getattr(response, 'language', 'unknown'),
            )

            return {
                'success': True,
                'text': formatted_text,
                'language': getattr(response, 'language', 'auto'),
                'duration': getattr(response, 'duration', None),
                'segments': segments,
                'confidence_score': self._calculate_average_confidence(segments),
            }

        except Exception as e:
            logger.error("Transcription failed: %s", e, exc_info=True)
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                except OSError as cleanup_err:
                    logger.debug("Failed to remove temp file %s: %s", temp_file_path, cleanup_err)
            return {
                'success': False,
                'error': 'Transcription service encountered an error. Please try again.',
                'transcription': '',
                'language': 'auto',
                'duration': None,
                'segments': [],
                'confidence': None,
            }

    def _call_openai_with_retry(self, temp_file_path: str, language: str) -> Any:
        if _openai_circuit.is_open():
            raise RuntimeError("Circuit breaker open: OpenAI API unavailable")
        last_error: Optional[Exception] = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                with open(temp_file_path, 'rb') as audio:
                    if language == 'auto':
                        result = self.client.audio.transcriptions.create(
                            model=self.model,
                            file=audio,
                            temperature=self.temperature,
                            response_format="verbose_json",
                        )
                    else:
                        result = self.client.audio.transcriptions.create(
                            model=self.model,
                            file=audio,
                            language=language,
                            temperature=self.temperature,
                            response_format="verbose_json",
                        )
                _openai_circuit.record_success()
                return result
            except Exception as e:
                last_error = e
                error_name = type(e).__name__
                is_transient = any(
                    keyword in error_name.lower()
                    for keyword in ('timeout', 'ratelimit', 'connection', 'server')
                ) or (hasattr(e, 'status_code') and getattr(e, 'status_code', 0) >= 500)

                if is_transient and attempt < MAX_RETRIES:
                    wait = RETRY_BACKOFF_SECONDS * (attempt + 1)
                    logger.warning("Transient error on attempt %d, retrying in %ds: %s", attempt + 1, wait, e)
                    time.sleep(wait)
                else:
                    _openai_circuit.record_failure()
                    raise
        if last_error is not None:
            _openai_circuit.record_failure()
            raise last_error
        raise RuntimeError("Retry loop exited unexpectedly")

    def _calculate_average_confidence(self, segments: list) -> Optional[float]:
        if not segments:
            return None
        confidences = [
            min(1.0, max(0.0, segment.avg_logprob + 1.0))
            for segment in segments
            if hasattr(segment, 'avg_logprob') and segment.avg_logprob is not None
        ]
        return sum(confidences) / len(confidences) if confidences else None


def get_transcription_service() -> WhisperTranscriptionService:
    """Factory function for transcription service. Override in tests."""
    return WhisperTranscriptionService()


class AudioProcessingService:
    @staticmethod
    def get_audio_duration(audio_file: Any) -> Optional[float]:
        """Get audio duration using ffprobe with wave fallback."""
        try:
            audio_file.seek(0)
            with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                for chunk in audio_file.chunks():
                    temp_file.write(chunk)
                temp_file.flush()
                temp_path = temp_file.name

            try:
                result = subprocess.run(
                    ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', temp_path],
                    capture_output=True, text=True, timeout=30,
                )
                if result.returncode == 0:
                    data = json.loads(result.stdout)
                    return float(data['format']['duration'])
            except (subprocess.TimeoutExpired, KeyError, ValueError, json.JSONDecodeError) as ffprobe_err:
                logger.debug("ffprobe duration extraction failed, falling back to wave: %s", ffprobe_err)

            # Fallback: wave library for WAV files
            try:
                with wave.open(temp_path, 'rb') as wav_file:
                    return wav_file.getnframes() / float(wav_file.getframerate())
            except Exception as wave_err:
                logger.debug("wave duration extraction failed: %s", wave_err)
            finally:
                try:
                    os.unlink(temp_path)
                except OSError as cleanup_err:
                    logger.debug("Failed to remove temp file %s: %s", temp_path, cleanup_err)

        except Exception as e:
            logger.error("Error getting audio duration: %s", e)

        return None

    @staticmethod
    def validate_audio_format(audio_file: Any) -> tuple[bool, str]:
        """Validate audio file content type and size."""
        allowed_types = [
            'audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a',
            'audio/ogg', 'audio/webm', 'audio/flac',
        ]
        content_type = getattr(audio_file, 'content_type', '')

        if content_type not in allowed_types:
            return False, f"Unsupported audio format: {content_type}"

        min_size = 1024
        if audio_file.size < min_size:
            return False, f"Audio file too small: {audio_file.size} bytes. Minimum required: {min_size} bytes"

        max_size = 50 * 1024 * 1024
        if audio_file.size > max_size:
            return False, f"Audio file too large: {audio_file.size} bytes. Maximum allowed: {max_size} bytes"

        return True, "Valid audio format"


class TextFormattingService:
    """Format raw transcription text into readable paragraphs."""

    def __init__(self) -> None:
        self.paragraph_break_seconds = getattr(settings, 'WHISPER_PARAGRAPH_BREAK_SECONDS', 2.0)
        self.max_sentence_length = getattr(settings, 'WHISPER_MAX_SENTENCE_LENGTH', 150)
        self.format_enabled = getattr(settings, 'WHISPER_FORMAT_TEXT', True)

    def format_transcription(self, raw_text: str, segments: Optional[list] = None) -> str:
        if not self.format_enabled or not raw_text:
            return raw_text
        try:
            if segments and len(segments) > 0:
                return self._format_with_segments(raw_text, segments)
            return self._format_basic(raw_text)
        except Exception as e:
            logger.error("Text formatting error: %s", e)
            return raw_text

    def _format_with_segments(self, raw_text: str, segments: list) -> str:
        formatted_segments = []
        current_paragraph: list[str] = []

        for i, segment in enumerate(segments):
            segment_text = getattr(segment, 'text', '').strip()
            if not segment_text:
                continue
            current_paragraph.append(segment_text)

            should_break = False
            current_end = getattr(segment, 'end', 0)
            next_start = getattr(segments[i + 1], 'start', 0) if i + 1 < len(segments) else 0

            if next_start > 0 and (next_start - current_end) > self.paragraph_break_seconds:
                should_break = True
            if len(' '.join(current_paragraph)) > self.max_sentence_length * 2:
                should_break = True
            if i == len(segments) - 1:
                should_break = True

            if should_break and current_paragraph:
                paragraph_text = ' '.join(current_paragraph)
                formatted = self._clean_paragraph(paragraph_text)
                if formatted:
                    formatted_segments.append(formatted)
                current_paragraph = []

        return '\n\n'.join(formatted_segments)

    def _format_basic(self, raw_text: str) -> str:
        text = re.sub(r'\s+', ' ', raw_text.strip())
        sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text)
        if not sentences:
            sentences = [text]

        paragraphs: list[str] = []
        current_paragraph: list[str] = []
        current_length = 0

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            current_paragraph.append(sentence)
            current_length += len(sentence)

            if current_length > self.max_sentence_length * 1.5:
                formatted = self._clean_paragraph(' '.join(current_paragraph))
                if formatted:
                    paragraphs.append(formatted)
                current_paragraph = []
                current_length = 0

        if current_paragraph:
            formatted = self._clean_paragraph(' '.join(current_paragraph))
            if formatted:
                paragraphs.append(formatted)

        return '\n\n'.join(paragraphs) if paragraphs else text

    @staticmethod
    def _clean_paragraph(text: str) -> str:
        if not text:
            return ""
        text = re.sub(r'\s+', ' ', text.strip())
        if text and text[0].islower():
            text = text[0].upper() + text[1:]
        if text and text[-1] not in '.!?':
            text += '.'
        return text
