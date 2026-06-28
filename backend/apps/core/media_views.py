import mimetypes
import os
from email.utils import formatdate
from urllib.parse import quote

from django.conf import settings
from django.http import (
    FileResponse,
    Http404,
    HttpResponseForbidden,
    HttpResponseNotFound,
    StreamingHttpResponse,
)
from django.shortcuts import get_object_or_404
from django.views import View
from django.views.decorators.http import require_GET
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from apps.core.auth import CookieJWTAuthentication
from apps.voice_notes.models import VoiceNote


def _uncacheable(response):
    """Mark a deny/error response non-cacheable.

    These media endpoints sit behind a CDN (Cloudflare) that keys its cache on
    URL, not on the auth cookie. Without no-store, a single unauthenticated or
    cross-user probe (403/404) gets cached at the edge and is then served back
    to the legitimate owner — denying them their own audio. no-store stops the
    shared cache from ever storing a per-request authz decision.
    """
    response['Cache-Control'] = 'no-store'
    return response


def authenticate_cookie_user(request):
    """Authenticate via the access_token JWT cookie. Returns a user or None.

    Media endpoints are hit directly by the browser (e.g. <audio src>), which
    sends the httpOnly access_token cookie automatically. We reuse the same JWT
    cookie authenticator the API uses rather than Django session auth (the app
    issues no Django session).
    """
    try:
        result = CookieJWTAuthentication().authenticate(request)
    except (AuthenticationFailed, InvalidToken, TokenError):
        return None
    if result is None:
        return None
    user, _token = result
    return user if (user and user.is_authenticated) else None


def parse_range_header(range_header, file_size):
    """
    Parse HTTP Range header and return start and end byte positions.
    Supports formats like: bytes=0-1023, bytes=1024-, bytes=-1024
    """
    if not range_header or not range_header.startswith('bytes='):
        return None, None

    try:
        range_spec = range_header[6:]  # Remove 'bytes=' prefix
        if ',' in range_spec:
            # Multiple ranges not supported, use first one
            range_spec = range_spec.split(',')[0]

        if '-' not in range_spec:
            return None, None

        start_str, end_str = range_spec.split('-', 1)

        if start_str == '' and end_str == '':
            return None, None
        elif start_str == '':
            # Suffix-byte-range-spec: bytes=-500 (last 500 bytes)
            start = max(0, file_size - int(end_str))
            end = file_size - 1
        elif end_str == '':
            # Range from start to end: bytes=500-
            start = int(start_str)
            end = file_size - 1
        else:
            # Both start and end specified: bytes=0-1023
            start = int(start_str)
            end = int(end_str)

        # Validate range
        if start >= file_size:
            return None, None

        end = min(end, file_size - 1)
        if start > end:
            return None, None

        return start, end

    except (ValueError, IndexError):
        return None, None


def stream_file_range(file_path, start=None, end=None, chunk_size=8192):
    """
    Stream a file with optional range support for efficient audio streaming.
    """
    file_size = os.path.getsize(file_path)

    with open(file_path, 'rb') as f:
        if start is not None:
            f.seek(start)

        remaining = (end - start + 1) if (start is not None and end is not None) else file_size

        while remaining > 0:
            chunk_size_to_read = min(chunk_size, remaining)
            chunk = f.read(chunk_size_to_read)

            if not chunk:
                break

            remaining -= len(chunk)
            yield chunk


