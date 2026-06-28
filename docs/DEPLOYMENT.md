# Production Deployment Guide

## Prerequisites

- Docker and Docker Compose
- SSL certificate and key (or use Let's Encrypt)
- OpenAI API key

## Environment Setup

Copy `.env.example` to `.env` and configure all values:

```bash
cp .env.example .env
```

**Required variables:**

| Variable | Description |
|---|---|
| `SECRET_KEY` | Django secret key (generate with `python -c "from django.core.crypto import get_random_string; print(get_random_string(50))"`) |
| `DEBUG` | Must be `False` in production |
| `ALLOWED_HOSTS` | Comma-separated list of valid hostnames |
| `DB_PASSWORD` | Strong database password |
| `OPENAI_API_KEY` | OpenAI API key for Whisper transcription |

## SSL Certificates

Place your SSL certificate files in `nginx/ssl/`:

```
nginx/ssl/cert.pem
nginx/ssl/key.pem
```

For Let's Encrypt, use certbot to generate certificates and symlink them.

## Deploy

```bash
docker-compose -f docker-compose.prod.yml up -d
```

This starts:
- **PostgreSQL 15** with persistent volume
- **Django backend** with Gunicorn (3 workers, 120s timeout)
- **React frontend** (production build)
- **Nginx** reverse proxy with SSL, rate limiting, and security headers

## Verify

```bash
# Health check
curl -k https://localhost/api/health/

# Check all services
docker-compose -f docker-compose.prod.yml ps
```

## Database Backups

```bash
# Backup
docker-compose -f docker-compose.prod.yml exec db pg_dump -U $DB_USER $DB_NAME > backup_$(date +%Y%m%d).sql

# Restore
docker-compose -f docker-compose.prod.yml exec -T db psql -U $DB_USER $DB_NAME < backup.sql
```

## Monitoring

- **Health endpoint:** `GET /api/health/` (no auth required)
- **Logs:** `docker-compose -f docker-compose.prod.yml logs -f backend`
- **API docs:** `https://yourdomain.com/api/docs/`

## Security Notes

- `SECRET_KEY` must not contain 'insecure' when `DEBUG=False` (app will refuse to start)
- Transport security (HSTS, SSL redirect, secure cookies) is automatically enabled when `DEBUG=False`
- Rate limiting: anonymous 10/min, authenticated 60/min (DRF), auth endpoints 5/s (nginx)
- JWT tokens are blacklisted after rotation
- Audio media is auth-gated and ownership-checked (`/media/audio/...` and `/api/audio/<id>/`); uploads are validated by magic bytes, not just Content-Type
- The backend image runs as a **non-root** user (uid 1000) — see the volume-ownership migration step below

## Prerequisites (first-time host setup)

```bash
# Traefik shares this external network with the app
docker network create web
```

## Migration notes for the security-hardened release

This release changes three operational facts. Apply on the next deploy:

1. **Whisper now runs inside compose.** A `whisper-server` service was added to
   `docker-compose.prod.yml`; `celery` reaches it by service name at
   `http://whisper-server:8000/v1`. **Remove any `OPENAI_BASE_URL` override from
   the host `.env`** (e.g. the old `http://172.17.0.1:8300/v1`) so the compose
   default is used, and stop/remove the old hand-run `whisper-server` container:
   ```bash
   docker rm -f whisper-server   # the pre-compose, hand-run container
   docker compose -f docker-compose.prod.yml up -d
   ```
   The model is cached in the `whisper_cache` volume (no re-download on recreate).

2. **Non-root backend image + existing volumes.** The hardened image runs as uid
   1000. Existing `media_files` / `static_files` volumes are root-owned from the
   old root image; chown them once so the non-root process can write:
   ```bash
   docker run --rm -v clio_media_files:/m -v clio_static_files:/s alpine \
     sh -c "chown -R 1000:1000 /m /s"
   ```
   (Volume names are prefixed by the compose project; adjust if yours differ.)

3. **Celery healthcheck.** `celery` now has a real healthcheck
   (`celery -A config inspect ping`) instead of the broken HTTP probe that
   reported the worker as permanently "unhealthy".
