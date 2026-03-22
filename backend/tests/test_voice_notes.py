import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from apps.voice_notes.models import VoiceNote, Tag


@pytest.mark.django_db
class TestVoiceNoteList:
    def test_requires_auth(self, api_client):
        resp = api_client.get('/api/notes/')
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_empty(self, authenticated_client):
        resp = authenticated_client.get('/api/notes/')
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['count'] == 0

    def test_list_isolation(self, api_client, user, user_b):
        """User A cannot see User B's notes."""
        VoiceNote.objects.create(
            user=user,
            title='Note A',
            status='completed',
        )
        VoiceNote.objects.create(
            user=user_b,
            title='Note B',
            status='completed',
        )
        api_client.force_authenticate(user=user)
        resp = api_client.get('/api/notes/')
        assert resp.data['count'] == 1
        assert resp.data['results'][0]['title'] == 'Note A'

        api_client.force_authenticate(user=user_b)
        resp = api_client.get('/api/notes/')
        assert resp.data['count'] == 1
        assert resp.data['results'][0]['title'] == 'Note B'


@pytest.mark.django_db
class TestVoiceNoteDetail:
    def test_get_own_note(self, authenticated_client, user):
        note = VoiceNote.objects.create(
            user=user,
            title='My Note',
            transcription='Hello world',
            status='completed',
        )
        resp = authenticated_client.get(f'/api/notes/{note.id}/')
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['title'] == 'My Note'

    def test_cannot_get_other_user_note(self, api_client, user, user_b):
        note = VoiceNote.objects.create(
            user=user_b,
            title='Secret Note',
            status='completed',
        )
        api_client.force_authenticate(user=user)
        resp = api_client.get(f'/api/notes/{note.id}/')
        assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestVoiceNoteDelete:
    def test_delete_updates_storage(self, authenticated_client, user):
        note = VoiceNote.objects.create(
            user=user,
            title='To Delete',
            status='completed',
            file_size_bytes=5 * 1024 * 1024,  # 5MB
        )
        profile = user.userprofile
        profile.storage_used_mb = 5.0
        profile.save()

        resp = authenticated_client.delete(f'/api/notes/{note.id}/')
        assert resp.status_code == status.HTTP_200_OK

        profile.refresh_from_db()
        assert profile.storage_used_mb == pytest.approx(0.0, abs=0.1)


@pytest.mark.django_db
class TestUserStats:
    def test_stats_returns_counts(self, authenticated_client, user):
        VoiceNote.objects.create(user=user, title='A', status='completed')
        VoiceNote.objects.create(user=user, title='B', status='failed')
        VoiceNote.objects.create(user=user, title='C', status='processing')

        resp = authenticated_client.get('/api/stats/')
        assert resp.status_code == status.HTTP_200_OK
        data = resp.data['data']
        assert data['total_notes'] == 3
        assert data['completed_notes'] == 1
        assert data['failed_notes'] == 1
        assert data['processing_notes'] == 1


@pytest.mark.django_db
class TestTags:
    def test_create_tag(self, authenticated_client):
        resp = authenticated_client.post(
            '/api/tags/',
            {'name': 'meeting', 'color': '#FF0000'},
            format='json',
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert Tag.objects.filter(name='meeting').exists()

    def test_list_tags(self, authenticated_client, user):
        tag = Tag.objects.create(name='work', color='#00FF00')
        # Tag must be associated with user's note to be visible
        note = VoiceNote.objects.create(user=user, title='Tagged', status='completed')
        note.tags.add(tag)

        resp = authenticated_client.get('/api/tags/')
        assert resp.status_code == status.HTTP_200_OK
