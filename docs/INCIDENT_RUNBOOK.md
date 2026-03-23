# Incident Response Runbook

## Health Check

`GET /api/health/` — unauthenticated, returns `{"status": "ok"}`.

**Monitor:** Ping every 30s from external monitoring. Alert on 2 consecutive failures.

## Common Failure Modes

### 1. Celery Queue Backup (transcriptions stuck in "processing")

**Symptoms:** Notes stay in `processing` status indefinitely.

**Triage:**
```bash
docker compose logs celery --tail 50
docker compose exec redis redis-cli llen celery  # Queue depth
```

**Resolution:**
- Restart worker: `docker compose restart celery`
- If queue is large: scale workers: `docker compose up -d --scale celery=3`
- Check OpenAI API status at status.openai.com

### 2. OpenAI API Degradation (circuit breaker open)

**Symptoms:** All transcriptions fail immediately. Log shows "Circuit breaker open".

**Triage:**
```bash
docker compose logs backend --tail 20 | grep "circuit"
```

**Resolution:**
- Wait 60s for circuit breaker auto-reset
- Check OpenAI API status
- If persistent: restart backend to reset circuit: `docker compose restart backend`

### 3. Database Connection Pool Exhaustion

**Symptoms:** 500 errors on all endpoints. Logs show "connection refused" or "too many connections".

**Triage:**
```bash
docker compose exec db psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
```

**Resolution:**
- Restart backend: `docker compose restart backend celery`
- If persistent: increase `max_connections` in PostgreSQL config

### 4. Disk Full on Media Volume

**Symptoms:** Audio upload fails with 500. Logs show "No space left on device".

**Triage:**
```bash
docker compose exec backend df -h /app/media
```

**Resolution:**
- Clean old failed transcriptions: `docker compose exec backend python manage.py shell -c "from apps.voice_notes.models import VoiceNote; VoiceNote.objects.filter(status='failed', audio_file__isnull=False).delete()"`
- Expand volume or add external storage

### 5. Redis Down (Celery cannot process tasks)

**Symptoms:** New transcriptions stay in "processing". Celery logs show connection errors.

**Triage:**
```bash
docker compose exec redis redis-cli ping
```

**Resolution:**
- Restart Redis: `docker compose restart redis`
- Check Redis memory: `docker compose exec redis redis-cli info memory`

## Rollback Procedure

```bash
# 1. Identify the last known good image
docker compose images

# 2. Stop current services
docker compose down

# 3. Checkout last known good commit
git checkout <commit-hash>

# 4. Rebuild and restart
docker compose build --no-cache
docker compose up -d

# 5. Run migrations (backward if needed)
docker compose exec backend python manage.py migrate
```

## Database Backup & Recovery

```bash
# Backup
docker compose exec db pg_dump -U postgres voice_notes_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
docker compose exec -T db psql -U postgres voice_notes_db < backup.sql
```

## Escalation

1. **L1:** Check health endpoint, restart affected service
2. **L2:** Check logs, review recent deployments, rollback if needed
3. **L3:** Database recovery, data integrity investigation
