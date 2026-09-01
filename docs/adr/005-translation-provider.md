# ADR-005: Translation runs as a separate LLM call, not inside transcription

Date: 2026-09-01
Status: Accepted (capability NOT READY until evals pass with a live key)

## Context

ADR-004 keeps transcription in the spoken language. Users also want the note in a language they read. Deepgram nova-3 transcribes; it does not translate. Whisper can translate only into English and only on the fallback path.

## Decision

1. Translation is its own module (`apps/translations`) and its own stored artifact (`NoteTranslation`, one row per note and target language). The transcript and its segments are never modified.
2. The translation step is one call to Claude (`claude-opus-5`) through the official `anthropic` SDK with structured output, behind a `TranslationProvider` protocol. Business code never imports the SDK.
3. Targets are the nine languages already offered in the re-transcribe dialog.
4. The capability follows Standard 9: capability contract, deterministic eval suite that fails closed without a key, versioned prompt.

## Why a second API key

Deepgram cannot translate. An LLM can, and it keeps speaker turns aligned through the unit ids. The Anthropic key is a new secret: personal plane, Bitwarden entry `Anthropic API Key`, passed to the backend and celery containers as `ANTHROPIC_API_KEY`. Without it the endpoint returns 503 and the UI hides the control.

## Alternatives rejected

- Deepgram or Whisper translation: not available (Deepgram) or English-only on the fallback path (Whisper).
- Translating inside the transcription task: couples two providers and two failure modes into one status; the user would lose the transcript when translation fails.
- OpenAI as provider: no technical blocker, but Claude-first is the project policy and the Bitwarden vault has no OpenAI API key entry either (the "OpenAI" entries are website logins).

## Consequences

- Re-transcribing or editing a transcript deletes its stored translations (the translations module exposes `invalidate_translations_for_note` for this). The user re-requests them.
- One more secret to provision on the Linode box.
- Long notes (more than about 16 000 output tokens) fail with a clear reason; streaming or chunking is a follow-up.
- Server-side fallbacks are not enabled until a live key lets us verify the request shape.
