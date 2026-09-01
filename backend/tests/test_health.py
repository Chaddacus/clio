"""The liveness probe must answer 200 regardless of the anonymous throttle."""
import pytest
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_health_is_not_throttled(settings):
    rates = dict(settings.REST_FRAMEWORK.get('DEFAULT_THROTTLE_RATES', {}))
    rates['anon'] = '1/hour'
    cache.clear()
    with override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, 'DEFAULT_THROTTLE_RATES': rates}):
        client = APIClient()
        for _ in range(3):
            response = client.get('/api/health/')
            assert response.status_code == 200
            assert response.json() == {'status': 'ok'}
