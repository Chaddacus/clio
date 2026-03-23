import pytest


@pytest.mark.django_db
class TestRequestIDMiddleware:
    def test_response_has_request_id(self, api_client):
        resp = api_client.get('/api/health/')
        assert 'X-Request-ID' in resp

    def test_custom_request_id_echoed(self, api_client):
        custom_id = 'test-trace-id-12345'
        resp = api_client.get('/api/health/', HTTP_X_REQUEST_ID=custom_id)
        assert resp['X-Request-ID'] == custom_id

    def test_generated_request_id_is_uuid_format(self, api_client):
        resp = api_client.get('/api/health/')
        request_id = resp['X-Request-ID']
        # UUID4 format: 8-4-4-4-12 hex chars
        parts = request_id.split('-')
        assert len(parts) == 5
        assert len(parts[0]) == 8
