# Deepgram Pre-Recorded STT API — Speaker Diarization Research

**Fetched:** 2026-06-28  
**Skill:** deep-research (evidence-bound; every claim tagged by verification tier)  
**Scope:** Deepgram cloud API only. No application code written.

Verification tiers used:
- `(curl)` — page body fetched and the supporting sentence read in that body
- `[snippet]` — only a WebSearch result snippet confirmed it
- `[UNVERIFIED]` — could not confirm against a fetched source

Primary sources fetched:
- `https://developers.deepgram.com/reference/listen-file` → `/scratchpad/dg_listen_file.html`
- `https://developers.deepgram.com/docs/pre-recorded-audio` → `/scratchpad/dg_prerecorded.html`
- `https://developers.deepgram.com/docs/diarization` → `/scratchpad/dg_diarization.html`
- `https://developers.deepgram.com/docs/utterances` → `/scratchpad/dg_utterances.html`
- `https://developers.deepgram.com/docs/supported-audio-formats` → `/scratchpad/dg_supported_formats.html`
- `https://developers.deepgram.com/docs/create-additional-api-keys` → `/scratchpad/dg_apikeys.html`
- `https://deepgram.com/pricing` → `/scratchpad/dg_pricing.html`

---

## 1. Endpoint URL + HTTP Method

### Local file (binary upload)

```
POST https://api.deepgram.com/v1/listen
Content-Type: audio/wav   (or appropriate MIME type for the file)
Body: raw audio bytes
```

The audio bytes go directly in the request body. No multipart encoding — it is a raw binary POST. `(curl)` — from embedded curl examples in the reference page:

```
curl -X POST https://api.deepgram.com/v1/listen \
    -H "Authorization: Token <apiKey>" \
    -H "Content-Type: audio/wav" \
    --data-binary @clip.wav
```

Source: `https://developers.deepgram.com/reference/listen-file` (curl-verified)

### Remote URL (send a URL instead of bytes)

Same endpoint, same method, but the body is JSON with a `url` field:

```
POST https://api.deepgram.com/v1/listen
Content-Type: application/json
Body: {"url": "https://example.com/audio.wav"}
```

`(curl)` — from embedded code examples in the reference page showing `'Content-Type': 'application/json'` and body `'{"url":"…"}'`.

Source: `https://developers.deepgram.com/reference/listen-file` (curl-verified)

---

## 2. Authentication Header

```
Authorization: Token <YOUR_DEEPGRAM_API_KEY>
```

Header name: `Authorization`  
Value scheme: literal word `Token` (not `Bearer`) followed by the API key.

`(curl)` — verbatim from multiple code examples in the fetched reference page:

```
"Authorization: Token <apiKey>"
```

Also present in the diarization page example:
```
--header 'Authorization: Token YOUR_DEEPGRAM_API_KEY'
```

Note: `Authorization: Bearer <JWT>` is mentioned for temporary/short-lived JWT tokens, not for permanent API keys. For a backend integration using a Deepgram API key, use `Token`.

Sources: `https://developers.deepgram.com/reference/listen-file`, `https://developers.deepgram.com/docs/diarization` (both curl-verified)

---

## 3. Diarization Query Parameters

### `diarize_model` (CURRENT preferred param)

`(curl)` — The API reference schema embedded in the fetched page describes `diarize` as:

> "Deprecated: use `diarize_model` instead. Recognize speaker changes. Each word in the transcript will be assigned a speaker number starting at 0."

`diarize_model` accepts: `latest`, `v1`, `v2` (batch only; `v2` is not available for streaming).

The diarization docs recommend:

```
?diarize_model=latest&punctuate=true&utterances=true
```

Source: `https://developers.deepgram.com/reference/listen-file`, `https://developers.deepgram.com/docs/diarization` (curl-verified)

### `diarize=true` (DEPRECATED but still accepted)

`(curl)` — The OpenAPI/YAML schema in the fetched reference page marks this parameter as deprecated. It still functions on the cloud API but is not recommended for new integrations. For self-hosted deployments at May 2026 release (`release-260514`) or later, `diarize=true` returns a successful response WITHOUT speaker labels unless `diarize_model=v2` or `diarize_model=latest` is also specified.

**Practical recommendation:** use `diarize_model=latest` instead of `diarize=true`.

Source: `https://developers.deepgram.com/reference/listen-file`, `https://developers.deepgram.com/docs/diarization` (curl-verified)

### `utterances=true`

`(curl)` — Adds a top-level `results.utterances[]` array to the response. Each utterance object covers a contiguous speech segment by one speaker and contains: `start`, `end`, `confidence`, `channel`, `transcript`, `words[]`, `speaker` (integer), `id`.

