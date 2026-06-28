import struct

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework_simplejwt.tokens import AccessToken

from apps.voice_notes.models import VoiceNote


def _wav_bytes(payload=2048):
    data = b'\x80' * payload
    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF', 36 + len(data), b'WAVE', b'fmt ', 16, 1, 1,
        8000, 8000, 1, 8, b'data', len(data),
    )
    return header + data


def _make_note(user):
    return VoiceNote.objects.create(
        user=user,
        title='audio note',
        status='completed',
        audio_file=SimpleUploadedFile('clip.wav', _wav_bytes(), content_type='audio/wav'),
    )


def _set_cookie(api_client, user):
    api_client.cookies['access_token'] = str(AccessToken.for_user(user))


@pytest.mark.django_db
class TestAudioFileView:
    """C1: /media/audio/<path> must require auth and ownership."""

    def test_unauthenticated_is_forbidden(self, api_client, user, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        note = _make_note(user)
        resp = api_client.get(f'/media/{note.audio_file.name}')
        assert resp.status_code == status.HTTP_403_FORBIDDEN
        # Deny responses must be no-store so a shared CDN (keyed on URL, not the
        # auth cookie) can't cache the 403 and serve it back to the owner.
        assert resp.headers['Cache-Control'] == 'no-store'

    def test_owner_can_fetch(self, api_client, user, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        note = _make_note(user)
        _set_cookie(api_client, user)
        resp = api_client.get(f'/media/{note.audio_file.name}')
        assert resp.status_code == status.HTTP_200_OK
        # Success is browser-cacheable but private — never stored by a shared CDN.
        assert 'private' in resp.headers['Cache-Control']

    def test_other_user_cannot_fetch(self, api_client, user, user_b, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        note = _make_note(user)
        _set_cookie(api_client, user_b)
        resp = api_client.get(f'/media/{note.audio_file.name}')
        assert resp.status_code == status.HTTP_404_NOT_FOUND
        assert resp.headers['Cache-Control'] == 'no-store'


@pytest.mark.django_db
class TestServeVoiceNoteAudio:
    """/api/audio/<id>/ must authenticate via JWT cookie and enforce ownership."""

    def test_unauthenticated_is_forbidden(self, api_client, user, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        note = _make_note(user)
        resp = api_client.get(f'/api/audio/{note.id}/')
        assert resp.status_code == status.HTTP_403_FORBIDDEN
        assert resp.headers['Cache-Control'] == 'no-store'

    def test_owner_can_fetch(self, api_client, user, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        note = _make_note(user)
        _set_cookie(api_client, user)
        resp = api_client.get(f'/api/audio/{note.id}/')
        assert resp.status_code == status.HTTP_200_OK

    def test_other_user_cannot_fetch(self, api_client, user, user_b, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        note = _make_note(user)
        _set_cookie(api_client, user_b)
        resp = api_client.get(f'/api/audio/{note.id}/')
        assert resp.status_code == status.HTTP_404_NOT_FOUND
