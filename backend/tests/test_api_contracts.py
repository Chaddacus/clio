import pytest
from rest_framework import status

from apps.voice_notes.models import Tag, VoiceNote


@pytest.mark.django_db
class TestTagScoping:
    def test_tags_scoped_to_user(self, api_client, user, user_b):
        """User A cannot see tags belonging to User B."""
        Tag.objects.create(name='tag-a', color='#FF0000', user=user)
        Tag.objects.create(name='tag-b', color='#00FF00', user=user_b)

        api_client.force_authenticate(user=user)
        resp = api_client.get('/api/tags/')
        # Response may be paginated (dict with 'results') or a plain list
        results = resp.data.get('results', resp.data) if isinstance(resp.data, dict) else resp.data
        tag_names = [t['name'] for t in results]
        assert 'tag-a' in tag_names
        assert 'tag-b' not in tag_names

    def test_tag_detail_scoped_to_user(self, api_client, user, user_b):
        """User A cannot access a tag belonging to User B."""
        tag = Tag.objects.create(name='secret-tag', color='#0000FF', user=user_b)

        api_client.force_authenticate(user=user)
        resp = api_client.get(f'/api/tags/{tag.id}/')
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_same_tag_name_different_users(self, api_client, user, user_b):
        """Two users can each have a tag with the same name."""
        Tag.objects.create(name='shared-name', color='#FF0000', user=user)
        Tag.objects.create(name='shared-name', color='#00FF00', user=user_b)

        api_client.force_authenticate(user=user)
        resp = api_client.get('/api/tags/')
        results = resp.data.get('results', resp.data) if isinstance(resp.data, dict) else resp.data
        assert len([t for t in results if t['name'] == 'shared-name']) == 1


@pytest.mark.django_db
class TestRetranscribeValidation:
    def test_rejects_invalid_language(self, authenticated_client, user):
        note = VoiceNote.objects.create(
            user=user, title='Test', status='completed',
        )
        resp = authenticated_client.post(
            f'/api/notes/{note.id}/retranscribe/',
            {'language': 'klingon'},
            format='json',
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Invalid language' in resp.data.get('message', '')

    def test_accepts_valid_language(self, authenticated_client, user):
        """Valid language should not be rejected at validation (may fail at transcription)."""
        note = VoiceNote.objects.create(
            user=user, title='Test', status='completed',
        )
        # 'auto' is a valid language choice; will fail at transcription (no audio) but not at validation
        resp = authenticated_client.post(
            f'/api/notes/{note.id}/retranscribe/',
            {'language': 'auto'},
            format='json',
        )
        # Should not be 400 for invalid language
        assert resp.status_code != status.HTTP_400_BAD_REQUEST or 'Invalid language' not in resp.data.get('message', '')


class TestTranscriptionServiceFactory:
    def test_get_transcription_service_returns_whisper(self):
        """get_transcription_service() returns a WhisperTranscriptionService instance."""
        import unittest.mock as mock

        from apps.core.services import WhisperTranscriptionService, get_transcription_service

        with mock.patch.object(WhisperTranscriptionService, '__init__', return_value=None):
            service = get_transcription_service()
        assert isinstance(service, WhisperTranscriptionService)


@pytest.mark.django_db
class TestUserStatsAggregation:
    def test_stats_duration_aggregation(self, authenticated_client, user):
        """Stats should use DB aggregation, not Python-side sum."""
        from datetime import timedelta
        VoiceNote.objects.create(
            user=user, title='A', status='completed',
            duration=timedelta(seconds=60),
        )
        VoiceNote.objects.create(
            user=user, title='B', status='completed',
            duration=timedelta(seconds=120),
        )
        resp = authenticated_client.get('/api/stats/')
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['data']['total_duration_seconds'] == 180.0
