import logging

from django.conf import settings
from django.contrib.auth.models import User
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import UserProfile
from .serializers import UserProfileSerializer, UserRegistrationSerializer, UserSerializer

logger = logging.getLogger(__name__)

ACCESS_COOKIE_NAME = 'access_token'
ACCESS_COOKIE_MAX_AGE = 60 * 60  # 1 hour, matches ACCESS_TOKEN_LIFETIME


def _set_access_cookie(response: Response, access_token: str) -> Response:
    """Set the access token as an httpOnly cookie on the response."""
    response.set_cookie(
        ACCESS_COOKIE_NAME,
        access_token,
        max_age=ACCESS_COOKIE_MAX_AGE,
        httponly=True,
        secure=not settings.DEBUG,
        samesite='Lax',
        path='/',
    )
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

        response = Response({
            'success': True,
            'message': 'User registered successfully',
            'data': {
                'user': UserSerializer(user).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': access_token,
                }
            }
        }, status=status.HTTP_201_CREATED)
        return _set_access_cookie(response, access_token)


class CookieTokenObtainPairView(TokenObtainPairView):
    """Login view that sets access token as httpOnly cookie."""

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            access_token = response.data.get('access', '')
            _set_access_cookie(response, access_token)
        return response


class CookieTokenRefreshView(TokenRefreshView):
    """Refresh view that sets new access token as httpOnly cookie."""

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            access_token = response.data.get('access', '')
            _set_access_cookie(response, access_token)
        return response


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
        refresh_token = request.data.get('refresh_token')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()

        response = Response({
            'success': True,
            'message': 'Logged out successfully'
        }, status=status.HTTP_200_OK)
        response.delete_cookie(ACCESS_COOKIE_NAME, path='/')
        return response
    except Exception as e:
        logger.error("Logout error: %s", e, exc_info=True)
        response = Response({
            'success': False,
            'message': 'Error logging out',
        }, status=status.HTTP_400_BAD_REQUEST)
        response.delete_cookie(ACCESS_COOKIE_NAME, path='/')
        return response