class AudioFileView(View):
    """
    Custom view to serve audio files with proper MIME types and CORS headers.
    This ensures WebM files are served as audio/webm instead of video/webm.
    """

    def format_http_date(self, timestamp):
        """Format timestamp for HTTP headers"""
        return formatdate(timestamp, usegmt=True)

    def get(self, request, path):
        # Construct the full file path
        file_path = os.path.join(settings.MEDIA_ROOT, 'audio', path)

        # Security check - ensure the path is within MEDIA_ROOT
        if not os.path.abspath(file_path).startswith(os.path.abspath(settings.MEDIA_ROOT)):
            return _uncacheable(HttpResponseNotFound("Invalid file path"))

        # AuthN: require a valid access_token cookie.
        user = authenticate_cookie_user(request)
        if user is None:
            return _uncacheable(HttpResponseForbidden("Authentication required"))

        # AuthZ: the requester must own the voice note this audio belongs to.
        # audio_file is stored relative to MEDIA_ROOT as 'audio/<user_id>/<file>'.
        if not VoiceNote.objects.filter(audio_file=f'audio/{path}', user=user).exists():
            return _uncacheable(HttpResponseNotFound("File not found"))

        # Check if file exists
        if not os.path.exists(file_path):
            return _uncacheable(HttpResponseNotFound("File not found"))

        # Get file info
        file_size = os.path.getsize(file_path)
        _, ext = os.path.splitext(path.lower())

        # Custom MIME type mapping for audio files with codec optimization
        audio_mime_types = {
            '.webm': 'audio/webm; codecs=opus',  # Specify Opus codec for better browser optimization
            '.wav': 'audio/wav',
            '.mp3': 'audio/mpeg',
            '.ogg': 'audio/ogg; codecs=opus',  # OGG usually contains Opus
            '.m4a': 'audio/mp4; codecs=aac',   # M4A contains AAC
            '.aac': 'audio/aac',
            '.opus': 'audio/ogg; codecs=opus', # Pure Opus files
        }

        # Determine content type
        if ext in audio_mime_types:
            content_type = audio_mime_types[ext]
        else:
            # Fall back to mimetypes module
            content_type, _ = mimetypes.guess_type(file_path)
            if not content_type:
                content_type = 'application/octet-stream'

        # Parse Range header for streaming support
        range_header = request.META.get('HTTP_RANGE')
        start, end = parse_range_header(range_header, file_size) if range_header else (None, None)

        try:
            # Handle Range requests for streaming
            if range_header and start is not None and end is not None:
                # Create streaming response with partial content
                response = StreamingHttpResponse(
                    stream_file_range(file_path, start, end, chunk_size=16384),  # 16KB chunks for better streaming
                    status=206,  # HTTP 206 Partial Content
                    content_type=content_type
                )

                # Set range-specific headers
                response['Content-Range'] = f'bytes {start}-{end}/{file_size}'
                response['Content-Length'] = str(end - start + 1)

            else:
                # Full file request - still use streaming for large files

                # Use streaming for files larger than 1MB to avoid memory issues
                if file_size > 1024 * 1024:  # 1MB threshold
                    response = StreamingHttpResponse(
                        stream_file_range(file_path, chunk_size=16384),
                        content_type=content_type
                    )
                else:
                    # Small files can use FileResponse
                    response = FileResponse(
                        open(file_path, 'rb'),
                        content_type=content_type
                    )

                response['Content-Length'] = str(file_size)

            # Set headers for better streaming and browser compatibility.
            # CORS is handled by django-cors-headers middleware against the
            # configured allowlist — do NOT reflect Origin here (that would
            # re-enable credentialed wildcard CORS).
            response['Accept-Ranges'] = 'bytes'

            # Optimize cache headers for large audio files (24 hours cache, but allow conditional requests)
            response['Cache-Control'] = 'private, max-age=86400, must-revalidate'
            response['ETag'] = f'"{file_size}-{int(os.path.getmtime(file_path))}"'
            response['Last-Modified'] = self.format_http_date(os.path.getmtime(file_path))

            # Add audio-specific optimization headers
            response['Vary'] = 'Accept-Encoding, Range'

            # Note: Connection header is hop-by-hop and handled by server
            # response['Connection'] = 'keep-alive'  # Removed - causes 500 error in development

            return response

        except IOError:
            return _uncacheable(HttpResponseNotFound("File could not be read"))


@require_GET
def serve_voice_note_audio(request, note_id):
    """
    Serve audio file for a specific voice note with authentication.
    This provides an authenticated endpoint for audio files.
    """
    # AuthN via the access_token JWT cookie (the app issues no Django session,
    # so request.user is always anonymous in a plain Django view).
    user = authenticate_cookie_user(request)
    if user is None:
        return _uncacheable(HttpResponseForbidden("Authentication required"))

    # Get the voice note and verify ownership
    voice_note = get_object_or_404(
        VoiceNote,
        id=note_id,
        user=user
    )

    if not voice_note.audio_file:
        raise Http404("No audio file associated with this note")

    # Get the file path
    file_path = voice_note.audio_file.path

    if not os.path.exists(file_path):
        raise Http404("Audio file not found on disk")

    # Determine content type based on file extension
    _, ext = os.path.splitext(file_path.lower())
    audio_mime_types = {
        '.webm': 'audio/webm',
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
    }

    content_type = audio_mime_types.get(ext, 'application/octet-stream')

    # Log the request (can be removed in production)
    # print(f"[serve_voice_note_audio] Serving note {note_id} audio as {content_type}")

    # Create response
    response = FileResponse(
        open(file_path, 'rb'),
        content_type=content_type
    )

    # CORS handled by django-cors-headers middleware (no Origin reflection here).
    # Set file-related headers. RFC 5987-encode the filename to neutralize
    # quote/CRLF header-injection via attacker-influenced filenames.
    response['Accept-Ranges'] = 'bytes'
    safe_name = quote(os.path.basename(file_path))
    response['Content-Disposition'] = f"inline; filename*=UTF-8''{safe_name}"

    return response
