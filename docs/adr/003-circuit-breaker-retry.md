# ADR-003: Circuit Breaker + Retry for OpenAI API

## Status
Accepted

## Context
The OpenAI Whisper API is an external dependency that can experience transient failures (timeouts, rate limits, 5xx errors) or sustained outages. Without protection, every request during an outage would block for the full timeout period before failing.

## Decision
Implement a two-layer resilience pattern:

1. **Retry with backoff:** Max 2 retries, exponential backoff (1s, 2s). Only retries transient errors (timeout, rate limit, connection, 5xx). Permanent errors (400, 401) fail immediately.

2. **Circuit breaker:** Process-wide `CircuitBreaker` class (threshold=5 failures, reset_timeout=60s). When open, subsequent calls fail fast with "Circuit breaker open" without hitting the API. Resets automatically after the timeout.

## Alternatives Considered
- **tenacity library:** More features but adds a dependency for something achievable in ~30 LOC.
- **No circuit breaker:** Retries alone don't prevent cascading failures during sustained outages.

## Consequences
- Transient failures are transparent to users (auto-retry)
- Sustained outages fail fast after 5 failures instead of blocking workers
- Circuit breaker resets automatically — no manual intervention needed
- Thread-safe via threading.Lock for multi-worker safety