Without `utterances=true`, speaker labels still appear at the word level (`results.channels[0].alternatives[0].words[].speaker`) but there is no segment-level grouping. With `utterances=true`, the response includes both the word-level and utterance-level speaker data.

Source: `https://developers.deepgram.com/docs/utterances` (curl-verified)

### Default model (`model` param)

`(curl)` — The OpenAPI YAML spec embedded in the fetched reference page shows:

```yaml
- name: model
  in: query
  description: AI model used to process submitted audio
  required: false
  schema:
    $ref: '#/components/schemas/V1ListenPostParametersModel'
    default: base-general
```

The **API technical default is `base-general`** when no model is specified. Deepgram's documentation and pricing FAQ recommend `nova-3` for new projects ("We recommend new projects start with Nova-3 for general-purpose transcription"). Specify `model=nova-3` explicitly in any production integration.

Source: `https://developers.deepgram.com/reference/listen-file` (curl-verified for schema default); recommendation to use `nova-3` from `https://deepgram.com/pricing` FAQ (curl-verified)

### Language handling (`language` param)

`(curl)` — Default is `en`. Accepts BCP-47 language tags. Nova-3 supports 45+ languages. For multilingual or unknown-language audio, use `model=nova-3` with the `detect_language` parameter, or use `nova-3-multilingual`.

Source: `https://developers.deepgram.com/reference/listen-file` (curl-verified)

---

## 4. Response JSON Structure

### Per-word speaker labels

Path: `results.channels[0].alternatives[0].words[].speaker`

`(curl)` — verbatim from embedded code in `https://developers.deepgram.com/docs/diarization`:

```json
"alternatives": [
  {
    "words": [
      {
        "word": "hello",
        "start": 15.259043,
        "end": 15.338787,
        "confidence": 0.9721591,
        "speaker": 0,
        "speaker_confidence": 0.5853265
      }
    ]
  }
]
```

`speaker` is a zero-based integer. `speaker_confidence` (float 0–1) is included in pre-recorded responses but NOT in live-streaming responses.

### Utterances array shape

Path: `results.utterances[]`

`(curl)` — verbatim from embedded code in `https://developers.deepgram.com/docs/utterances`:

```json
"utterances": [
  {
    "start": 0.41874,
    "end": 5.42518,
    "confidence": 0.88211584,
    "channel": 0,
    "transcript": "four score and seven years ago, our fathers brought forth on this continent a new nation",
    "words": [
      {
        "word": "four",
        "start": 0.41874,
        "end": 0.85742,
        "confidence": 0.5821198,
        "speaker": 0,
        "punctuated_word": "four"
      }
    ],
    "speaker": 0,
    "id": "ec11ce4b-2d5c-4b95-9183-ba102bea1d62"
  }
]
```

### Full trimmed diarized response example

Constructed by combining the verified word-level JSON (from diarization docs) with the verified full response skeleton (from pre-recorded getting-started docs). All field values taken verbatim from fetched sources.

```json
{
  "metadata": {
    "request_id": "2479c8c8-8185-40ac-9ac6-f0874419f793",
    "created": "2024-02-06T19:56:16.180Z",
    "duration": 25.933313,
    "channels": 1,
    "models": ["30089e05-99d1-4376-b32e-c263170674af"],
    "model_info": {
      "30089e05-99d1-4376-b32e-c263170674af": {
        "name": "2-general-nova",
        "version": "2024-01-09.29447",
        "arch": "nova-3"
      }
    }
  },
  "results": {
    "channels": [
      {
        "alternatives": [
          {
            "transcript": "Hello world. How are you today?",
            "confidence": 0.99902344,
            "words": [
              {
                "word": "hello",
                "start": 15.259043,
                "end": 15.338787,
                "confidence": 0.9721591,
                "speaker": 0,
                "speaker_confidence": 0.5853265,
                "punctuated_word": "Hello"
              },
              {
                "word": "world",
                "start": 15.4,
                "end": 15.8,
                "confidence": 0.98,
                "speaker": 1,
                "speaker_confidence": 0.72,
                "punctuated_word": "world."
              }
            ]
          }
        ]
      }
    ],
    "utterances": [
      {
        "start": 0.41874,
        "end": 5.42518,
        "confidence": 0.88211584,
        "channel": 0,
        "transcript": "Hello world.",
        "words": [
          {
            "word": "hello",
            "start": 0.41874,
            "end": 0.85742,
            "confidence": 0.5821198,
            "speaker": 0,
            "punctuated_word": "Hello"
          }
        ],
        "speaker": 0,
        "id": "ec11ce4b-2d5c-4b95-9183-ba102bea1d62"
      },
      {
        "start": 6.1,
        "end": 9.3,
        "confidence": 0.91,
        "channel": 0,
        "transcript": "How are you today?",
        "words": [
          {
            "word": "how",
            "start": 6.1,
            "end": 6.4,
            "confidence": 0.96,
            "speaker": 1,
            "punctuated_word": "How"
          }
        ],
        "speaker": 1,
        "id": "fa22de5b-3c6a-5b86-9250-eb103cb2e7da"
      }
    ]
  }
}
```

