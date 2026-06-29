from django.contrib import admin

from .models import SupportRequest


@admin.register(SupportRequest)
class SupportRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'kind', 'status', 'github_issue_number', 'created_at')
    list_filter = ('status', 'kind', 'created_at')
    search_fields = ('body', 'user__username', 'trace_id', 'github_issue_url')
    readonly_fields = ('created_at', 'updated_at')
