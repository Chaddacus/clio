import logging

from django.conf import settings
from django.contrib.auth.models import User
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import UserProfile
from .serializers import UserProfileSerializer, UserRegistrationSerializer, UserSerializer

logger = logging.getLogger(__name__)

ACCESS_COOKIE_NAME = 'access_token'
ACCESS_COOKIE_MAX_AGE = 60 * 60  # 1 hour
REFRESH_COOKIE_NAME = 'refresh_token'
REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> Response:
    """Set both access and refresh tokens as httpOnly cookies."""
    response.set_cookie(
        ACCESS_COOKIE_NAME,
        access_token,
        max_age=ACCESS_COOKIE_MAX_AGE,
        httponly=True,
        secure=not settings.DEBUG,
        samesite='Lax',
        path='/',
    )
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=REFRESH_COOKIE_MAX_AGE,
        httponly=True,
        secure=not settings.DEBUG,
        samesite='Lax',
        path='/api/auth/',  # Only sent on auth endpoints
    )
    return response


def _clear_auth_cookies(response: Response) -> Response:
    """Delete both auth cookies."""
    response.delete_cookie(ACCESS_COOKIE_NAME, path='/')
    response.delete_cookie(REFRESH_COOKIE_NAME, path='/api/auth/')
    return response


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserRegistrationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        response = Response({
            'success': True,
            'message': 'User registered successfully',
            'data': {
                'user': UserSerializer(user).data,
            }
        }, status=status.HTTP_201_CREATED)
        return _set_auth_cookies(response, access_token, refresh_token)


class CookieTokenObtainPairView(TokenObtainPairView):
    """Login view that sets both tokens as httpOnly cookies."""

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            access_token = response.data.get('access', '')
            refresh_token = response.data.get('refresh', '')
            _set_auth_cookies(response, access_token, refresh_token)
            # Remove tokens from response body — they're in cookies now
            response.data = {'success': True, 'message': 'Login successful'}
        return response


class CookieTokenRefreshView(TokenRefreshView):
    """Refresh view that reads refresh token from cookie, sets new access cookie."""

    def post(self, request, *args, **kwargs):
        # Read refresh token from cookie instead of request body
        refresh_token = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if not refresh_token:
            return Response(
                {'success': False, 'message': 'No refresh token'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            token = RefreshToken(refresh_token)
            access_token = str(token.access_token)
            user_id = token.payload.get('user_id')
            user = User.objects.get(id=user_id)

            # Rotate: blacklist old, issue new refresh
            if settings.SIMPLE_JWT.get('ROTATE_REFRESH_TOKENS', False):
                token.blacklist()
                new_refresh = RefreshToken.for_user(user)
                new_refresh_str = str(new_refresh)
            else:
                new_refresh_str = refresh_token

            response = Response(
                {'success': True, 'message': 'Token refreshed'},
                status=status.HTTP_200_OK,
            )
            return _set_auth_cookies(response, access_token, new_refresh_str)

        except (TokenError, InvalidToken) as e:
            logger.warning("Token refresh failed: %s", e)
            response = Response(
                {'success': False, 'message': 'Invalid or expired refresh token'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            return _clear_auth_cookies(response)
        except User.DoesNotExist:
            response = Response(
                {'success': False, 'message': 'User not found'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            return _clear_auth_cookies(response)


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        profile, created = UserProfile.objects.get_or_create(user=self.request.user)
        return profile

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'data': serializer.data
        })

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        return Response({
            'success': True,
            'message': 'Profile updated successfully',
            'data': serializer.data
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        # Read refresh token from cookie
        refresh_token = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()

        response = Response({
            'success': True,
            'message': 'Logged out successfully'
        }, status=status.HTTP_200_OK)
        return _clear_auth_cookies(response)
    except Exception as e:
        logger.error("Logout error: %s", e, exc_info=True)
        response = Response({
            'success': False,
            'message': 'Error logging out',
        }, status=status.HTTP_400_BAD_REQUEST)
        return _clear_auth_cookies(response)