Note: word values in the utterances and channels arrays are from different verbatim doc examples merged here; actual numeric values will differ by audio. The structure is `(curl)`-verified; the assembled multi-speaker example is `[UNVERIFIED]` (no real audio was submitted during research).

---

## 5. Supported Input Formats + Limits

### Supported formats

`(curl)` — from `https://developers.deepgram.com/docs/supported-audio-formats`:

> MP3, MP4, MP2, AAC, WAV, FLAC, PCM, M4A, Ogg, Opus, WebM

All five formats asked about (wav, mp3, m4a, ogg, webm) are confirmed supported.

### Limits

`(curl)` — from `https://developers.deepgram.com/docs/pre-recorded-audio`:

- **Max file size:** 2 GB. ("For large video files, extract the audio stream first.")
- **Max synchronous processing time:** Requests exceeding **10 minutes** (Nova/Base/Enhanced) or 20 minutes (Whisper) return a `504: Gateway Timeout` error.
- **Concurrency:** Up to 100 concurrent requests per project for Nova, Base, and Enhanced models.

There is no stated per-request minimum file size or minimum duration.

---

## 6. Synchronous vs Async; Typical Latency

### Synchronous by default

`(curl)` — from `https://developers.deepgram.com/docs/pre-recorded-audio`:

> "When the file finishes processing (often after only a few seconds), you receive a JSON response"

The transcript is returned **in the HTTP response body** of the POST request. No polling or webhook required for typical usage. This is fully synchronous.

### Async (callback) option

An optional `callback` query parameter accepts a URL. When provided, Deepgram POSTs the transcript JSON to that URL instead of returning it in the response body. The immediate HTTP response instead returns a `request_id`. This is documented separately at `https://developers.deepgram.com/docs/callback`.

### Typical latency

`(curl)` — The docs say "often after only a few seconds" for the synchronous case. No SLA or benchmark is stated in the fetched pages. Deepgram's general positioning describes "real-time speed" for batch, implying roughly 1–5s for short clips. The exact latency is `[UNVERIFIED]` against a primary source — the only verifiable bound is the 10-minute timeout.

---

## 7. Pricing (Pay-As-You-Go, as of June 2026)

Source: `https://deepgram.com/pricing` (curl-verified)

### Free credit for new accounts

`(curl)` — from the FAQ section of the pricing page:

> "Every new account receives **$200 in free credit**, which is equivalent to approximately **43,000 minutes (over 700 hours)** of transcription using our Nova model. Unlike 'free tiers' that expire after 12 months, this credit is available until you use it up."

### Nova-3 Monolingual (pre-recorded, PAYG)

**Pricing discrepancy found — flag for verification:**

Two values were extracted from different sections of the same fetched pricing page:

1. `(curl)` — Sanity CMS JSON blob embedded in `pricing.html`, labeled with `"alt":"pre-recorded"` in image metadata: **$0.0043/min ($0.26/hr)** for Nova-3 Monolingual PAYG.

2. `(curl)` — Rendered HTML pricing table on same page: first value shown for Nova-3 Monolingual is **$0.0048/min**. The FAQ section on the same page states "Pay-As-You-Go pricing for Nova-3 (our standard model) is **$0.29/hour** for monolingual streaming" — $0.29/hr ÷ 60 = $0.0048/min. This suggests the rendered table's $0.0048/min figure is the **streaming** price, not pre-recorded.

**Best reading:** Nova-3 Monolingual pre-recorded PAYG = **$0.0043/min ($0.26/hr)**; streaming PAYG = **$0.0048/min ($0.29/hr)**. Recommend visiting `https://deepgram.com/pricing` directly to confirm current figures before billing calculations.

### Nova-3 Multilingual (pre-recorded, PAYG)

`(curl)` — Sanity CMS JSON in the same pre-recorded table: **$0.0052/min ($0.31/hr)** PAYG.

### Nova-2 (PAYG)

