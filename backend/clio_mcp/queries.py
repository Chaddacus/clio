"""Data logic for the Clio MCP server.

Plain, importable functions so the tool surface is unit-testable without the
MCP transport. The MCP tools in ``server.py`` are thin wrappers over these.

Surface is deliberately scoped: five read functions over tracing /
support / health, plus exactly one controlled write that only advances a
support request's lifecycle status. Nothing here mutates user notes or other
production data — real code changes happen as agent-authored PRs, never
through this server.
"""

from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import Count

from apps.core.models import SupportRequest
from apps.voice_notes.models import VoiceNote

WRITABLE_STATUSES = {s for s, _ in SupportRequest.STATUS_CHOICES}


def _note_brief(note: VoiceNote) -> dict:
    return {
        "id": note.id,
        "title": note.title,
        "username": note.user.username,
        "status": note.status,
        "trace_id": note.trace_id,
        "error_message": note.error_message,
        "language_detected": note.language_detected,
        "confidence_score": note.confidence_score,
        "duration_seconds": note.duration.total_seconds() if note.duration else None,
        "segment_count": note.segments.count(),
        "created_at": note.created_at.isoformat(),
    }


def _support_brief(sr: SupportRequest) -> dict:
    return {
        "id": sr.id,
        "kind": sr.kind,
        "status": sr.status,
        "body": sr.body,
        "trace_id": sr.trace_id,
        "username": sr.user.username,
        "github_issue_number": sr.github_issue_number,
        "github_issue_url": sr.github_issue_url,
        "created_at": sr.created_at.isoformat(),
    }


def app_health() -> dict:
    """Provider in use + note lifecycle counts — a quick health snapshot."""
    by_status = dict(
        VoiceNote.objects.values_list("status").annotate(n=Count("id")).values_list("status", "n")
    )
    return {
        "transcription_provider": "deepgram" if settings.DEEPGRAM_API_KEY else "whisper",
        "deepgram_model": settings.DEEPGRAM_MODEL if settings.DEEPGRAM_API_KEY else None,
        "notes_total": VoiceNote.objects.count(),
        "notes_by_status": by_status,
        "users_total": User.objects.count(),
        "open_support_requests": SupportRequest.objects.filter(
            status__in=["submitted", "issue_created", "in_progress"]
        ).count(),
    }


def list_pending_support_requests(limit: int = 20) -> list[dict]:
    """Support requests that passed the gate and await issue creation/work."""
    qs = SupportRequest.objects.filter(status="submitted").select_related("user")[: max(1, min(limit, 100))]
    return [_support_brief(sr) for sr in qs]


def get_support_request(request_id: int) -> dict | None:
    try:
        sr = SupportRequest.objects.select_related("user").get(id=request_id)
    except SupportRequest.DoesNotExist:
        return None
    data = _support_brief(sr)
    data["gate_reason"] = sr.gate_reason
    if sr.trace_id:
        data["trace"] = get_trace(sr.trace_id)
    return data


def get_trace(trace_id: str) -> dict:
    """Everything observable for one end-to-end trace id (the note lifecycle)."""
    notes = VoiceNote.objects.filter(trace_id=trace_id).select_related("user")
    return {
        "trace_id": trace_id,
        "notes": [_note_brief(n) for n in notes],
        "support_requests": [
            _support_brief(sr)
            for sr in SupportRequest.objects.filter(trace_id=trace_id).select_related("user")
        ],
    }


def recent_transcription_failures(limit: int = 20) -> list[dict]:
    """Recently failed transcriptions — proactive issue discovery for the agent."""
    qs = (
        VoiceNote.objects.filter(status="failed")
        .select_related("user")
        .order_by("-created_at")[: max(1, min(limit, 100))]
    )
    return [_note_brief(n) for n in qs]


def update_support_request_status(
    request_id: int,
    status: str,
    github_issue_number: int | None = None,
    github_issue_url: str | None = None,
) -> dict:
    """The one controlled write: advance a support request's lifecycle status.

    Validates the status against the model's choices and only touches the
    support row — never user notes or other data.
    """
    if status not in WRITABLE_STATUSES:
        raise ValueError(f"Invalid status '{status}'. Allowed: {sorted(WRITABLE_STATUSES)}")
    try:
        sr = SupportRequest.objects.get(id=request_id)
    except SupportRequest.DoesNotExist:
        raise ValueError(f"SupportRequest {request_id} not found")

    sr.status = status
    fields = ["status", "updated_at"]
    if github_issue_number is not None:
        sr.github_issue_number = github_issue_number
        fields.append("github_issue_number")
    if github_issue_url is not None:
        sr.github_issue_url = github_issue_url
        fields.append("github_issue_url")
    sr.save(update_fields=fields)
    return _support_brief(sr)
