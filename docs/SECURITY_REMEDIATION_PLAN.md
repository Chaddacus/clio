# Clio — Security Remediation Plan

Companion to [SECURITY_AUDIT_2026-06-27.md](./SECURITY_AUDIT_2026-06-27.md). Lifecycle: **plan → implement → test → validate → commit → push**.

## Scope decision

The audit surfaced 1 CRITICAL + 11 HIGH + 13 MEDIUM + ~12 LOW. Shipping all of it as one change is unsafe and unreviewable. This PR delivers **Tier 1 (app-layer security)** + **Tier 2 (supply-chain / infra hardening)** + tests for the critical paths. **Tier 3 (pure code-quality)** is documented here and deferred to a separate PR — it carries no exploit risk and would balloon the diff.

## Solution ladder

- **L1 (patch):** scope a queryset, add a permission check, bump a version. Used for H2, H3, H8, settings 1-liners.
- **L2 (abstraction):** introduce a reusable header-sniff validator (H4), a CSRF-cookie endpoint + axios interceptor (H1), an ownership-checked media `APIView` (C1). Used where the fix is a small new seam, not a new surface.
- **L3 (operating surface):** none. No new service, persistence layer, or orchestration is introduced. whisper-server (H10) is *documented* into the existing compose surface, not a new runtime.

**Selected layer:** L1 for the mechanical fixes, L2 for the auth/upload/media seams. L3 explicitly rejected — existing primitives (DRF permissions, Django CSRF middleware, multipart parser) satisfy every requirement.

## Reuse-first / primitives considered

- **C1 media auth** → reuse DRF `IsAuthenticated` + `APIView`, not a custom middleware.
- **H1 CSRF** → reuse Django's `CsrfViewMiddleware` token machinery + DRF `enforce_csrf` (the exact mechanism `SessionAuthentication` already uses), not a bespoke token scheme.
- **H4 upload** → magic-byte header check in stdlib, **no new `python-magic`/libmagic dependency** (avoids a system-lib in the image).
- **H8 deps** → version bumps only, no library swaps.

## Estimated blast radius

~22 files, ~500–650 LOC (incl. tests + docs). Over the 3-file/500-LOC gate — **justified**: explicit user-directed security remediation with this written plan; changes are file-disjoint per tier and individually small.

---

## Tier 1 — App-layer security (backend + frontend)

| ID | Fix | Files | Layer |
|---|---|---|---|
| C1 | Media auth + ownership on both media views (JWT-cookie auth in the Django view; rejected DRF `@api_view` to avoid content-negotiation/throttle interfering with binary streaming) | `apps/core/media_views.py` | L2 |
| H2 | Scope `tag_ids` queryset to request user | `apps/voice_notes/serializers.py` | L1 |
| H3 | Remove manual reflected-CORS headers from media responses | `apps/core/media_views.py` | L1 |
| H4 | Magic-byte upload validation (stdlib, no new dep) | `apps/core/services.py` | L2 |
| M | `SECURE_PROXY_SSL_HEADER` only when `not DEBUG`; `user_stats` zero-guard | `config/settings.py`, `apps/voice_notes/views.py` | L1 |
| L | Sanitize `Content-Disposition` filename | `apps/core/media_views.py` | L1 |
| H9 | Remove `/test-minimal` route + delete debug component/hook | `frontend/src/App.tsx`, delete `MinimalRecorderTest.tsx`, `useMinimalRecorder.ts` | L1 |

## Tier 2 — Supply-chain / infra hardening

| ID | Fix | Files |
|---|---|---|
| H8 | Bump Django 4.2.20, Pillow 10.4.0, python-multipart 0.0.7, pin openai | `backend/requirements.txt` |
| H5/H6/H7 | Multi-stage backend Dockerfile: `python:3.12-slim`, non-root user, no debug tooling | `backend/Dockerfile` |
| M | `.dockerignore` for both build contexts | `backend/.dockerignore`, `frontend/.dockerignore` |
| M | Parameterize `SECRET_KEY` in dev compose | `docker-compose.yml` |
| M | Security headers + upload proxy timeouts in active nginx config | `frontend/Dockerfile.prod` |
| H10 | Document whisper-server (compose service block + bridge-gateway binding + runbook note) | `docker-compose.prod.yml`, `docs/DEPLOYMENT.md` |

