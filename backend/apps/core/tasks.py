import logging

import requests
from celery import shared_task
from django.conf import settings

from .models import SupportRequest

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"


def _derive_title(sr: SupportRequest) -> str:
    first_line = sr.body.strip().splitlines()[0]
    words = first_line.split()
    summary = ' '.join(words[:10]) + ('…' if len(words) > 10 else '')
    return f"[{sr.kind}] {summary}"[:120]


def _render_issue_body(sr: SupportRequest) -> str:
    trace_line = (
        f"- **Trace id:** `{sr.trace_id}` (pull the end-to-end logs for this id)"
        if sr.trace_id else "- **Trace id:** _none provided_"
    )
    return (
        f"_Filed automatically from the in-app support widget by "
        f"**{sr.user.username}**._\n\n"
        f"**Kind:** {sr.get_kind_display()}\n"
        f"- **Support request id:** {sr.id}\n"
        f"{trace_line}\n\n"
        f"## What the user reported\n\n"
        f"{sr.body.strip()}\n\n"
        f"---\n"
        f"<sub>codex: ground this against the repo, then plan → audit → "
        f"implement → test → validate. The supervisor gate must approve before "
        f"merge to main + ship.</sub>"
    )


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def create_support_issue_task(self, support_request_id: int) -> None:
    """Create a `codex`-labelled GitHub issue for a sufficient support request."""
    try:
        sr = SupportRequest.objects.get(id=support_request_id)
    except SupportRequest.DoesNotExist:
        logger.error("SupportRequest %d not found for issue creation", support_request_id)
        return

    token = getattr(settings, 'GITHUB_TOKEN', '')
    repo = getattr(settings, 'GITHUB_REPO', '')
    if not token or not repo:
        logger.warning(
            "GITHUB_TOKEN/GITHUB_REPO not configured; SupportRequest %d stays 'submitted'",
            support_request_id,
        )
        return

    try:
        resp = requests.post(
            f"{GITHUB_API}/repos/{repo}/issues",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            json={
                "title": _derive_title(sr),
                "body": _render_issue_body(sr),
                "labels": [settings.CODEX_LABEL],
            },
            timeout=15,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error("GitHub issue creation failed for SupportRequest %d: %s", support_request_id, exc)
        raise self.retry(exc=exc)

    data = resp.json()
    sr.github_issue_number = data["number"]
    sr.github_issue_url = data["html_url"]
    sr.status = "issue_created"
    sr.save(update_fields=["github_issue_number", "github_issue_url", "status", "updated_at"])
    logger.info("SupportRequest %d -> GitHub issue #%s", support_request_id, data["number"])
