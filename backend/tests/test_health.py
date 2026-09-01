"""The liveness probe must answer 200 regardless of the anonymous throttle.

conftest.py switches throttling off for the whole suite, so this test puts the
production default back on the base view class and tightens the anon rate to
one request per hour. A control request proves the throttle is really biting;
the health probe must still answer 200 every time.
"""
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView


@pytest.mark.django_db
def test_health_is_not_throttled(monkeypatch):
    monkeypatch.setattr(APIView, 'throttle_classes', [AnonRateThrottle])
    monkeypatch.setattr(AnonRateThrottle, 'THROTTLE_RATES', {'anon': '1/hour'})
    cache.clear()
    client = APIClient()

    # Control: an ordinary anonymous endpoint is throttled on the second call.
    client.post('/api/auth/register/', {})
    assert client.post('/api/auth/register/', {}).status_code == 429

    for _ in range(3):
        response = client.get('/api/health/')
        assert response.status_code == 200
        assert response.json() == {'status': 'ok'}
