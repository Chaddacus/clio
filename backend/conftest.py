import io

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.users.models import UserProfile


@pytest.fixture(autouse=True)
def _disable_throttling(settings):
    """Disable rate limiting during tests."""
    from django.core.cache import cache
    cache.clear()
    settings.REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = []


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    u = User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123!',
        first_name='Test',
        last_name='User',
    )
    UserProfile.objects.create(user=u)
    return u


@pytest.fixture
def user_b(db):
    u = User.objects.create_user(
        username='otheruser',
        email='other@example.com',
        password='testpass123!',
    )
    UserProfile.objects.create(user=u)
    return u


@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def audio_file():
    """Minimal valid WAV file for testing."""
    # WAV header for a 1-second mono 8kHz 8-bit file
    import struct
    sample_rate = 8000
    num_samples = sample_rate  # 1 second
    data_size = num_samples
    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF',
        36 + data_size,
        b'WAVE',
        b'fmt ',
        16,       # chunk size
        1,        # PCM format
        1,        # mono
        sample_rate,
        sample_rate,  # byte rate
        1,        # block align
        8,        # bits per sample
        b'data',
        data_size,
    )
    audio_data = header + (b'\x80' * num_samples)
    f = io.BytesIO(audio_data)
    f.name = 'test.wav'
    f.content_type = 'audio/wav'
    f.size = len(audio_data)
    return f
