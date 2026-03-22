import logging

from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """DRF exception handler that prevents internal details from leaking."""
    response = exception_handler(exc, context)

    if response is None:
        # Unhandled exception — log it, return generic 500
        logger.error("Unhandled exception: %s", exc, exc_info=True)
        from rest_framework import status
        from rest_framework.response import Response
        return Response(
            {'success': False, 'message': 'Internal server error'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return response
