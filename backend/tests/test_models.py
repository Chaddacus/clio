"""Tests for model methods and properties in apps/voice_notes/models.py."""
import pytest
from django.contrib.auth.models import User

from apps.users.models import UserProfile
from apps.voice_notes.models import Tag, TranscriptionSegment, VoiceNote


@pytest.fixture
def plain_user(db):
    u = User.objects.create_user(username='modeluser', email='model@example.com', password='pass')
    UserProfile.objects.create(user=u)
    return u


@pytest.mark.django_db
class TestVoiceNoteAutoTitle:
    def test_voicenote_auto_title_from_transcription(self, plain_user):
        """VoiceNote with no title gets one generated from transcription on save."""
        note = VoiceNote(
            user=plain_user,
            title='',
            transcription='This is a sample transcription for testing purposes',
            status='completed',
        )
        note.save()
        assert note.title != ''
        assert 'This' in note.title


@pytest.mark.django_db
class TestVoiceNoteFileSizeMb:
    def test_voicenote_file_size_mb_property(self, plain_user):
        note = VoiceNote.objects.create(
            user=plain_user,
            title='size test',
            status='completed',
            file_size_bytes=2 * 1024 * 1024,  # 2 MiB
        )
        assert note.file_size_mb == pytest.approx(2.0, abs=0.01)

    def test_voicenote_file_size_mb_zero(self, plain_user):
        note = VoiceNote.objects.create(
            user=plain_user,
            title='zero size',
            status='completed',
            file_size_bytes=0,
        )
        assert note.file_size_mb == 0.0


@pytest.mark.django_db
class TestTranscriptionSegmentDuration:
    def test_transcription_segment_duration_property(self, plain_user):
        note = VoiceNote.objects.create(
            user=plain_user,
            title='seg test',
            status='completed',
        )
        segment = TranscriptionSegment.objects.create(
            voice_note=note,
            start_time=1.0,
            end_time=3.5,
            text='Hello world',
        )
        assert segment.duration == pytest.approx(2.5)


@pytest.mark.django_db
class TestTagStr:
    def test_tag_str(self, plain_user):
        tag = Tag.objects.create(user=plain_user, name='meeting')
        assert 'meeting' in str(tag)


@pytest.mark.django_db
class TestUserProfileStr:
    def test_userprofile_str(self, plain_user):
        profile = plain_user.userprofile
        assert plain_user.username in str(profile)