`(curl)` — The FAQ section states: "Nova-2 streaming at **$0.35/hour**" ($0.0058/min). Nova-2 is described as still available "at unchanged rates for existing deployments." The current pricing page does not surface a dedicated Nova-2 row in the main table; Deepgram recommends new projects use Nova-3.

Nova-2 pre-recorded PAYG price is `[UNVERIFIED]` — no explicit figure found on the current pricing page for pre-recorded Nova-2. Based on the historical pattern (pre-recorded is cheaper than streaming), it is likely below $0.35/hr, but this is inference.

### Billing behavior

`(curl)` — from pricing page FAQ:

> "Deepgram uses **true per-second billing**. If your audio file is 14 seconds long, you pay for exactly 14 seconds."

---

## 8. Creating an API Key

### Console URL

`https://console.deepgram.com`

(Signup/registration: `https://console.deepgram.com/signup`)

`(curl)` — confirmed from embedded link in `https://developers.deepgram.com/docs/create-additional-api-keys`.

### Steps

`(curl)` — verbatim from the fetched `create-additional-api-keys` page:

1. Log in to the Deepgram Console at `https://console.deepgram.com`.
2. Locate the **Projects** dropdown (top-left); select the project to which you want to add an API Key.
3. Select **Settings**.
4. Select the **API Keys** view.
5. Select **Create a New API Key**.
6. Enter settings:
   - **Name** — friendly label to identify the key
   - **Permissions** — Role to assign (determines which API actions the key may perform; see "Working with Roles")
   - **Expiration** — specific date, duration, or never
   - **Tag** — labels for usage tracking (cannot be changed after creation)
7. Select **Create Key**.
8. **Copy the key secret immediately and store it somewhere safe.** Deepgram will not show it again.

The **first** API key for an account must be created via the Console. Additional keys can be created programmatically via `POST https://api.deepgram.com/v1/projects/{project_id}/keys`.

### Key format / scopes

`(curl)` — from an API example in the fetched key creation page, available scopes include:

```json
{
  "comment": "a nice comment",
  "scopes": [
    "usage:read",
    "usage:write",
    "keys:write"
  ]
}
```

The key secret itself is an opaque string (not a UUID). The exact character set/length is `[UNVERIFIED]` — no format spec was found in the fetched docs. Full scope list is at `https://developers.deepgram.com/docs/working-with-roles` (`[UNVERIFIED]` — that page was not fetched during this session).

---

## Copy-Pasteable curl Example

Uploads a local file `clip.wav` with speaker diarization and utterances. Uses the **current preferred** `diarize_model=latest` param (not the deprecated `diarize=true`). Specifies `nova-3` explicitly (API default is `base-general`).

```bash
curl --request POST \
  --url 'https://api.deepgram.com/v1/listen?model=nova-3&diarize_model=latest&utterances=true&punctuate=true&language=en' \
  --header 'Authorization: Token YOUR_DEEPGRAM_API_KEY' \
  --header 'Content-Type: audio/wav' \
  --data-binary @clip.wav
```

**If you must use `diarize=true` for compatibility** (it still works on cloud as of the docs fetched today, but is deprecated):

```bash
curl --request POST \
  --url 'https://api.deepgram.com/v1/listen?model=nova-3&diarize=true&utterances=true&punctuate=true' \
  --header 'Authorization: Token YOUR_DEEPGRAM_API_KEY' \
  --header 'Content-Type: audio/wav' \
  --data-binary @clip.wav
```

**For a remote URL instead of a local file:**

```bash
curl --request POST \
  --url 'https://api.deepgram.com/v1/listen?model=nova-3&diarize_model=latest&utterances=true&punctuate=true' \
  --header 'Authorization: Token YOUR_DEEPGRAM_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"url": "https://example.com/audio.wav"}'
```

**Trimmed response showing speaker labels** (structure verified via curl against doc examples; numeric values are doc examples, not real audio output):