## Tests (close the critical-path gaps)

- `tests/test_media_views.py` — unauth → 403, IDOR (user B cannot fetch user A's audio), owner → 200.
- `tests/test_voice_notes.py` — add `POST /api/notes/` multipart create (mocked Celery) + magic-byte rejection.
- `tests/test_cookie_auth.py` — CSRF enforced on authenticated mutation (no token → 403, token → ok).
- `tests/test_transcription_service.py` — fix the 2 broken init mocks.
- `tests/test_voice_notes.py` — `user_stats` zero-quota guard.

## Tier 3 — DEFERRED (separate PR, no exploit risk)

Code dedup (`parseDurationToSeconds`, AudioPlayer hook extraction), dead-code deletion (`SimpleAudioPlayer`, `AudioDebugPanel`, `RecordingDebugger`, `useAudioPlayer.ts.backup`, `nginx/nginx.conf`, `test_audio.webm`), TS type escapes (`: any`, `ApiResponse<T=any>`), frontend unit-test bootstrap, CI action SHA-pinning, Celery Redis auth, registration throttle scope, `X-Request-ID` sanitize, temp-file suffix, Traefik HTTP→HTTPS redirect.

## Deferred to immediate follow-up: H1 CSRF

H1 (CSRF) was pulled from this PR after discovering the dev/E2E topology is
**cross-origin** (SPA `:3011` → backend `:8011` directly, `REACT_APP_API_URL`
absolute). A standard double-submit cookie can't be read by the SPA cross-origin,
so naive `enforce_csrf` would break the very login→mutate flow this repo requires
us to validate with Playwright. Doing it correctly is its own slice:

- Backend: add `enforce_csrf(request)` to `CookieJWTAuthentication.authenticate`
  (mirrors DRF `SessionAuthentication`); add a `GET /api/auth/csrf/` endpoint
  decorated `@ensure_csrf_cookie` that **also returns `get_token(request)` in the
  body** so the SPA can echo it cross-origin without reading the cookie; add dev
  origins to `CSRF_TRUSTED_ORIGINS`.
- Frontend: fetch the token at boot, store in memory, axios request interceptor
  injects `X-CSRFToken` on unsafe methods.
- Validate end-to-end with Playwright (login → create note → logout) before merge.

Existing backend tests are unaffected (Django's test client sets
`_dont_enforce_csrf_checks`, which DRF's `CSRFCheck` honors).

## Validation performed (this PR)

- Backend: `pytest` 80 passed, coverage 80.66% (gate 60%), `ruff` clean, `mypy` clean.
- Stack: `docker compose build` + `up` green; backend image confirmed non-root
  (uid 1000), no debug tooling, Python 3.12. Caught + fixed a `pkg_resources`
  `ModuleNotFoundError` (3.12-slim drops setuptools) — added `setuptools` to
  requirements.
- Playwright (login-first, real methods): UI register→dashboard; valid upload
  →202; owner media GET →200; **unauth media GET →403 (C1)**; disguised upload
  →400 (H4); `/test-minimal` debug harness gone (H9).

## Prod-only items not E2E-validated here (verify on deploy)

The dev E2E uses `frontend/Dockerfile` (not `Dockerfile.prod`) and dev compose,
so these need a prod smoke test: nginx security headers / timeouts
(`Dockerfile.prod`), the `whisper-server` compose service + model-cache volume,
the non-root volume-ownership migration, and a Content-Security-Policy (CSP),
which is itself deferred to the follow-up so it can be tuned against the real
build without breaking the SPA.
