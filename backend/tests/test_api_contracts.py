import pytest
from rest_framework import status

from apps.voice_notes.models import Tag, VoiceNote


@pytest.mark.django_db
class TestTagScoping:
    def test_tags_scoped_to_user(self, api_client, user, user_b):
        """User A cannot see tags only attached to User B's notes."""
        tag_a = Tag.objects.create(name='tag-a', color='#FF0000')
        tag_b = Tag.objects.create(name='tag-b', color='#00FF00')

        note_a = VoiceNote.objects.create(user=user, title='A', status='completed')
        note_a.tags.add(tag_a)

        note_b = VoiceNote.objects.create(user=user_b, title='B', status='completed')
        note_b.tags.add(tag_b)

        api_client.force_authenticate(user=user)
        resp = api_client.get('/api/tags/')
        # Response may be paginated (dict with 'results') or a plain list
        results = resp.data.get('results', resp.data) if isinstance(resp.data, dict) else resp.data
        tag_names = [t['name'] for t in results]
        assert 'tag-a' in tag_names
        assert 'tag-b' not in tag_names

    def test_tag_detail_scoped_to_user(self, api_client, user, user_b):
        """User A cannot access a tag only attached to User B's notes."""
        tag = Tag.objects.create(name='secret-tag', color='#0000FF')
        note_b = VoiceNote.objects.create(user=user_b, title='B', status='completed')
        note_b.tags.add(tag)

        api_client.force_authenticate(user=user)
        resp = api_client.get(f'/api/tags/{tag.id}/')
        assert resp.status_code == status.HTTP_404_NOT_FOUND


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
