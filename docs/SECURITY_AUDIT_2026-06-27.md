# Clio — Application Security & Quality Audit

**Date:** 2026-06-27
**Scope:** backend (Django/DRF, ~3.1k LOC), frontend (React/TS, ~7.2k LOC), deploy/infra, test coverage.
**Method:** read-only; 4 parallel auditors over disjoint slices; overlapping findings cross-confirmed. Nothing modified during the audit.

**Scorecard (calibrated, post-dedup):** 1 CRITICAL · 11 HIGH · 13 MEDIUM · ~12 LOW/INFO.

---

## 🔴 CRITICAL

### C1 — Any user's voice recordings are downloadable with no login
`backend/apps/core/media_views.py:98` (`AudioFileView.get`) is a plain Django `View` with **no auth and no ownership check** — the only gate is a path-traversal guard. Mounted at `media/audio/<path>` (`config/urls.py:34`); the API hands out these URLs (`serializers.py:45` `get_audio_url`). Guess/intercept a path → fetch anyone's audio unauthenticated.

The *intended* secure endpoint `serve_voice_note_audio` (`media_views.py:195`) is **dead code**: it checks `request.user.is_authenticated` via Django **session** auth, but the app is JWT-cookie-only, so `request.user` is always `AnonymousUser` → it always 404s. The broken secure path is *why* the app falls back to the wide-open one. Zero tests on either.

**Fix:** make `AudioFileView` a DRF `APIView` with `IsAuthenticated` + ownership match on the `user_id` path segment; convert `serve_voice_note_audio` to `@api_view` so JWT cookie auth populates `request.user`; add `test_media_views.py` (401 + IDOR).

---

## 🟠 HIGH

- **H1 — CSRF on every mutating endpoint** *(backend + frontend, same hole both ends).* `CookieJWTAuthentication` (`apps/core/auth.py:7`) never calls `enforce_csrf`, DRF marks views `csrf_exempt`, and the access JWT rides in an httpOnly cookie the browser auto-attaches. Frontend sends zero CSRF headers (`frontend/src/services/api.ts:11`). `SameSite=Lax` only partially mitigates. **Fix:** `enforce_csrf` in the auth class + an `ensure_csrf_cookie` endpoint + axios `X-CSRFToken` interceptor.
- **H2 — Tag IDOR.** `apps/voice_notes/serializers.py:58` & `:104` use `queryset=Tag.objects.all()` unscoped → users attach another user's tag (enumerable id). **Fix:** scope to `Tag.objects.filter(user=request.user)`.
- **H3 — CORS origin reflected with credentials on media responses.** `media_views.py:172` & `:241` echo attacker `Origin` + `Allow-Credentials: true`, bypassing the allowlist. **Fix:** delete manual headers; let `corsheaders` enforce.
- **H4 — File upload trusts client Content-Type / extension; no magic bytes.** `apps/core/services.py:236` + `models.py:52`. Chains with C1 → arbitrary stored file served unauthenticated. **Fix:** header/magic-byte inspection.
- **H5 — Backend production image runs as root** (`backend/Dockerfile`, no `USER`).
- **H6 — Prod image ships attack tooling** (`backend/Dockerfile:9-45`: tcpdump, gdb, strace, git, ipdb, ipython). **Fix:** multi-stage; prod stage app-only, non-root.
- **H7 — Python 3.9 EOL (Oct 2025) + floating `FROM python:3.9`** (`backend/Dockerfile:1`). **Fix:** `python:3.12-slim`, digest-pinned.
- **H8 — Dependency CVEs** (`backend/requirements.txt`): `Django==4.2.16` (CVE-2024-53908 SQLi, CVE-2024-53907 DoS — fixed 4.2.17), `Pillow==10.0.1` (CVE-2024-28219 — fixed 10.3.0), `python-multipart==0.0.6` (CVE-2024-24762 ReDoS — fixed 0.0.7), `openai>=1.30.0` unpinned.
- **H9 — Debug test page routed in production.** `MinimalRecorderTest` routed at `/test-minimal` (`frontend/src/App.tsx:14,124`).
- **H10 — whisper-server is undocumented single-point infra.** No references to `8300`/`172.17.0.1` anywhere in repo; not in compose, DEPLOYMENT.md, or README. Caused the 2026-06-27 transcription outage. **Fix:** add the service block + bridge-gateway binding requirement to compose and runbook.
- **H11 — Two untested critical endpoints:** `POST /api/notes/` (`views.py:79`) and `POST /api/transcribe/` (`views.py:148`) have no HTTP-level test.

---

## 🟡 MEDIUM (condensed)

- Backend: `SECURE_PROXY_SSL_HEADER` set unconditionally incl. DEBUG (`settings.py:205`); `user_stats` ZeroDivision when `storage_quota_mb=0` (`views.py:271`); registration only on shared `10/min` anon throttle + username-enumeration timing (`users/views.py:54`).
- Frontend: blob-URL leak `URL.createObjectURL` never revoked (`RecordPage.tsx:165`); `logout('')` sends empty `refresh_token` (`useAuth.tsx:129`); `user.id` hardcoded to `0` (`useAuth.tsx:43`); `React.FC` used without `React` import (`useAuth.tsx:172`); `parseDurationToSeconds` duplicated verbatim (`NoteDetailPage.tsx:12` ≡ `NotesGrid.tsx:22`); ~300 lines duplicated across the two live AudioPlayers.
- Infra: no `.dockerignore` → `COPY . .` bakes `.coverage`, tests, local `media/` into images; `SECRET_KEY=your-secret-key-here` in `docker-compose.yml:36,95`; CI actions tag-pinned not SHA-pinned; `web` external network undocumented; **prod nginx security headers live in a dead file** (`frontend/nginx.conf` never `COPY`'d; active inline config in `Dockerfile.prod:31-61` has none).
- Coverage: token-rotation blacklist never asserted; cookie `secure` flag never tested; `get_audio_duration` ffprobe path untested; **two `test_transcription_service.py:16-32` tests are broken mocks that pass vacuously.**

## ⚪ LOW / INFO (condensed)

`Content-Disposition` filename unsanitized for `"`/CRLF (`media_views.py:246`); Celery broker defaults to unauthenticated Redis (`settings.py:198`); temp file always `.webm` suffix (`services.py:74`); `X-Request-ID` echoes client header into logs (`middleware.py:19`); dead files (`SimpleAudioPlayer`, `AudioDebugPanel`, `RecordingDebugger`, `useAudioPlayer.ts.backup`, `nginx/nginx.conf`, `test_audio.webm`, tracked `backend/.coverage`); `error: any` / `ApiResponse<T=any>` type escapes; no Traefik HTTP→HTTPS redirect label; inline nginx missing proxy timeouts for 50MB uploads; CRA/`react-query v3` EOL tooling.

---

## Cross-cutting themes

1. **The exploit chain that matters most:** no magic-byte validation (H4) + unauthenticated media serving (C1) + reflected-CORS/attacker `Content-Disposition` (H3) = upload-and-serve arbitrary content to other users.
2. **Auth model is half-wired for JWT cookies:** CSRF not enforced (H1), the session-based media view is dead (C1), cookie `secure`/rotation untested. The cookie-JWT migration was never finished end-to-end.
3. **Repo ≠ reality:** security headers, the celery healthcheck, and whisper-server all live (or fail to live) outside version control. Deployed compose has drifted from the repo.
4. **Coverage:** 22/32 backend surfaces tested; every untested surface is high-risk. Frontend has zero unit tests (Playwright E2E only). Two existing service tests are silently broken.
