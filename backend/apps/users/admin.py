from django.contrib import admin
from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'preferred_language', 'audio_quality', 'storage_used_mb', 'storage_quota_mb', 'created_at')
    list_filter = ('preferred_language', 'audio_quality', 'created_at')
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('User Information', {
            'fields': ('user',)
        }),
        ('Preferences', {
            'fields': ('preferred_language', 'audio_quality')
        }),
        ('Storage', {
            'fields': ('storage_quota_mb', 'storage_used_mb')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )