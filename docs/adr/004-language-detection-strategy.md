# ADR-004: Spoken-language detection strategy

## Status
Accepted (2026-09-01)

## Context
A user reported that Spanish audio was transcribed as English. The report predates the
switch to Deepgram (PR #38, deployed 2026-06-29); the earlier path was a self-hosted
`faster-whisper-small` model, which is weak on short non-English clips.

The auto path today sends `detect_language=true` to Deepgram nova-3. Deepgram also offers
`language=multi` (code-switching mode, per-word language tags). Before choosing, both were
run against synthetic clips (macOS speech voices, now committed under
`backend/tests/fixtures/audio/`):

| clip | `detect_language` | `language=multi` |
|---|---|---|
| Spanish (MX, ES) | correct Spanish, detected `es` at 0.99 | correct Spanish |
| English then Spanish | both kept; minor errors ("dentista", "Than") | cleanest text; words tagged en/es |
| Korean | correct, detected `ko` at 1.00 | garbage, tagged `ja` |
| Chinese | correct, detected `zh` at 1.00 | garbage, tagged `ja` |

`multi` returns no `detected_language`; the language would have to be derived from word
tags. Its supported language set does not include Korean or Chinese, both of which the app
offers.

## Decision
Keep `detect_language=true` as the auto path. Do not switch to `multi`.

Add the evidence instead of a code change: committed audio fixtures, unit tests that pin
"whatever Deepgram detects is what the note stores" for every offered language, a live
provider test (`pytest -m live`) that runs the fixtures through real Deepgram, and a
Playwright upload flow that asserts Spanish text and a Spanish badge on the note page.

## Alternatives considered
- **`language=multi` for auto.** Rejected: breaks Korean and Chinese (table above).
- **Two-pass: detect, then re-run with `multi` when `language_confidence` is low.** The
  mixed clip scored 0.56 against 0.99+ for single-language clips, so a threshold would
  separate them. Rejected for now: doubles provider cost on ambiguous clips, and the
  second pass still needs a guard for languages `multi` cannot handle. Revisit only if
  code-switched notes show real accuracy problems.

## Consequences
- Mixed-language recordings keep each language but may carry small errors at the switch
  points.
- The live test is the pre-deploy gate for provider behaviour changes; it is not part of CI.
- Translation is a separate capability and is not addressed here.
