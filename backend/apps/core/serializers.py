from rest_framework import serializers

from .models import SupportRequest


class SupportRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportRequest
        fields = (
            'id', 'kind', 'body', 'trace_id', 'status', 'gate_reason',
            'github_issue_number', 'github_issue_url', 'created_at',
        )
        read_only_fields = (
            'id', 'status', 'gate_reason', 'github_issue_number',
            'github_issue_url', 'created_at',
        )

    def validate_body(self, value):
        text = (value or '').strip()
        if not text:
            raise serializers.ValidationError("Please describe the issue or change.")
        if len(text) > 5000:
            raise serializers.ValidationError("Please keep it under 5000 characters.")
        return text
