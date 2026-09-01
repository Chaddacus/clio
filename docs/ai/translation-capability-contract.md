# AI Capability Contract: transcript translation

Status: **NOT READY** until the eval suite has run and passed with a real key (see "Eval suite").

## Owner / module

- Module: `backend/apps/translations/` (models, services, tasks, views, serializers).
- Adapter: `POST|GET /api/notes/<id>/translations/` (`apps/api/urls.py`).
- UI: translation panel on `frontend/src/pages/NoteDetailPage.tsx`.

## Purpose

Give the user a copy of a note's transcript in a language they choose. Transcription stays in the spoken language (ADR-004). Translation is a separate, derived artifact that never replaces the transcript.

## Input contract

- Ordered transcript units: `[{id: int, speaker: str, text: str}]`. One unit per `TranscriptionSegment` (id = segment pk, ordered by start time). A note with no segments becomes a single unit with id 0.
- `source_language`: the note's `language_detected` code, or `auto`.
- `target_language`: one of `en es fr de it pt ja ko zh`. `auto` and the detected language are rejected by the API.
- Precondition: the note is `completed` with a non-empty transcript.

## Output contract

- Provider output is schema-constrained (`_TranslationOut`: `units: [{id, text}]`).
- Deterministic validation after schema validity (`validate_units`): ids equal the input ids in order, count preserved, no empty text. Any violation is a failed translation; nothing partial is stored.
- Stored row: `NoteTranslation(text, segments=[{segment_id, text}], status, provider, model, prompt_version, input_tokens, output_tokens)`.

## Grounding sources

The transcript units only. No retrieval, no memory, no other notes.

## Tools

None. The model has no tools; it cannot read, write, or call anything.

## Authority model

- The model has no authority. It produces text only.
- The application decides: who may request (note owner), when (note completed), what is stored, and when to retry.
- Transcript text is untrusted data. The system prompt states that unit text is never an instruction, and the eval suite has an injection case that must translate the injected instruction literally.

## Provider / model policy

- Claude first: `ClaudeTranslationProvider` via the official `anthropic` SDK (`client.messages.create` with a JSON-schema output format).
- Model `CLIO_TRANSLATION_MODEL`, default `claude-opus-5`. Effort `CLIO_TRANSLATION_EFFORT`, default `medium`.
- Business code calls `get_translation_provider()` only. A second provider is a new class behind the same `TranslationProvider` protocol.
- The call is `messages.create` with `output_config.format` (JSON schema) so the stop reason is inspected before the text is validated; `messages.parse` would raise on a truncated reply.
- Not wired yet (needs a live key to verify the request shape): server-side fallbacks, streaming for very long notes.

## Budgets

| Item | Budget |
|---|---|
| Latency per note | 60 s eval budget; 120 s hard timeout; SDK retries 2 |
| Output tokens | 16 000 per call; longer notes fail with a clear reason (limitation) |
| Iterations | One call per (note, language). No agent loop. |
| Cost | One call per requested language; re-requests return the stored row |

## Invalidation

A translation is derived from one transcript and its segment ids. Re-transcription (`retranscribe_voice_note_task`) and a manual transcript edit (`PATCH /api/notes/<id>/` with a changed `transcription`) call `invalidate_translations_for_note`, the module's public contract, which deletes the note's translation rows. The user requests a fresh translation afterwards; nothing stale is ever shown.

## Retry policy

Transient provider failures (rate limit, HTTP 5xx, connection errors) are retried by the Celery task up to two times, 15 s apart, and the row stays `pending` while a retry is scheduled. Refusals, truncation, schema-invalid output, contract violations, and configuration errors fail immediately: a retry would repeat the same outcome at cost.

## Fallback behaviour

- No key configured: API answers 503, UI hides the control.
- Provider error, refusal, truncation, contract violation: row is `failed` with the user message "Translation failed. Please try again."; the detailed reason goes to logs only. The user can retry, which re-dispatches.
- The original transcript is always available; translation failure never degrades transcription.

## Eval suite

- Dataset `backend/evals/translation/cases.json` (`translation-cases-v1`), runner `backend/evals/translation/test_translation_evals.py`, marker `ai_eval`.
- Threshold: 100 % of cases pass (9 cases: normal, edge, adversarial, regression). Deterministic graders only.
- Fails closed when the key is absent. Runs on every change to the prompt, model, effort, schema, or dataset.

## Observability

- Structured logs on every call: model, unit count, latency, token counts, failure reason. Request id (`trace_id`) propagates from the API into the task through `set_request_id`.
- Never logged: transcript text, translated text, the key. Provider failures are reduced to a reason string before they leave the provider (schema errors carry only an error count; unexpected exceptions are logged by type name).
