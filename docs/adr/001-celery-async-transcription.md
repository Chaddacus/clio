# ADR-001: Celery + Redis for Async Transcription

## Status
Accepted

## Context
OpenAI Whisper API calls take 10-30 seconds. Processing transcription synchronously in the Django request cycle blocks Gunicorn workers, causing request timeouts and degraded throughput under load.

## Decision
Use Celery with Redis as the task broker for async transcription. Views return 202 Accepted immediately and dispatch `transcribe_voice_note_task` / `retranscribe_voice_note_task` to the Celery worker.

## Alternatives Considered
- **Django async views:** Zero infrastructure but tasks are lost on worker crash, no retry, no horizontal scaling.
- **Django-Q:** Lighter than Celery but less mature, DB-based queue is slower.

## Consequences
- Adds Redis dependency and Celery worker process to the deployment
- Transcription results require client polling (status field on VoiceNote)
- Tasks have built-in retry with max_retries=2 and exponential backoff
- Circuit breaker prevents cascading failures during OpenAI outages
