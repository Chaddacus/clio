import logging
import uuid
from contextvars import ContextVar

_request_id: ContextVar[str] = ContextVar('request_id', default='')


def get_request_id() -> str:
    return _request_id.get()


def set_request_id(value: str) -> str:
    """Set the active trace/request id (used to carry it into Celery tasks).

    Returns the value actually set, generating one if none was provided so a
    task always runs under a non-empty trace id.
    """
    value = value or str(uuid.uuid4())
    _request_id.set(value)
    return value


class RequestIDMiddleware:
    """Inject or generate X-Request-ID for every request."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.META.get('HTTP_X_REQUEST_ID', str(uuid.uuid4()))
        request.request_id = request_id
        _request_id.set(request_id)

        response = self.get_response(request)
        response['X-Request-ID'] = request_id
        return response


class RequestIDFilter(logging.Filter):
    """Logging filter that adds request_id to log records."""

    def filter(self, record):
        record.request_id = _request_id.get()
        return True
