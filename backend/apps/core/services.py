from openai import OpenAI
import tempfile
import os
from django.conf import settings
from django.core.files.base import ContentFile
import logging

logger = logging.getLogger(__name__)


class WhisperTranscriptionService:
    def __init__(self):
        if not settings.OPENAI_API_KEY:
            logger.error("[WhisperTranscriptionService] OpenAI API key not configured in settings")
            raise ValueError("OpenAI API key not configured")
        
        # Log API key presence (not the key itself)
        api_key_length = len(settings.OPENAI_API_KEY)
        logger.info(f"[WhisperTranscriptionService] Initializing with API key present (length: {api_key_length})")
        
        try:
            self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
            
            # Load configurable settings
            self.model = getattr(settings, 'WHISPER_MODEL', 'whisper-1')
            self.temperature = getattr(settings, 'WHISPER_TEMPERATURE', 0)
            self.format_text = getattr(settings, 'WHISPER_FORMAT_TEXT', True)
            
            # Initialize text formatter
            self.text_formatter = TextFormattingService()
            
            logger.info("[WhisperTranscriptionService] OpenAI client initialized successfully")
            logger.info(f"[WhisperTranscriptionService] Model: {self.model}, Temperature: {self.temperature}, Format: {self.format_text}")
        except Exception as e:
            logger.error(f"[WhisperTranscriptionService] Failed to initialize OpenAI client: {str(e)}", exc_info=True)
            raise
    
    def transcribe_audio(self, audio_file, language='auto'):
        temp_file_path = None
        try:
            # Handle different types of file objects
            file_size = getattr(audio_file, 'size', None)
            file_name = getattr(audio_file, 'name', 'audio_file')
            
            logger.info(f"[WhisperTranscriptionService] Starting transcription for file: {file_name}, size: {file_size}")
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_file:
                # Handle Django file objects vs regular file handles
                bytes_written = 0
                if hasattr(audio_file, 'chunks'):
                    # Django file object
                    logger.info("[WhisperTranscriptionService] Processing Django file object with chunks")
                    for chunk in audio_file.chunks():
                        temp_file.write(chunk)
                        bytes_written += len(chunk)
                else:
                    # Regular file handle - copy all data
                    logger.info("[WhisperTranscriptionService] Processing regular file handle")
                    audio_file.seek(0)
                    data = audio_file.read()
                    temp_file.write(data)
                    bytes_written = len(data)
                temp_file_path = temp_file.name
            
            # Verify temporary file was created properly
            temp_file_size = os.path.getsize(temp_file_path) if os.path.exists(temp_file_path) else 0
            logger.info(f"[WhisperTranscriptionService] Temporary file created: {temp_file_path}")
            logger.info(f"[WhisperTranscriptionService] Temp file size: {temp_file_size} bytes, bytes written: {bytes_written}")
            
            if temp_file_size == 0:
                logger.error("[WhisperTranscriptionService] Temporary file is empty!")
                raise ValueError("Temporary audio file is empty")
            
            if temp_file_size != bytes_written:
                logger.warning(f"[WhisperTranscriptionService] Size mismatch: file size {temp_file_size} != bytes written {bytes_written}")
            
            with open(temp_file_path, 'rb') as audio:
                # Log API call parameters
                logger.info(f"[WhisperTranscriptionService] Preparing OpenAI API call:")
                logger.info(f"  - Model: {self.model}")
                logger.info(f"  - Language: {language}")
                logger.info(f"  - Temperature: {self.temperature}")
                logger.info(f"  - Response format: verbose_json")
                logger.info(f"  - File size for API: {temp_file_size} bytes")
                
                try:
                    if language == 'auto':
                        logger.info("[WhisperTranscriptionService] Making OpenAI API call with auto-detection")
                        response = self.client.audio.transcriptions.create(
                            model=self.model,
                            file=audio,
                            temperature=self.temperature,
                            response_format="verbose_json"
                        )
                    else:
                        logger.info(f"[WhisperTranscriptionService] Making OpenAI API call with language: {language}")
                        response = self.client.audio.transcriptions.create(
                            model=self.model,
                            file=audio,
                            language=language,
                            temperature=self.temperature,
                            response_format="verbose_json"
                        )
                    
                    logger.info("[WhisperTranscriptionService] OpenAI API call completed successfully")
                    
                    # Log response details
                    response_text_length = len(response.text) if hasattr(response, 'text') else 0
                    response_language = getattr(response, 'language', 'unknown')
                    response_duration = getattr(response, 'duration', 'unknown')
                    segments_count = len(getattr(response, 'segments', []))
                    
                    logger.info(f"[WhisperTranscriptionService] OpenAI response details:")
                    logger.info(f"  - Text length: {response_text_length}")
                    logger.info(f"  - Detected language: {response_language}")
                    logger.info(f"  - Duration: {response_duration}")
                    logger.info(f"  - Segments count: {segments_count}")
                    
                    if response_text_length > 0:
                        # Log first 100 chars of transcription for debugging
                        preview_text = response.text[:100] + "..." if len(response.text) > 100 else response.text
                        logger.info(f"[WhisperTranscriptionService] Transcription preview: {preview_text}")
                    else:
                        logger.warning("[WhisperTranscriptionService] OpenAI returned empty transcription text")
                        
                except Exception as api_error:
                    logger.error(f"[WhisperTranscriptionService] OpenAI API call failed: {str(api_error)}")
                    logger.error(f"[WhisperTranscriptionService] API error type: {type(api_error).__name__}")
                    if hasattr(api_error, 'response'):
                        logger.error(f"[WhisperTranscriptionService] API response status: {getattr(api_error.response, 'status_code', 'unknown')}")
                        logger.error(f"[WhisperTranscriptionService] API response text: {getattr(api_error.response, 'text', 'unknown')}")
                    raise api_error
            
            logger.info(f"[WhisperTranscriptionService] OpenAI API call successful, cleaning up temp file")
            if temp_file_path:
                os.unlink(temp_file_path)
            
            logger.info(f"[WhisperTranscriptionService] Response received: transcription length={len(response.text)}")
            
            # Apply text formatting if enabled
            segments = getattr(response, 'segments', [])
            formatted_text = self.text_formatter.format_transcription(response.text, segments) if self.format_text else response.text
            
            logger.info(f"[WhisperTranscriptionService] Text formatting applied: {len(formatted_text)} characters, formatting enabled: {self.format_text}")
            
            return {
                'success': True,
                'text': formatted_text,  # Now includes formatting
                'language': response.language if hasattr(response, 'language') else 'auto',
                'duration': response.duration if hasattr(response, 'duration') else None,
                'segments': segments,
                'confidence_score': self._calculate_average_confidence(segments)
            }
            
        except Exception as e:
            logger.error(f"[WhisperTranscriptionService] Transcription error: {str(e)}", exc_info=True)
            logger.error(f"[WhisperTranscriptionService] Error occurred at: {type(e).__name__}")
            
            # Clean up temporary file
            if temp_file_path and os.path.exists(temp_file_path):
                logger.info(f"[WhisperTranscriptionService] Cleaning up temp file: {temp_file_path}")
                try:
                    os.unlink(temp_file_path)
                except Exception as cleanup_error:
                    logger.error(f"[WhisperTranscriptionService] Failed to cleanup temp file: {cleanup_error}")
            
            return {
                'success': False,
                'error': str(e),
                'transcription': '',
                'language': 'auto',
                'duration': None,
                'segments': [],
                'confidence': None
            }
    
    def _calculate_average_confidence(self, segments):
        if not segments:
            return None
        
        confidences = []
        for segment in segments:
            if hasattr(segment, 'avg_logprob') and segment.avg_logprob is not None:
                confidence = min(1.0, max(0.0, segment.avg_logprob + 1.0))
                confidences.append(confidence)
        
        return sum(confidences) / len(confidences) if confidences else None


