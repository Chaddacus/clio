import logging
from datetime import timedelta

from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.services import AudioProcessingService, WhisperTranscriptionService
from apps.users.models import UserProfile

from .models import Tag, TranscriptionSegment, VoiceNote
from .serializers import (
    AudioTranscriptionSerializer,
    TagSerializer,
    VoiceNoteCreateSerializer,
    VoiceNoteDetailSerializer,
    VoiceNoteListSerializer,
)

logger = logging.getLogger(__name__)


class VoiceNoteListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'language_detected', 'is_favorite', 'tags']
    search_fields = ['title', 'transcription']
    ordering_fields = ['created_at', 'updated_at', 'title', 'duration']
    ordering = ['-created_at']
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return VoiceNote.objects.filter(user=self.request.user).select_related('user').prefetch_related('tags', 'segments')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return VoiceNoteCreateSerializer
        return VoiceNoteListSerializer

    def create(self, request, *args, **kwargs):
        logger.info(f"[VoiceNoteListCreateView] POST request received from user {request.user}")
        logger.info(f"[VoiceNoteListCreateView] Request data keys: {list(request.data.keys())}")
        logger.info(f"[VoiceNoteListCreateView] Request FILES keys: {list(request.FILES.keys())}")

        if 'audio_file' in request.FILES:
            audio_file_info = request.FILES['audio_file']
            logger.info(f"[VoiceNoteListCreateView] Audio file received: {audio_file_info.name}, size: {audio_file_info.size}, type: {audio_file_info.content_type}")
        else:
            logger.error("[VoiceNoteListCreateView] No audio_file found in request.FILES")

        serializer = self.get_serializer(data=request.data)

        if not serializer.is_valid():
            logger.error(f"[VoiceNoteListCreateView] Serializer validation failed: {serializer.errors}")
            raise serializers.ValidationError(serializer.errors)

        logger.info("[VoiceNoteListCreateView] Serializer validation passed")
        audio_file = serializer.validated_data['audio_file']

        logger.info(f"[VoiceNoteListCreateView] Validating audio format for file: {audio_file.name}")
        is_valid, message = AudioProcessingService.validate_audio_format(audio_file)
        if not is_valid:
            logger.error(f"[VoiceNoteListCreateView] Audio format validation failed: {message}")
            return Response({
                'success': False,
                'message': message,
                'errors': {'audio_file': [message]}
            }, status=status.HTTP_400_BAD_REQUEST)

        logger.info("[VoiceNoteListCreateView] Audio format validation passed, saving voice note")
        voice_note = serializer.save()
        logger.info(f"[VoiceNoteListCreateView] Voice note saved with id: {voice_note.id}")

        try:
            logger.info(f"[VoiceNoteListCreateView] Starting transcription process for voice note {voice_note.id}")
            self._process_transcription(voice_note)

            logger.info(f"[VoiceNoteListCreateView] Transcription process completed for voice note {voice_note.id}")
            return Response({
                'success': True,
                'message': 'Voice note created successfully. Transcription in progress.',
                'data': VoiceNoteDetailSerializer(voice_note, context={'request': request}).data
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Error processing voice note {voice_note.id}: {str(e)}", exc_info=True)
            voice_note.status = 'failed'
            voice_note.error_message = str(e)
            voice_note.save()

            return Response({
                'success': False,
                'message': 'Voice note created but transcription failed',
                'errors': {'transcription': ['Transcription service error. Please try again.']},
                'data': VoiceNoteDetailSerializer(voice_note, context={'request': request}).data
            }, status=status.HTTP_201_CREATED)

    def _process_transcription(self, voice_note):
        logger.info(f"[_process_transcription] Starting transcription for voice note {voice_note.id}")

        try:
            transcription_service = WhisperTranscriptionService()
            logger.info("[_process_transcription] WhisperTranscriptionService initialized")
        except Exception as e:
            logger.error(f"[_process_transcription] Failed to initialize WhisperTranscriptionService: {str(e)}")
            raise e

        logger.info(f"[_process_transcription] Getting audio duration for voice note {voice_note.id}")
        duration = AudioProcessingService.get_audio_duration(voice_note.audio_file)
        if duration:
            logger.info(f"[_process_transcription] Audio duration: {duration} seconds")
            voice_note.duration = timedelta(seconds=duration)
        else:
            logger.warning("[_process_transcription] Could not determine audio duration")

        logger.info(f"[_process_transcription] Starting transcription API call for voice note {voice_note.id}")
        result = transcription_service.transcribe_audio(voice_note.audio_file)
        logger.info(f"[_process_transcription] Transcription result for voice note {voice_note.id}: success={result['success']}")

        if result['success']:
            logger.info(f"[_process_transcription] Transcription successful, updating voice note {voice_note.id}")
            voice_note.transcription = result['text']
            voice_note.language_detected = result['language']
            voice_note.confidence_score = result['confidence_score']
            voice_note.status = 'completed'

            if not voice_note.title or voice_note.title == 'Untitled':
                words = result['text'].split()[:8]
                voice_note.title = ' '.join(words) + ('...' if len(words) == 8 else '')
                logger.info(f"[_process_transcription] Generated title for voice note {voice_note.id}: {voice_note.title}")

            logger.info(f"[_process_transcription] Creating segments for voice note {voice_note.id}")
            self._create_segments(voice_note, result['segments'])

        else:
            logger.error(f"[_process_transcription] Transcription failed for voice note {voice_note.id}: {result['error']}")
            voice_note.status = 'failed'
            voice_note.error_message = result['error']

        logger.info(f"[_process_transcription] Saving voice note {voice_note.id} with status: {voice_note.status}")
        voice_note.save()

        logger.info(f"[_process_transcription] Updating user storage for voice note {voice_note.id}")
        self._update_user_storage(voice_note.user, voice_note.file_size_bytes)

        logger.info(f"[_process_transcription] Transcription process completed for voice note {voice_note.id}")

    def _create_segments(self, voice_note, segments):
        segment_objects = []
        logger.info(f"[_create_segments] Processing {len(segments)} segments for voice note {voice_note.id}")

        for i, segment_data in enumerate(segments):
            try:
                # OpenAI returns segment objects, not dictionaries
                start_time = getattr(segment_data, 'start', 0)
                end_time = getattr(segment_data, 'end', 0)
                text = getattr(segment_data, 'text', '')
                confidence = getattr(segment_data, 'avg_logprob', None)

                logger.debug(f"[_create_segments] Segment {i}: start={start_time}, end={end_time}, text_length={len(text)}")

                segment_objects.append(TranscriptionSegment(
                    voice_note=voice_note,
                    start_time=start_time,
                    end_time=end_time,
                    text=text,
                    confidence=confidence
                ))
            except Exception as segment_error:
                logger.error(f"[_create_segments] Error processing segment {i}: {str(segment_error)}")
                continue

        if segment_objects:
            logger.info(f"[_create_segments] Creating {len(segment_objects)} segment objects in database")
            TranscriptionSegment.objects.bulk_create(segment_objects)
        else:
            logger.warning(f"[_create_segments] No valid segments to create for voice note {voice_note.id}")

    def _update_user_storage(self, user, file_size_bytes):
        try:
            with transaction.atomic():
                profile = UserProfile.objects.select_for_update().get(user=user)
                profile.storage_used_mb += file_size_bytes / (1024 * 1024)
                profile.save(update_fields=['storage_used_mb'])
        except UserProfile.DoesNotExist:
            pass


class VoiceNoteDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = VoiceNoteDetailSerializer

    def get_queryset(self):
        return VoiceNote.objects.filter(user=self.request.user).select_related('user').prefetch_related('tags', 'segments')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        file_size_bytes = instance.file_size_bytes

        self.perform_destroy(instance)

        self._update_user_storage_on_delete(request.user, file_size_bytes)

        return Response({
            'success': True,
            'message': 'Voice note deleted successfully'
        }, status=status.HTTP_200_OK)

    def _update_user_storage_on_delete(self, user, file_size_bytes):
        try:
            with transaction.atomic():
                profile = UserProfile.objects.select_for_update().get(user=user)
                profile.storage_used_mb = max(0, profile.storage_used_mb - (file_size_bytes / (1024 * 1024)))
                profile.save(update_fields=['storage_used_mb'])
        except UserProfile.DoesNotExist:
            pass


class TagListCreateView(generics.ListCreateAPIView):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Tag.objects.all().order_by('name')


class TagDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]
    queryset = Tag.objects.all()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def transcribe_audio(request):
    serializer = AudioTranscriptionSerializer(data=request.data)

    if not serializer.is_valid():
        return Response({
            'success': False,
            'message': 'Invalid data',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    audio_file = serializer.validated_data['audio_file']
    language = serializer.validated_data.get('language', 'auto')

    is_valid, message = AudioProcessingService.validate_audio_format(audio_file)
    if not is_valid:
        return Response({
            'success': False,
            'message': message,
            'errors': {'audio_file': [message]}
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        transcription_service = WhisperTranscriptionService()
        result = transcription_service.transcribe_audio(audio_file, language)

        if result['success']:
            return Response({
                'success': True,
                'data': {
                    'transcription': result['text'],
                    'language': result['language'],
                    'duration': result['duration'],
                    'confidence': result['confidence_score']
                }
            })
        else:
            return Response({
                'success': False,
                'message': 'Transcription failed',
                'errors': {'transcription': [result['error']]}
            }, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"Transcription API error: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'message': 'Internal transcription error',
            'errors': {'transcription': ['An unexpected error occurred. Please try again.']}
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def retranscribe_voice_note(request, pk):
    """Re-transcribe an existing voice note with a new language option."""
    try:
        note = VoiceNote.objects.filter(user=request.user, id=pk).first()
        if not note:
            return Response({
                'success': False,
                'message': 'Voice note not found'
            }, status=status.HTTP_404_NOT_FOUND)

        if not note.audio_file:
            return Response({
                'success': False,
                'message': 'No audio file found for this note'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get language from request data (default to auto)
        language = request.data.get('language', 'auto')

        logger.info(f"Re-transcribing voice note {pk} for user {request.user} with language {language}")

        # Set status to processing
        note.status = 'processing'
        note.error_message = ""
        note.save()

        try:
            # Use existing transcription service
            transcription_service = WhisperTranscriptionService()
            result = transcription_service.transcribe_audio(note.audio_file, language)

            if result['success']:
                # Update note with new transcription
                note.transcription = result['text']
                note.language_detected = result['language']
                note.confidence_score = result.get('confidence_score')
                note.status = 'completed'
                note.error_message = ""
                note.save()

                # Clear existing segments and create new ones if provided
                note.segments.all().delete()
                if result.get('segments'):
                    segment_objects = []
                    for i, segment_data in enumerate(result['segments']):
                        try:
                            # OpenAI returns segment objects, not dictionaries - use getattr
                            start_time = getattr(segment_data, 'start', 0)
                            end_time = getattr(segment_data, 'end', 0)
                            text = getattr(segment_data, 'text', '')
                            confidence = getattr(segment_data, 'avg_logprob', None)

                            segment_objects.append(TranscriptionSegment(
                                voice_note=note,
                                start_time=start_time,
                                end_time=end_time,
                                text=text,
                                confidence=confidence
                            ))
                        except Exception as segment_error:
                            logger.error(f"[retranscribe] Error processing segment {i}: {str(segment_error)}")
                            continue

                    if segment_objects:
                        logger.info(f"[retranscribe] Creating {len(segment_objects)} segment objects for note {pk}")
                        TranscriptionSegment.objects.bulk_create(segment_objects)

                logger.info(f"Successfully re-transcribed voice note {pk}")
                return Response({
                    'success': True,
                    'message': 'Re-transcription completed successfully',
                    'data': VoiceNoteDetailSerializer(note).data
                })
            else:
                # Transcription failed
                note.status = 'failed'
                note.error_message = result.get('error', 'Re-transcription failed')
                note.save()

                logger.error(f"Re-transcription failed for voice note {pk}: {result.get('error')}")
                return Response({
                    'success': False,
                    'message': 'Re-transcription failed',
                    'errors': {'transcription': [result.get('error', 'Unknown error')]}
                }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            # Handle transcription service errors
            note.status = 'failed'
            note.error_message = f"Re-transcription error: {str(e)}"
            note.save()

            logger.error(f"Re-transcription service error for voice note {pk}: {str(e)}", exc_info=True)
            return Response({
                'success': False,
                'message': 'Internal re-transcription error',
                'errors': {'transcription': ['An unexpected error occurred. Please try again.']}
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except Exception as e:
        logger.error(f"Retranscribe API error: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'message': 'Internal server error',
            'errors': {'general': ['An unexpected error occurred.']}
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_stats(request):
    user = request.user
    voice_notes = VoiceNote.objects.filter(user=user)

    stats = {
        'total_notes': voice_notes.count(),
        'completed_notes': voice_notes.filter(status='completed').count(),
        'processing_notes': voice_notes.filter(status='processing').count(),
        'failed_notes': voice_notes.filter(status='failed').count(),
        'favorite_notes': voice_notes.filter(is_favorite=True).count(),
        'total_duration_seconds': sum([
            (note.duration.total_seconds() if note.duration else 0)
            for note in voice_notes
        ]),
        'languages_used': list(voice_notes.values_list('language_detected', flat=True).distinct()),
    }

    try:
        profile = user.userprofile
        stats.update({
            'storage_used_mb': profile.storage_used_mb,
            'storage_quota_mb': profile.storage_quota_mb,
            'storage_percentage': round((profile.storage_used_mb / profile.storage_quota_mb) * 100, 1)
        })
    except UserProfile.DoesNotExist:
        stats.update({
            'storage_used_mb': 0,
            'storage_quota_mb': 1000,
            'storage_percentage': 0
        })

    return Response({
        'success': True,
        'data': stats
    })
