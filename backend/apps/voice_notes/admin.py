from django.contrib import admin

from .models import Tag, TranscriptionSegment, VoiceNote


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('name', 'color', 'created_at')
    search_fields = ('name',)
    readonly_fields = ('created_at',)


class TranscriptionSegmentInline(admin.TabularInline):
    model = TranscriptionSegment
    extra = 0
    readonly_fields = ('duration',)


@admin.register(VoiceNote)
class VoiceNoteAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'status', 'language_detected', 'file_size_mb', 'duration', 'created_at')
    list_filter = ('status', 'language_detected', 'is_favorite', 'created_at', 'tags')
    search_fields = ('title', 'transcription', 'user__username')
    readonly_fields = ('file_size_bytes', 'file_size_mb', 'created_at', 'updated_at')
    filter_horizontal = ('tags',)
    inlines = [TranscriptionSegmentInline]

    fieldsets = (
        ('Basic Information', {
            'fields': ('user', 'title', 'status', 'is_favorite')
        }),
        ('Audio File', {
            'fields': ('audio_file', 'duration', 'file_size_bytes', 'file_size_mb')
        }),
        ('Transcription', {
            'fields': ('transcription', 'language_detected', 'confidence_score')
        }),
        ('Categorization', {
            'fields': ('tags',)
        }),
        ('Error Handling', {
            'fields': ('error_message',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user').prefetch_related('tags')


@admin.register(TranscriptionSegment)
class TranscriptionSegmentAdmin(admin.ModelAdmin):
    list_display = ('voice_note', 'start_time', 'end_time', 'duration', 'speaker_id', 'confidence')
    list_filter = ('voice_note__language_detected', 'speaker_id')
    search_fields = ('text', 'voice_note__title')
    readonly_fields = ('duration',)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('voice_note__user')
