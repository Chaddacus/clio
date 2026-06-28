from rest_framework import serializers

from .models import Folder, Tag, TranscriptionSegment, VoiceNote


class UserScopedTagField(serializers.PrimaryKeyRelatedField):
    """tag_ids must resolve only to tags owned by the requesting user.

    Using an unscoped Tag.objects.all() queryset lets a user attach another
    user's tag (enumerable id) to their note — an IDOR. Scoping the queryset to
    request.user makes a foreign tag id resolve to "does not exist".
    """

    def get_queryset(self):
        request = self.context.get('request', None)
        if request is None or not request.user.is_authenticated:
            return Tag.objects.none()
        return Tag.objects.filter(user=request.user)


class UserScopedFolderField(serializers.PrimaryKeyRelatedField):
    """A folder reference must resolve only to a folder owned by the user.

    Same IDOR guard as UserScopedTagField: scoping the queryset to request.user
    makes a foreign folder id resolve to "does not exist".
    """

    def get_queryset(self):
        request = self.context.get('request', None)
        if request is None or not request.user.is_authenticated:
            return Folder.objects.none()
        return Folder.objects.filter(user=request.user)


class FolderSerializer(serializers.ModelSerializer):
    parent = UserScopedFolderField(allow_null=True, required=False)

    class Meta:
        model = Folder
        fields = ('id', 'name', 'color', 'parent', 'created_at')
        read_only_fields = ('id', 'created_at')

    def validate_parent(self, value):
        # Enforce a single level of nesting: a parent cannot itself be nested.
        if value is not None and value.parent_id is not None:
            raise serializers.ValidationError("Sub-folders can only be one level deep.")
        # A folder cannot be its own parent (on update).
        if self.instance is not None and value is not None and value.pk == self.instance.pk:
            raise serializers.ValidationError("A folder cannot be its own parent.")
        return value


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ('id', 'name', 'color', 'created_at')
        read_only_fields = ('id', 'created_at')


class TranscriptionSegmentSerializer(serializers.ModelSerializer):
    duration = serializers.ReadOnlyField()

    class Meta:
        model = TranscriptionSegment
        fields = ('id', 'start_time', 'end_time', 'duration', 'text', 'confidence', 'speaker_id')
        read_only_fields = ('id', 'duration')


class VoiceNoteListSerializer(serializers.ModelSerializer):
    tags = TagSerializer(many=True, read_only=True)
    file_size_mb = serializers.ReadOnlyField()
    username = serializers.CharField(source='user.username', read_only=True)
    audio_file = serializers.FileField(read_only=True)
    audio_url = serializers.SerializerMethodField()
    transcription_text = serializers.CharField(source='transcription', read_only=True)
    transcription_confidence = serializers.FloatField(source='confidence_score', read_only=True)
    folder = serializers.PrimaryKeyRelatedField(read_only=True)
    folder_name = serializers.CharField(source='folder.name', read_only=True, default=None)

    class Meta:
        model = VoiceNote
        fields = (
            'id', 'title', 'username', 'status', 'duration', 'file_size_mb',
            'language_detected', 'confidence_score', 'is_favorite', 'audio_file', 'audio_url',
            'transcription_text', 'transcription_confidence',
            'tags', 'folder', 'folder_name', 'created_at', 'updated_at'
        )
        read_only_fields = (
            'id', 'username', 'file_size_mb', 'language_detected', 'audio_file', 'audio_url',
            'confidence_score', 'transcription_text', 'transcription_confidence',
            'folder', 'folder_name', 'created_at', 'updated_at'
        )

    def get_audio_url(self, obj):
        """Generate the proper audio URL using our custom audio serving endpoint."""
        if obj.audio_file:
            request = self.context.get('request')
            if request:
                # Use the custom media serving endpoint with proper MIME types
                return request.build_absolute_uri(obj.audio_file.url)
        return None


class VoiceNoteDetailSerializer(serializers.ModelSerializer):
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = UserScopedTagField(
        many=True,
        write_only=True,
        required=False
    )
    segments = TranscriptionSegmentSerializer(many=True, read_only=True)
    file_size_mb = serializers.ReadOnlyField()
    username = serializers.CharField(source='user.username', read_only=True)
    audio_url = serializers.SerializerMethodField()
    folder = UserScopedFolderField(allow_null=True, required=False)
    folder_name = serializers.CharField(source='folder.name', read_only=True, default=None)

    class Meta:
        model = VoiceNote
        fields = (
            'id', 'title', 'transcription', 'username', 'audio_file', 'audio_url',
            'duration', 'file_size_mb', 'language_detected', 'confidence_score',
            'status', 'error_message', 'is_favorite', 'tags', 'tag_ids',
            'folder', 'folder_name', 'segments',
            'created_at', 'updated_at'
        )
        read_only_fields = (
            'id', 'username', 'file_size_mb', 'language_detected',
            'confidence_score', 'status', 'error_message', 'segments',
            'created_at', 'updated_at', 'audio_url'
        )

    def get_audio_url(self, obj):
        """Generate the proper audio URL using our custom audio serving endpoint."""
        if obj.audio_file:
            request = self.context.get('request')
            if request:
                # Use the custom media serving endpoint with proper MIME types
                return request.build_absolute_uri(obj.audio_file.url)
        return None

    def update(self, instance, validated_data):
        tag_ids = validated_data.pop('tag_ids', [])

        instance = super().update(instance, validated_data)

        if tag_ids:
            instance.tags.set(tag_ids)

        return instance


class VoiceNoteCreateSerializer(serializers.ModelSerializer):
    tag_ids = UserScopedTagField(
        many=True,
        required=False
    )
    folder = UserScopedFolderField(allow_null=True, required=False)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)

    class Meta:
        model = VoiceNote
        fields = ('audio_file', 'title', 'tag_ids', 'folder')

    def validate_audio_file(self, value):
        if not value:
            raise serializers.ValidationError("Audio file is required")

        max_size = 50 * 1024 * 1024  # 50MB
        if value.size > max_size:
            raise serializers.ValidationError(f"Audio file too large. Max size: {max_size // (1024*1024)}MB")

        return value

    def create(self, validated_data):
        tag_ids = validated_data.pop('tag_ids', [])
        validated_data['user'] = self.context['request'].user

        voice_note = super().create(validated_data)

        if tag_ids:
            voice_note.tags.set(tag_ids)

        return voice_note


class AudioTranscriptionSerializer(serializers.Serializer):
    audio_file = serializers.FileField()
    language = serializers.ChoiceField(
        choices=VoiceNote.LANGUAGE_CHOICES,
        default='auto'
    )

    def validate_audio_file(self, value):
        if not value:
            raise serializers.ValidationError("Audio file is required")

        max_size = 50 * 1024 * 1024  # 50MB
        if value.size > max_size:
            raise serializers.ValidationError(f"Audio file too large. Max size: {max_size // (1024*1024)}MB")

        return value
