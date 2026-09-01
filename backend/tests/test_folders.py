import struct

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework_simplejwt.tokens import AccessToken

from apps.voice_notes.models import Folder, VoiceNote


def _wav_bytes(payload=2048):
    data = b'\x80' * payload
    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF', 36 + len(data), b'WAVE', b'fmt ', 16, 1, 1,
        8000, 8000, 1, 8, b'data', len(data),
    )
    return header + data


def _auth(api_client, user):
    api_client.cookies['access_token'] = str(AccessToken.for_user(user))


@pytest.mark.django_db
class TestFolderCrud:
    def test_create_and_list_scoped_to_user(self, api_client, user, user_b):
        _auth(api_client, user)
        resp = api_client.post('/api/folders/', {'name': 'Work', 'color': '#ff0000'})
        assert resp.status_code == status.HTTP_201_CREATED
        # a folder owned by someone else must not appear in the list
        Folder.objects.create(user=user_b, name='Theirs')
        listing = api_client.get('/api/folders/')
        names = [f['name'] for f in listing.json()]
        assert names == ['Work']

    def test_cross_user_folder_is_not_found(self, api_client, user, user_b):
        other = Folder.objects.create(user=user_b, name='Secret')
        _auth(api_client, user)
        resp = api_client.get(f'/api/folders/{other.id}/')
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_one_level_nesting_allowed(self, api_client, user):
        parent = Folder.objects.create(user=user, name='Parent')
        _auth(api_client, user)
        resp = api_client.post('/api/folders/', {'name': 'Child', 'parent': parent.id})
        assert resp.status_code == status.HTTP_201_CREATED

    def test_two_level_nesting_rejected(self, api_client, user):
        parent = Folder.objects.create(user=user, name='Parent')
        child = Folder.objects.create(user=user, name='Child', parent=parent)
        _auth(api_client, user)
        resp = api_client.post('/api/folders/', {'name': 'Grandchild', 'parent': child.id})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_parent_to_another_users_folder(self, api_client, user, user_b):
        foreign = Folder.objects.create(user=user_b, name='Foreign')
        _auth(api_client, user)
        resp = api_client.post('/api/folders/', {'name': 'Mine', 'parent': foreign.id})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_reparent_to_another_users_folder_on_update(self, api_client, user, user_b):
        mine = Folder.objects.create(user=user, name='Mine')
        foreign = Folder.objects.create(user=user_b, name='Foreign')
        _auth(api_client, user)
        resp = api_client.patch(f'/api/folders/{mine.id}/', {'parent': foreign.id})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        mine.refresh_from_db()
        assert mine.parent is None


@pytest.mark.django_db
class TestNoteFolderAssignment:
    def _make_note(self, user):
        return VoiceNote.objects.create(
            user=user,
            title='note',
            status='completed',
            audio_file=SimpleUploadedFile('clip.wav', _wav_bytes(), content_type='audio/wav'),
        )

    def test_assign_folder_to_note(self, api_client, user):
        folder = Folder.objects.create(user=user, name='Ideas')
        note = self._make_note(user)
        _auth(api_client, user)
        resp = api_client.patch(f'/api/notes/{note.id}/', {'folder': folder.id}, format='json')
        assert resp.status_code == status.HTTP_200_OK
        note.refresh_from_db()
        assert note.folder_id == folder.id

    def test_assign_foreign_folder_rejected(self, api_client, user, user_b):
        foreign = Folder.objects.create(user=user_b, name='Foreign')
        note = self._make_note(user)
        _auth(api_client, user)
        resp = api_client.patch(f'/api/notes/{note.id}/', {'folder': foreign.id}, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        note.refresh_from_db()
        assert note.folder_id is None

    def test_deleting_folder_keeps_note_unfiled(self, api_client, user):
        folder = Folder.objects.create(user=user, name='Temp')
        note = self._make_note(user)
        note.folder = folder
        note.save()
        _auth(api_client, user)
        resp = api_client.delete(f'/api/folders/{folder.id}/')
        assert resp.status_code in (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT)
        note.refresh_from_db()
        assert note.folder_id is None  # SET_NULL: note survives, becomes unfiled

    def test_filter_notes_by_folder(self, api_client, user):
        folder = Folder.objects.create(user=user, name='Filtered')
        in_folder = self._make_note(user)
        in_folder.folder = folder
        in_folder.save()
        self._make_note(user)  # unfiled
        _auth(api_client, user)
        resp = api_client.get(f'/api/notes/?folder={folder.id}')
        assert resp.status_code == status.HTTP_200_OK
        ids = [n['id'] for n in resp.json()['results']]
        assert ids == [in_folder.id]
