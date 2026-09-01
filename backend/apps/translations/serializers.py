from rest_framework import serializers

from .models import TARGET_LANGUAGE_CHOICES, NoteTranslation


class NoteTranslationSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoteTranslation
        fields = (
            'id', 'voice_note', 'target_language', 'source_language', 'status', 'text',
            'segments', 'error_message', 'model', 'prompt_version', 'created_at', 'updated_at',
        )
        read_only_fields = fields


class TranslationRequestSerializer(serializers.Serializer):
    target_language = serializers.ChoiceField(choices=TARGET_LANGUAGE_CHOICES)