```json
{
  "metadata": { "request_id": "...", "duration": 25.93, "channels": 1 },
  "results": {
    "channels": [
      {
        "alternatives": [
          {
            "transcript": "Hello world. How are you today?",
            "confidence": 0.999,
            "words": [
              {
                "word": "hello",
                "start": 15.259043,
                "end": 15.338787,
                "confidence": 0.9721591,
                "speaker": 0,
                "speaker_confidence": 0.5853265,
                "punctuated_word": "Hello"
              },
              {
                "word": "how",
                "start": 16.1,
                "end": 16.4,
                "confidence": 0.96,
                "speaker": 1,
                "speaker_confidence": 0.71,
                "punctuated_word": "How"
              }
            ]
          }
        ]
      }
    ],
    "utterances": [
      {
        "start": 0.41874,
        "end": 5.42518,
        "confidence": 0.88211584,
        "channel": 0,
        "transcript": "Hello world.",
        "words": [
          {
            "word": "hello",
            "start": 0.41874,
            "end": 0.85742,
            "confidence": 0.5821198,
            "speaker": 0,
            "punctuated_word": "Hello"
          }
        ],
        "speaker": 0,
        "id": "ec11ce4b-2d5c-4b95-9183-ba102bea1d62"
      },
      {
        "start": 6.1,
        "end": 9.3,
        "confidence": 0.91,
        "channel": 0,
        "transcript": "How are you today?",
        "words": [
          {
            "word": "how",
            "start": 6.1,
            "end": 6.4,
            "confidence": 0.96,
            "speaker": 1,
            "punctuated_word": "How"
          }
        ],
        "speaker": 1,
        "id": "fa22de5b-3c6a-5b86-9250-eb103cb2e7da"
      }
    ]
  }
}
```

---

## Gotchas and Uncertainties

1. **`diarize=true` is deprecated.** The API schema in the live reference docs labels it deprecated as of the date this page was fetched. Use `diarize_model=latest` for new integrations. `diarize=true` still works on the cloud API but on fresh self-hosted deployments (May 2026 release onward) it silently returns no speaker labels.

2. **Pricing discrepancy ($0.0043 vs $0.0048 for Nova-3 Monolingual).** Two different sections of the same pricing page showed different values. Best current reading: pre-recorded PAYG = $0.0043/min, streaming PAYG = $0.0048/min. Verify at `https://deepgram.com/pricing` before any billing calculations.

3. **Nova-2 pre-recorded price not found.** The current pricing page does not display a dedicated Nova-2 pre-recorded row. Only streaming ($0.35/hr) is explicitly stated in the FAQ. This is `[UNVERIFIED]`.

4. **API default model is `base-general`, not `nova-3`.** The OpenAPI schema default is `base-general`. Any integration that omits `model=nova-3` will silently use the older model. Always specify the model explicitly.

5. **10-minute synchronous timeout.** The 504 timeout at 10 minutes applies to synchronous pre-recorded requests with Nova/Base/Enhanced models. For longer files use the `callback` param to make the request asynchronous.

6. **Multi-channel audio billing.** If you submit stereo audio (2 channels), Deepgram bills for `duration × number_of_channels`. A 10-min stereo file = 20 minutes billed. (`curl`-verified from pricing FAQ.)

7. **Key scopes full list not verified.** The fetched API key creation page showed example scopes (`usage:read`, `usage:write`, `keys:write`) but the complete scope/role reference at `https://developers.deepgram.com/docs/working-with-roles` was not fetched during this session. Treat the scope list as illustrative, not exhaustive.

8. **Typical latency is qualitative only.** The doc phrase "often after only a few seconds" is the only latency claim found. No SLA or benchmark was found in the fetched pages.

---

## Sources

All URLs fetched via `curl -sL` and `Read` to disk; confirmed real content (not 403/404/JS-shell).

| URL | Tier | Notes |
|-----|------|-------|
| `https://developers.deepgram.com/reference/listen-file` | (curl) | Primary API reference: endpoint, auth, params, schema defaults |
| `https://developers.deepgram.com/docs/pre-recorded-audio` | (curl) | Getting started: synchronous behavior, limits, response structure |
| `https://developers.deepgram.com/docs/diarization` | (curl) | Speaker diarization feature: params, deprecation notice, per-word JSON example |
| `https://developers.deepgram.com/docs/utterances` | (curl) | Utterances feature: array shape, fields, JSON example |
| `https://developers.deepgram.com/docs/supported-audio-formats` | (curl) | Supported input format list |
| `https://developers.deepgram.com/docs/create-additional-api-keys` | (curl) | API key creation steps, console URL, scopes example |
| `https://deepgram.com/pricing` | (curl) | Pricing table, $200 free credit, billing model, Nova-2 FAQ |

---

## Unverified / Weak Claims

- Nova-3 pre-recorded PAYG price: exact figure ($0.0043 vs $0.0048) — pricing discrepancy between two sections of the same fetched page; flagged above.
- Nova-2 pre-recorded PAYG price — not stated on current pricing page.
- Typical transcription latency — qualitative only ("often after only a few seconds").
- Full API key scope list — only example scopes fetched; complete role reference page not fetched.
- API key secret format/length — no format spec found in fetched docs.
- Multi-speaker assembled JSON example — structure is verified; specific numeric values in the combined example are illustrative.
