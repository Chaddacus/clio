from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from apps.core.media_views import AudioFileView, serve_voice_note_audio


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    return Response({'status': 'ok'})


urlpatterns = [
    path('api/health/', health_check, name='health-check'),
    path('admin/', admin.site.urls),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    path('api/auth/', include('apps.users.urls')),
    path('api/', include('apps.api.urls')),
    
    # Custom audio serving endpoints with proper MIME types
    path('api/audio/<int:note_id>/', serve_voice_note_audio, name='serve_voice_note_audio'),
    re_path(r'^media/audio/(?P<path>.*)$', AudioFileView.as_view(), name='serve_audio_file'),
]

# Serve media files - custom audio serving takes precedence for audio files
# In production, this should be handled by nginx or similar  
if settings.DEBUG:
    from django.views.static import serve
    import re
    
    # Add a catch-all for non-audio media files
    urlpatterns += [
        re_path(r'^media/(?!audio/)(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)