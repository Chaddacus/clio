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
