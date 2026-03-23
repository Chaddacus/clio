from rest_framework import status
from rest_framework.test import APIRequestFactory

from apps.core.exception_handler import custom_exception_handler


class TestCustomExceptionHandler:
    def test_unhandled_exception_returns_generic_500(self):
        factory = APIRequestFactory()
        request = factory.get('/')

        exc = RuntimeError("secret internal error")
        context = {'view': None, 'request': request}

        response = custom_exception_handler(exc, context)
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert response.data['success'] is False
        assert 'secret internal error' not in response.data['message']
        assert response.data['message'] == 'Internal server error'

    def test_drf_exception_passed_through(self):
        from rest_framework.exceptions import NotFound

        factory = APIRequestFactory()
        request = factory.get('/')

        exc = NotFound("Not found")
        context = {'view': None, 'request': request}

        response = custom_exception_handler(exc, context)
        assert response.status_code == status.HTTP_404_NOT_FOUND
