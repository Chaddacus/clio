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

from apps.core.middleware import get_request_id
from apps.core.services import AudioProcessingService, get_transcription_service
from apps.translations.services import invalidate_translations_for_note
from apps.users.models import UserProfile

from .models import Folder, Speaker, Tag, TranscriptionSegment, VoiceNote
from .serializers import (
    AudioTranscriptionSerializer,
    FolderSerializer,
    SpeakerSerializer,
    TagSerializer,
    VoiceNoteCreateSerializer,
    VoiceNoteDetailSerializer,
    VoiceNoteListSerializer,
)

logger = logging.getLogger(__name__)


def create_segments_for_note(voice_note: VoiceNote, segments: list) -> None:
    """Bulk-create TranscriptionSegment rows from a transcription result.

    Works for both providers: Whisper segments expose ``avg_logprob`` and no
    speaker, Deepgram segments expose ``confidence`` and a ``speaker`` label.
    After persisting segments, the speaker roster is re-synced from the
    distinct labels so diarized speakers can be renamed.
    """
    segment_objects = []
    for segment_data in segments:
        try:
            confidence = getattr(segment_data, 'confidence', None)
            if confidence is None:
                confidence = getattr(segment_data, 'avg_logprob', None)
            segment_objects.append(TranscriptionSegment(
                voice_note=voice_note,
                start_time=getattr(segment_data, 'start', 0),
                end_time=getattr(segment_data, 'end', 0),
                text=getattr(segment_data, 'text', ''),
                confidence=confidence,
                speaker_id=getattr(segment_data, 'speaker', '') or '',
            ))
        except Exception:
            logger.warning("Skipping malformed segment", exc_info=True)
            continue
    if segment_objects:
        TranscriptionSegment.objects.bulk_create(segment_objects)
    _sync_speakers_for_note(voice_note)


def _sync_speakers_for_note(voice_note: VoiceNote) -> None:
    """Rebuild the note's Speaker roster from the distinct segment labels.

    Idempotent: clears existing speakers and recreates one row per distinct
    label, defaulting the display name to the label. Preserves no prior renames
    because it only runs on (re)transcription, when segments are rewritten.
    """
    # set() dedupes in Python: a queryset .distinct() is defeated by the model's
    # default ordering ('start_time'), which DISTINCT would fold into the key.
    labels = sorted(set(
        voice_note.segments.exclude(speaker_id='').values_list('speaker_id', flat=True)
    ))
    voice_note.speakers.all().delete()
    if labels:
        Speaker.objects.bulk_create([
            Speaker(voice_note=voice_note, label=label, name=label) for label in labels
        ])


def _update_storage(user: Any, delta_bytes: int) -> None:
    """Atomically adjust a user's storage_used_mb."""
    try:
        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=user)
            profile.storage_used_mb = max(Decimal('0'), profile.storage_used_mb + Decimal(str(delta_bytes)) / Decimal('1048576'))
            profile.save(update_fields=['storage_used_mb'])
    except UserProfile.DoesNotExist:
        logger.warning("UserProfile not found for user %s", user.id)


class VoiceNoteListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'language_detected', 'is_favorite', 'tags', 'folder']
    search_fields = ['title', 'transcription']
    ordering_fields = ['created_at', 'updated_at', 'title', 'duration']
    ordering = ['-created_at']
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        qs = VoiceNote.objects.filter(
            user=self.request.user
        ).select_related('user', 'folder').prefetch_related('tags', 'segments')
        # `?folder=<id>` is handled by the filterset; null can't be expressed as
        # an exact match, so `?unfiled=true` selects notes with no folder.
        if self.request.query_params.get('unfiled') == 'true':
            qs = qs.filter(folder__isnull=True)
        return qs

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

        # Carry the request's trace id through to the async task so the whole
        # lifecycle (HTTP request -> task -> Deepgram) shares one correlation id.
        trace_id = get_request_id()
        if trace_id:
            voice_note.trace_id = trace_id
            voice_note.save(update_fields=['trace_id'])

        # Dispatch transcription to Celery worker (non-blocking)
        from .tasks import transcribe_voice_note_task
        transcribe_voice_note_task.delay(voice_note.id, trace_id=trace_id)

        logger.info("Voice note %d created, transcription dispatched (trace_id=%s)", voice_note.id, trace_id)
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
        ).select_related('user').prefetch_related('tags', 'segments', 'speakers')

    def perform_update(self, serializer):
        # A manual transcript edit invalidates stored translations: they were
        # derived from the previous text (translations public contract).
        instance = serializer.instance
        new_text = serializer.validated_data.get('transcription')
        text_changed = new_text is not None and new_text != instance.transcription
        serializer.save()
        if text_changed:
            invalidate_translations_for_note(instance.id)

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
        return Tag.objects.filter(user=self.request.user).order_by('name')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TagDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Tag.objects.filter(user=self.request.user)


class FolderListCreateView(generics.ListCreateAPIView):
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None  # small per-user list; return a flat array for the sidebar

    def get_queryset(self):
        return Folder.objects.filter(user=self.request.user).select_related('parent')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class FolderDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Folder.objects.filter(user=self.request.user)


class SpeakerDetailView(generics.RetrieveUpdateAPIView):
    """Rename a diarized speaker. Scoped to speakers of the user's own notes;
    a foreign speaker id resolves to 404. Only the display name is editable.
    """
    serializer_class = SpeakerSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        return Speaker.objects.filter(voice_note__user=self.request.user)


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
        transcription_service = get_transcription_service()
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
        trace_id = get_request_id()
        if trace_id:
            note.trace_id = trace_id
        note.save()

        # Dispatch retranscription to Celery worker (non-blocking)
        from .tasks import retranscribe_voice_note_task
        retranscribe_voice_note_task.delay(note.id, language, trace_id=trace_id)

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
            'storage_percentage': (
                round(float(profile.storage_used_mb) / profile.storage_quota_mb * 100, 1)
                if profile.storage_quota_mb else 0
            ),
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
