import json
import logging
import os
import re
import subprocess
import tempfile
import threading
import time
import wave
from types import SimpleNamespace
from typing import Any, Optional

import requests
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
_deepgram_circuit = CircuitBreaker()


class WhisperTranscriptionService:
    def __init__(self) -> None:
        base_url = getattr(settings, 'OPENAI_BASE_URL', '') or None
        api_key = settings.OPENAI_API_KEY or 'not-needed'

        if not base_url and not settings.OPENAI_API_KEY:
            raise ValueError("OpenAI API key or base URL not configured")

        self.client = OpenAI(api_key=api_key, base_url=base_url) if base_url else OpenAI(api_key=api_key)
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


class DeepgramTranscriptionService:
    """Transcription + speaker diarization via Deepgram's pre-recorded API.

    Deepgram returns speaker labels (Whisper does not). We send the raw audio
    bytes to POST /v1/listen with diarize+utterances, then turn each utterance
    (a contiguous single-speaker turn) into a segment carrying a ``speaker``
    label so the rest of the pipeline can persist and rename speakers.
    """

    EXT_MIME = {
        'wav': 'audio/wav', 'mp3': 'audio/mpeg', 'ogg': 'audio/ogg',
        'webm': 'audio/webm', 'm4a': 'audio/mp4', 'flac': 'audio/flac',
    }

    def __init__(self) -> None:
        self.api_key = settings.DEEPGRAM_API_KEY
        if not self.api_key:
            raise ValueError("DEEPGRAM_API_KEY not configured")
        self.base_url = getattr(settings, 'DEEPGRAM_BASE_URL', 'https://api.deepgram.com').rstrip('/')
        self.model = getattr(settings, 'DEEPGRAM_MODEL', 'nova-3')
        logger.info("DeepgramTranscriptionService initialized, model=%s", self.model)

    def transcribe_audio(self, audio_file: Any, language: str = 'auto') -> dict[str, Any]:
        try:
            file_name = getattr(audio_file, 'name', 'audio_file')
            logger.info("Starting Deepgram transcription for %s", file_name)

            audio_bytes = self._read_bytes(audio_file)
            if not audio_bytes:
                raise ValueError("Audio file is empty")

            api_started = time.monotonic()
            payload = self._post_with_retry(audio_bytes, self._content_type(file_name), language)
            logger.info(
                "Deepgram API call returned in %d ms (%d bytes sent)",
                int((time.monotonic() - api_started) * 1000), len(audio_bytes),
            )

            results = payload.get('results', {}) or {}
            channels = results.get('channels', []) or []
            channel0 = channels[0] if channels else {}
            alternatives = channel0.get('alternatives', []) or []
            alt = alternatives[0] if alternatives else {}

            text = alt.get('transcript', '') or ''
            overall_confidence = alt.get('confidence')
            detected = channel0.get('detected_language')
            lang = (detected or (language if language != 'auto' else 'auto') or 'auto').split('-')[0][:10]
            duration = (payload.get('metadata', {}) or {}).get('duration')

            segments = [
                SimpleNamespace(
                    start=utt.get('start', 0.0),
                    end=utt.get('end', 0.0),
                    text=(utt.get('transcript', '') or '').strip(),
                    speaker=f"Speaker {int(utt.get('speaker', 0)) + 1}",
                    confidence=utt.get('confidence'),
                )
                for utt in (results.get('utterances', []) or [])
                if (utt.get('transcript', '') or '').strip()
            ]

            logger.info(
                "Deepgram transcription complete: %d chars, language=%s, %d utterances",
                len(text), lang, len(segments),
            )

            return {
                'success': True,
                'text': text,
                'language': lang,
                'duration': duration,
                'segments': segments,
                'confidence_score': overall_confidence,
            }

        except Exception as e:
            logger.error("Deepgram transcription failed: %s", e, exc_info=True)
            return {
                'success': False,
                'error': 'Transcription service encountered an error. Please try again.',
                'transcription': '',
                'language': 'auto',
                'duration': None,
                'segments': [],
                'confidence': None,
            }

    def _content_type(self, file_name: str) -> str:
        ext = file_name.rsplit('.', 1)[-1].lower() if '.' in file_name else ''
        return self.EXT_MIME.get(ext, 'audio/webm')

    @staticmethod
    def _read_bytes(audio_file: Any) -> bytes:
        if hasattr(audio_file, 'chunks'):
            return b''.join(audio_file.chunks())
        audio_file.seek(0)
        return audio_file.read()

    def _post_with_retry(self, audio_bytes: bytes, content_type: str, language: str) -> dict:
        if _deepgram_circuit.is_open():
            raise RuntimeError("Circuit breaker open: Deepgram API unavailable")

        params = {
            'model': self.model,
            'diarize': 'true',
            'utterances': 'true',
            'punctuate': 'true',
            'smart_format': 'true',
        }
        if language == 'auto':
            params['detect_language'] = 'true'
        else:
            params['language'] = language

        headers = {'Authorization': f'Token {self.api_key}', 'Content-Type': content_type}
        url = f"{self.base_url}/v1/listen"

        last_error: Optional[Exception] = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                response = requests.post(url, params=params, data=audio_bytes, headers=headers, timeout=300)
                if response.status_code >= 500:
                    raise RuntimeError(f"Deepgram server error: {response.status_code}")
                response.raise_for_status()
                _deepgram_circuit.record_success()
                return response.json()
            except Exception as e:
                last_error = e
                status_code = getattr(getattr(e, 'response', None), 'status_code', 0) or 0
                is_transient = isinstance(e, (requests.Timeout, requests.ConnectionError)) or status_code >= 500
                if is_transient and attempt < MAX_RETRIES:
                    wait = RETRY_BACKOFF_SECONDS * (attempt + 1)
                    logger.warning("Transient Deepgram error on attempt %d, retrying in %ds: %s", attempt + 1, wait, e)
                    time.sleep(wait)
                else:
                    _deepgram_circuit.record_failure()
                    raise
        if last_error is not None:
            _deepgram_circuit.record_failure()
            raise last_error
        raise RuntimeError("Retry loop exited unexpectedly")


