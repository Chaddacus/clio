import time

from apps.core.services import CircuitBreaker


class TestCircuitBreaker:
    def test_circuit_breaker_opens_after_threshold(self):
        cb = CircuitBreaker(threshold=3)
        cb.record_failure()
        cb.record_failure()
        cb.record_failure()
        assert cb.is_open() is True

    def test_circuit_breaker_resets_after_timeout(self):
        cb = CircuitBreaker(threshold=3, reset_timeout=0.1)
        cb.record_failure()
        cb.record_failure()
        cb.record_failure()
        assert cb.is_open() is True
        time.sleep(0.2)
        assert cb.is_open() is False

    def test_circuit_breaker_records_success_resets(self):
        cb = CircuitBreaker(threshold=3)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()
        assert cb.is_open() is False

    def test_circuit_breaker_not_open_below_threshold(self):
        cb = CircuitBreaker(threshold=3)
        cb.record_failure()
        cb.record_failure()
        assert cb.is_open() is False
