import logging
from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.db.models import Sum
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


def create_segments_for_note(voice_note: VoiceNote, segments: list) -> None:
    """Shared helper to bulk-create TranscriptionSegment objects from OpenAI response."""
    segment_objects = []
    for segment_data in segments:
        try:
            segment_objects.append(TranscriptionSegment(
                voice_note=voice_note,
                start_time=getattr(segment_data, 'start', 0),
                end_time=getattr(segment_data, 'end', 0),
                text=getattr(segment_data, 'text', ''),
                confidence=getattr(segment_data, 'avg_logprob', None),
            ))
        except Exception:
            continue
    if segment_objects:
        TranscriptionSegment.objects.bulk_create(segment_objects)


def _update_storage(user: Any, delta_bytes: int) -> None:
    """Atomically adjust a user's storage_used_mb."""
    try:
        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=user)
            profile.storage_used_mb = max(Decimal('0'), profile.storage_used_mb + Decimal(str(delta_bytes)) / Decimal('1048576'))
            profile.save(update_fields=['storage_used_mb'])
    except UserProfile.DoesNotExist:
        pass


class VoiceNoteListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'language_detected', 'is_favorite', 'tags']
    search_fields = ['title', 'transcription']
    ordering_fields = ['created_at', 'updated_at', 'title', 'duration']
    ordering = ['-created_at']
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return VoiceNote.objects.filter(
            user=self.request.user
        ).select_related('user').prefetch_related('tags', 'segments')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return VoiceNoteCreateSerializer
        return VoiceNoteListSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            raise serializers.ValidationError(serializer.errors)

        audio_file = serializer.validated_data['audio_file']
        is_valid, message = AudioProcessingService.validate_audio_format(audio_file)
        if not is_valid:
            return Response({
                'success': False,
                'message': message,
                'errors': {'audio_file': [message]},
            }, status=status.HTTP_400_BAD_REQUEST)

        voice_note = serializer.save()

        # Dispatch transcription to Celery worker (non-blocking)
        from .tasks import transcribe_voice_note_task
        transcribe_voice_note_task.delay(voice_note.id)

        logger.info("Voice note %d created, transcription dispatched", voice_note.id)
        return Response({
            'success': True,
            'message': 'Voice note created. Transcription in progress.',
            'data': VoiceNoteDetailSerializer(voice_note, context={'request': request}).data,
        }, status=status.HTTP_202_ACCEPTED)


class VoiceNoteDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = VoiceNoteDetailSerializer

    def get_queryset(self):
        return VoiceNote.objects.filter(
            user=self.request.user
        ).select_related('user').prefetch_related('tags', 'segments')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        file_size_bytes = instance.file_size_bytes
        self.perform_destroy(instance)
        _update_storage(request.user, -file_size_bytes)
        return Response({
            'success': True,
            'message': 'Voice note deleted successfully',
        }, status=status.HTTP_200_OK)


class TagListCreateView(generics.ListCreateAPIView):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Tag.objects.filter(
            voice_notes__user=self.request.user
        ).distinct().order_by('name')


class TagDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Tag.objects.filter(
            voice_notes__user=self.request.user
        ).distinct()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def transcribe_audio(request):
    serializer = AudioTranscriptionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({
            'success': False,
            'message': 'Invalid data',
            'errors': serializer.errors,
        }, status=status.HTTP_400_BAD_REQUEST)

    audio_file = serializer.validated_data['audio_file']
    language = serializer.validated_data.get('language', 'auto')

    is_valid, message = AudioProcessingService.validate_audio_format(audio_file)
    if not is_valid:
        return Response({
            'success': False,
            'message': message,
            'errors': {'audio_file': [message]},
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
                    'confidence': result['confidence_score'],
                },
            })
        return Response({
            'success': False,
            'message': 'Transcription failed',
            'errors': {'transcription': [result['error']]},
        }, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error("Transcription API error: %s", e, exc_info=True)
        return Response({
            'success': False,
            'message': 'Internal transcription error',
            'errors': {'transcription': ['An unexpected error occurred. Please try again.']},
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
                'message': 'Voice note not found',
            }, status=status.HTTP_404_NOT_FOUND)

        language = request.data.get('language', 'auto')
        valid_languages = dict(VoiceNote.LANGUAGE_CHOICES)
        if language not in valid_languages:
            return Response({
                'success': False,
                'message': f'Invalid language. Must be one of: {", ".join(valid_languages.keys())}',
                'errors': {'language': [f'Invalid language: {language}']},
            }, status=status.HTTP_400_BAD_REQUEST)

        if not note.audio_file:
            return Response({
                'success': False,
                'message': 'No audio file found for this note',
            }, status=status.HTTP_400_BAD_REQUEST)

        note.status = 'processing'
        note.error_message = ""
        note.save()

        # Dispatch retranscription to Celery worker (non-blocking)
        from .tasks import retranscribe_voice_note_task
        retranscribe_voice_note_task.delay(note.id, language)

        logger.info("Re-transcription dispatched for note %d", pk)
        return Response({
            'success': True,
            'message': 'Re-transcription in progress.',
            'data': VoiceNoteDetailSerializer(note).data,
        }, status=status.HTTP_202_ACCEPTED)

    except Exception as e:
        logger.error("Retranscribe API error: %s", e, exc_info=True)
        return Response({
            'success': False,
            'message': 'Internal server error',
            'errors': {'general': ['An unexpected error occurred.']},
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
        'total_duration_seconds': (
            voice_notes.aggregate(total=Sum('duration'))['total'] or timedelta()
        ).total_seconds(),
        'languages_used': list(voice_notes.values_list('language_detected', flat=True).distinct()),
    }

    try:
        profile = user.userprofile
        stats.update({
            'storage_used_mb': float(profile.storage_used_mb),
            'storage_quota_mb': profile.storage_quota_mb,
            'storage_percentage': round(float(profile.storage_used_mb) / profile.storage_quota_mb * 100, 1),
        })
    except UserProfile.DoesNotExist:
        stats.update({
            'storage_used_mb': 0,
            'storage_quota_mb': 1000,
            'storage_percentage': 0,
        })

    return Response({
        'success': True,
        'data': stats,
    })