class AudioProcessingService:
    @staticmethod
    def get_audio_duration(audio_file):
        """
        Get audio duration supporting multiple formats (WebM, MP3, WAV, etc.)
        Uses ffprobe for accurate duration detection across all audio formats.
        """
        try:
            import subprocess
            import json
            
            # Reset file pointer to beginning
            audio_file.seek(0)
            
            with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                # Write audio file to temp file
                for chunk in audio_file.chunks():
                    temp_file.write(chunk)
                temp_file.flush()
                
                try:
                    # Use ffprobe to get duration (supports WebM, MP3, WAV, etc.)
                    cmd = [
                        'ffprobe', 
                        '-v', 'quiet',
                        '-print_format', 'json',
                        '-show_format',
                        temp_file.name
                    ]
                    
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                    
                    if result.returncode == 0:
                        data = json.loads(result.stdout)
                        duration = float(data['format']['duration'])
                        logger.info(f"[AudioProcessingService] Extracted duration: {duration} seconds using ffprobe")
                        return duration
                    else:
                        logger.error(f"[AudioProcessingService] ffprobe error: {result.stderr}")
                        
                except (subprocess.TimeoutExpired, subprocess.CalledProcessError, KeyError, ValueError, json.JSONDecodeError) as e:
                    logger.warning(f"[AudioProcessingService] ffprobe failed, trying fallback method: {str(e)}")
                
                # Fallback: try wave library for WAV files
                try:
                    import wave
                    with wave.open(temp_file.name, 'rb') as wav_file:
                        frames = wav_file.getnframes()
                        sample_rate = wav_file.getframerate()
                        duration = frames / float(sample_rate)
                        logger.info(f"[AudioProcessingService] Extracted duration: {duration} seconds using wave library")
                        return duration
                except Exception:
                    logger.warning("[AudioProcessingService] Wave library fallback also failed")
                
                finally:
                    # Clean up temp file
                    try:
                        os.unlink(temp_file.name)
                    except OSError:
                        pass
                        
        except Exception as e:
            logger.error(f"[AudioProcessingService] Error getting audio duration: {str(e)}")
        
        return None
    
    @staticmethod
    def validate_audio_format(audio_file):
        allowed_types = [
            'audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a',
            'audio/ogg', 'audio/webm', 'audio/flac'
        ]
        
        # Check content type
        content_type = getattr(audio_file, 'content_type', '')
        logger.info(f"[AudioProcessingService] Validating audio file: size={audio_file.size}, type={content_type}")
        
        if content_type not in allowed_types:
            return False, f"Unsupported audio format: {content_type}"
        
        # Check file size - must be at least 1KB for a valid recording
        min_size = 1024  # 1KB minimum
        if audio_file.size < min_size:
            logger.warning(f"[AudioProcessingService] Audio file too small: {audio_file.size} bytes (minimum: {min_size})")
            return False, f"Audio file too small: {audio_file.size} bytes. Minimum required: {min_size} bytes"
        
        # Check maximum file size - 50MB limit
        max_size = 50 * 1024 * 1024  # 50MB
        if audio_file.size > max_size:
            logger.warning(f"[AudioProcessingService] Audio file too large: {audio_file.size} bytes (maximum: {max_size})")
            return False, f"Audio file too large: {audio_file.size} bytes. Maximum allowed: {max_size} bytes"
        
        logger.info(f"[AudioProcessingService] Audio file validation passed: {audio_file.size} bytes, {content_type}")
        return True, "Valid audio format"


