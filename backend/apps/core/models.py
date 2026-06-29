from django.conf import settings
from django.db import models


class SupportRequest(models.Model):
    """A user-submitted change request / bug report.

    This is the entry point of the self-heal loop: a sufficiently-detailed
    request is turned into a `codex`-labelled GitHub issue that the agent
    pipeline grounds, plans, implements, tests, and (via the supervisor gate)
    ships. The row tracks that lifecycle from the user's side.
    """

    KIND_CHOICES = [
        ('bug', 'Something is broken'),
        ('change', 'Change how something works'),
        ('feature', 'New capability'),
    ]
    STATUS_CHOICES = [
        ('needs_detail', 'Needs more detail'),   # bounced by the sufficiency gate
        ('submitted', 'Submitted'),              # passed the gate, awaiting issue
        ('issue_created', 'Issue created'),      # codex-labelled GitHub issue open
        ('in_progress', 'Codex working'),
        ('shipped', 'Shipped'),
        ('rejected', 'Rejected'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='support_requests'
    )
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default='bug')
    body = models.TextField()
    # Optional correlation to a specific note's end-to-end trace, so the agent
    # can pull the exact logs for the failure the user is describing.
    trace_id = models.CharField(max_length=64, blank=True, default='')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='submitted')
    gate_reason = models.TextField(blank=True, default='')

    github_issue_number = models.IntegerField(null=True, blank=True)
    github_issue_url = models.URLField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"SupportRequest #{self.pk} ({self.kind}, {self.status})"
