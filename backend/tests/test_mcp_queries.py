import struct

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.core.models import SupportRequest
from apps.voice_notes.models import VoiceNote
from clio_mcp import queries


def _wav():
    data = b'\x80' * 1024
    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF', 36 + len(data), b'WAVE', b'fmt ', 16, 1, 1, 8000, 8000, 1, 8, b'data', len(data),
    )
    return SimpleUploadedFile('a.wav', header + data, content_type='audio/wav')


@pytest.mark.django_db
class TestClioMcpQueries:
    def test_app_health_reports_provider_and_counts(self, user, settings):
        settings.DEEPGRAM_API_KEY = 'dg-key'
        VoiceNote.objects.create(user=user, title='ok', status='completed', audio_file=_wav())
        VoiceNote.objects.create(user=user, title='bad', status='failed', audio_file=_wav())
        health = queries.app_health()
        assert health['transcription_provider'] == 'deepgram'
        assert health['notes_total'] == 2
        assert health['notes_by_status'].get('failed') == 1

    def test_list_pending_only_returns_submitted(self, user):
        SupportRequest.objects.create(user=user, kind='bug', body='a', status='submitted')
        SupportRequest.objects.create(user=user, kind='bug', body='b', status='needs_detail')
        SupportRequest.objects.create(user=user, kind='bug', body='c', status='issue_created')
        pending = queries.list_pending_support_requests()
        assert len(pending) == 1
        assert pending[0]['status'] == 'submitted'

    def test_get_trace_links_notes_and_requests(self, user):
        VoiceNote.objects.create(
            user=user, title='t', status='failed', trace_id='trace-7',
            error_message='boom', audio_file=_wav(),
        )
        SupportRequest.objects.create(user=user, kind='bug', body='x', trace_id='trace-7')
        trace = queries.get_trace('trace-7')
        assert len(trace['notes']) == 1
        assert trace['notes'][0]['error_message'] == 'boom'
        assert len(trace['support_requests']) == 1

    def test_recent_failures(self, user):
        VoiceNote.objects.create(user=user, title='ok', status='completed', audio_file=_wav())
        VoiceNote.objects.create(user=user, title='bad', status='failed', audio_file=_wav())
        failures = queries.recent_transcription_failures()
        assert len(failures) == 1
        assert failures[0]['status'] == 'failed'

    def test_update_status_is_validated_and_scoped(self, user):
        sr = SupportRequest.objects.create(user=user, kind='bug', body='x', status='submitted')
        out = queries.update_support_request_status(
            sr.id, 'issue_created', github_issue_number=11,
            github_issue_url='https://github.com/Chaddacus/clio/issues/11',
        )
        assert out['status'] == 'issue_created'
        assert out['github_issue_number'] == 11
        sr.refresh_from_db()
        assert sr.status == 'issue_created'

    def test_update_status_rejects_invalid(self, user):
        sr = SupportRequest.objects.create(user=user, kind='bug', body='x', status='submitted')
        with pytest.raises(ValueError):
            queries.update_support_request_status(sr.id, 'deploy_to_prod')
