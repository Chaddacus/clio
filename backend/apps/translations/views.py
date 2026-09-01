"""REST adapter for the translations module.

POST /api/notes/<id>/translations/  {target_language}  -> 202 pending (or 200 existing)
GET  /api/notes/<id>/translations/                      -> {enabled, data: [...]}

Authorization is by ownership of the note; a foreign note is a 404, never a
403, so note ids are not enumerable across users (same rule as the rest of
the API).
"""
import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.middleware import get_request_id
from apps.voice_notes.models import VoiceNote

from .models import NoteTranslation
from .serializers import NoteTranslationSerializer, TranslationRequestSerializer
from .services import is_translation_configured

logger = logging.getLogger(__name__)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def note_translations(request, pk):
    note = VoiceNote.objects.filter(user=request.user, id=pk).first()
    if not note:
        return Response({'success': False, 'message': 'Voice note not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        rows = NoteTranslation.objects.filter(voice_note=note)
        return Response({
            'success': True,
            # Tells the UI whether the server can translate at all, so it can hide the control.
            'enabled': is_translation_configured(),
            'data': NoteTranslationSerializer(rows, many=True).data,
        })

    if not is_translation_configured():
        return Response({
            'success': False,
            'message': 'Translation is not enabled on this server.',
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    serializer = TranslationRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'success': False, 'message': 'Invalid data', 'errors': serializer.errors},
                        status=status.HTTP_400_BAD_REQUEST)
    target = serializer.validated_data['target_language']

    if note.status != 'completed' or not note.transcription.strip():
        return Response({
            'success': False,
            'message': 'The note must be transcribed before it can be translated.',
        }, status=status.HTTP_400_BAD_REQUEST)
    if target == note.language_detected:
        return Response({
            'success': False,
            'message': 'The note is already in that language.',
            'errors': {'target_language': ['Target matches the detected language']},
        }, status=status.HTTP_400_BAD_REQUEST)

    translation, created = NoteTranslation.objects.get_or_create(voice_note=note, target_language=target)
    if not created and translation.status == 'completed':
        return Response({'success': True, 'data': NoteTranslationSerializer(translation).data})
    if not created and translation.status == 'pending':
        return Response({'success': True, 'message': 'Translation in progress.',
                         'data': NoteTranslationSerializer(translation).data},
                        status=status.HTTP_202_ACCEPTED)

    # new, or failed -> retry
    translation.status = 'pending'
    translation.error_message = ''
    translation.save(update_fields=['status', 'error_message', 'updated_at'])

    from .tasks import translate_voice_note_task
    trace_id = get_request_id()
    translate_voice_note_task.delay(translation.id, trace_id=trace_id)
    logger.info("Translation %d dispatched for note %d -> %s", translation.id, note.id, target)
    return Response({'success': True, 'message': 'Translation in progress.',
                     'data': NoteTranslationSerializer(translation).data},
                    status=status.HTTP_202_ACCEPTED)
