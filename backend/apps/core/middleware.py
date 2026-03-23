import logging
import uuid
from contextvars import ContextVar

_request_id: ContextVar[str] = ContextVar('request_id', default='')


def get_request_id() -> str:
    return _request_id.get()


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
