"""CORS preflight contract for the headers the frontend actually sends.

The browser sends X-Request-ID on note creation so the trace starts client-side
(frontend/src/services/api.ts). If the header is missing from
CORS_ALLOW_HEADERS the preflight succeeds but the browser drops the real POST,
so uploads silently fail on any cross-origin deployment (the dev stack, CI e2e).
"""
import pytest


@pytest.mark.django_db
def test_preflight_allows_x_request_id(api_client):
    resp = api_client.options(
        '/api/notes/',
        HTTP_ORIGIN='http://localhost:3011',
        HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS='content-type,x-request-id',
    )
    assert resp.status_code == 200
    allowed = {h.strip().lower() for h in resp['Access-Control-Allow-Headers'].split(',')}
    assert 'x-request-id' in allowed
    assert 'content-type' in allowed
    assert resp['Access-Control-Allow-Origin'] == 'http://localhost:3011'