def get_transcription_service():
    """Factory function for transcription service. Override in tests.

    Routes to Deepgram (transcribe + speaker diarization) when DEEPGRAM_API_KEY
    is configured; otherwise falls back to the self-hosted Whisper server.
    """
    if getattr(settings, 'DEEPGRAM_API_KEY', ''):
        return DeepgramTranscriptionService()
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
    def _sniff_audio_magic(audio_file: Any) -> bool:
        """Return True if the file's leading bytes match a known audio container.

        Client-supplied Content-Type and filename extension are both spoofable.
        Without a header check an attacker can store arbitrary content (e.g.
        HTML/JS) as 'audio/wav', which — combined with media serving — becomes a
        stored-content vector. We inspect the actual magic bytes.
        """
        try:
            pos = audio_file.tell() if hasattr(audio_file, 'tell') else None
        except (OSError, ValueError):
            pos = None
        try:
            audio_file.seek(0)
            header = audio_file.read(16) or b''
        except (OSError, ValueError, AttributeError):
            return False
        finally:
            try:
                audio_file.seek(pos if pos is not None else 0)
            except (OSError, ValueError, AttributeError):
                pass

        if not isinstance(header, (bytes, bytearray)) or len(header) < 4:
            return False

        # WAV: 'RIFF'....'WAVE'
        if header[:4] == b'RIFF' and header[8:12] == b'WAVE':
            return True
        # MP3: 'ID3' tag or MPEG frame sync (0xFF 0xEx/0xFx)
        if header[:3] == b'ID3' or (header[0] == 0xFF and (header[1] & 0xE0) == 0xE0):
            return True
        # OGG / Opus
        if header[:4] == b'OggS':
            return True
        # FLAC
        if header[:4] == b'fLaC':
            return True
        # WebM / Matroska (EBML)
        if header[:4] == b'\x1a\x45\xdf\xa3':
            return True
        # MP4 / M4A: 'ftyp' box at offset 4
        if header[4:8] == b'ftyp':
            return True
        return False

    @staticmethod
    def validate_audio_format(audio_file: Any) -> tuple[bool, str]:
        """Validate audio file content type, size, and actual magic bytes."""
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

        if not AudioProcessingService._sniff_audio_magic(audio_file):
            return False, "File content does not match a supported audio format"

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
