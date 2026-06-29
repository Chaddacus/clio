"""Deterministic sufficiency gate for support requests.

This is intentionally NOT an LLM call. It is a cheap, predictable bouncer that
rejects obviously-unactionable submissions (too short, no specifics) before an
issue is ever created. The deep, semantic "is this grounded in the code"
judgement is the first step of the codex pipeline, which has a model and the
repo in hand. Keeping this layer deterministic means a user always gets the
same, explainable feedback and we never spam the tracker with empty issues.
"""

import re

# Feature vocabulary drawn from the app's actual surfaces. A request that names
# one of these is anchored to something real in the product.
FEATURE_TERMS = {
    'transcri', 'speaker', 'diariz', 'folder', 'tag', 'login', 'sign in',
    'signin', 'register', 'record', 'upload', 'audio', 'note', 'progress',
    'playback', 'play', 'export', 'download', 'search', 'profile', 'password',
    'favorite', 'language', 'segment', 'timestamp', 'title',
}

# Signals that the user described a concrete situation rather than a vague wish.
DETAIL_SIGNALS = {
    'when', 'after', 'before', 'click', 'tap', 'press', 'error', 'fail',
    'crash', 'broken', "doesn't", 'does not', 'instead', 'expected', 'should',
    'but', 'because', 'page', 'button', 'screen', 'shows', 'message', 'wrong',
}

MIN_WORDS = 6
WORD_RE = re.compile(r"[A-Za-z0-9']+")


def evaluate(body: str) -> tuple[bool, str]:
    """Return (is_sufficient, reason). Reason is user-facing when insufficient."""
    text = (body or '').strip()
    lowered = text.lower()
    words = WORD_RE.findall(lowered)

    if len(words) < MIN_WORDS:
        return False, (
            "Add a bit more detail — what were you doing, what happened, and "
            "what should happen instead?"
        )

    names_feature = any(term in lowered for term in FEATURE_TERMS)
    has_detail = any(signal in lowered for signal in DETAIL_SIGNALS)

    # Anchored to a real feature AND describes a concrete situation -> actionable.
    if names_feature and has_detail:
        return True, ''

    # Long, descriptive writeups pass even without an exact feature keyword.
    if len(words) >= 20 and has_detail:
        return True, ''

    if not names_feature:
        return False, (
            "Mention the specific part of the app this is about (for example: "
            "transcription, speakers, folders, recording, login) so it can be "
            "acted on."
        )

    return False, (
        "Describe what actually happens versus what you expected — a step or "
        "two of context makes this fixable."
    )