class TextFormattingService:
    """
    Service for intelligent text formatting of transcriptions.
    Converts wall-of-text into readable, properly formatted text with paragraphs.
    """
    
    def __init__(self):
        from django.conf import settings
        self.paragraph_break_seconds = getattr(settings, 'WHISPER_PARAGRAPH_BREAK_SECONDS', 2.0)
        self.max_sentence_length = getattr(settings, 'WHISPER_MAX_SENTENCE_LENGTH', 150)
        self.format_enabled = getattr(settings, 'WHISPER_FORMAT_TEXT', True)
        
    def format_transcription(self, raw_text, segments=None):
        """
        Format raw transcription text into readable paragraphs and sentences.
        
        Args:
            raw_text (str): Raw transcription text from Whisper
            segments (list): Optional segment data with timing information
            
        Returns:
            str: Formatted text with proper paragraphs and sentences
        """
        if not self.format_enabled or not raw_text:
            return raw_text
            
        try:
            logger.info(f"[TextFormattingService] Formatting text: {len(raw_text)} characters")
            
            # If we have segments, use timing-based formatting
            if segments and len(segments) > 0:
                return self._format_with_segments(raw_text, segments)
            else:
                # Fallback to basic text formatting
                return self._format_basic(raw_text)
                
        except Exception as e:
            logger.error(f"[TextFormattingService] Error formatting text: {str(e)}")
            return raw_text  # Return original text if formatting fails
    
    def _format_with_segments(self, raw_text, segments):
        """
        Format text using segment timing data for intelligent paragraph breaks.
        """
        formatted_segments = []
        current_paragraph = []
        
        for i, segment in enumerate(segments):
            segment_text = getattr(segment, 'text', '').strip()
            if not segment_text:
                continue
                
            current_paragraph.append(segment_text)
            
            # Check if we should start a new paragraph
            should_break = False
            
            # Get timing information
            current_end = getattr(segment, 'end', 0)
            next_start = getattr(segments[i + 1], 'start', 0) if i + 1 < len(segments) else 0
            
            # Break if there's a significant pause between segments
            if next_start > 0 and (next_start - current_end) > self.paragraph_break_seconds:
                should_break = True
            
            # Break if current paragraph is getting too long
            current_text = ' '.join(current_paragraph)
            if len(current_text) > self.max_sentence_length * 2:
                should_break = True
            
            # Break at end of segments
            if i == len(segments) - 1:
                should_break = True
            
            if should_break and current_paragraph:
                # Clean and format the paragraph
                paragraph_text = ' '.join(current_paragraph)
                formatted_paragraph = self._clean_paragraph(paragraph_text)
                if formatted_paragraph:
                    formatted_segments.append(formatted_paragraph)
                current_paragraph = []
        
        # Join paragraphs with double newlines
        result = '\n\n'.join(formatted_segments)
        logger.info(f"[TextFormattingService] Formatted into {len(formatted_segments)} paragraphs")
        return result
    
    def _format_basic(self, raw_text):
        """
        Basic text formatting without segment timing data.
        """
        # Split by potential sentence endings and long pauses
        import re
        
        # First, clean up the text
        text = re.sub(r'\s+', ' ', raw_text.strip())
        
        # Split into sentences based on natural breaks
        sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text)
        if not sentences:
            sentences = [text]
        
        # Group sentences into paragraphs
        paragraphs = []
        current_paragraph = []
        current_length = 0
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            current_paragraph.append(sentence)
            current_length += len(sentence)
            
            # Start new paragraph if current one is getting long
            if current_length > self.max_sentence_length * 1.5:
                if current_paragraph:
                    paragraph_text = ' '.join(current_paragraph)
                    formatted_paragraph = self._clean_paragraph(paragraph_text)
                    if formatted_paragraph:
                        paragraphs.append(formatted_paragraph)
                current_paragraph = []
                current_length = 0
        
        # Add final paragraph
        if current_paragraph:
            paragraph_text = ' '.join(current_paragraph)
            formatted_paragraph = self._clean_paragraph(paragraph_text)
            if formatted_paragraph:
                paragraphs.append(formatted_paragraph)
        
        result = '\n\n'.join(paragraphs) if paragraphs else text
        logger.info(f"[TextFormattingService] Basic formatting: {len(paragraphs)} paragraphs")
        return result
    
    def _clean_paragraph(self, text):
        """
        Clean and format a single paragraph.
        """
        if not text:
            return ""
            
        # Remove extra whitespace
        import re
        text = re.sub(r'\s+', ' ', text.strip())
        
        # Ensure paragraph starts with capital letter
        if text and text[0].islower():
            text = text[0].upper() + text[1:]
        
        # Ensure paragraph ends with proper punctuation
        if text and text[-1] not in '.!?':
            text += '.'
        
        return text