from unittest.mock import patch

import pytest
from rest_framework import status

from apps.core import support_gate
from apps.core.models import SupportRequest


class TestSufficiencyGate:
    def test_too_short_is_insufficient(self):
        ok, reason = support_gate.evaluate("fix it")
        assert ok is False
        assert reason

    def test_feature_plus_detail_is_sufficient(self):
        ok, reason = support_gate.evaluate(
            "When I click play on a transcription the audio does not start"
        )
        assert ok is True
        assert reason == ''

    def test_no_feature_reference_is_bounced(self):
        ok, reason = support_gate.evaluate("please make the thing better when I use it")
        assert ok is False
        assert 'specific part' in reason

    def test_long_descriptive_writeup_passes(self):
        ok, _ = support_gate.evaluate(
            "After I upload audio the page should show me how far along it is but "
            "instead it just sits there for a long time and I cannot tell whether "
            "it is working or stuck and that is confusing"
        )
        assert ok is True


@pytest.mark.django_db
class TestSupportEndpoint:
    def test_requires_auth(self, api_client):
        resp = api_client.post('/api/support/', {'kind': 'bug', 'body': 'x'}, format='json')
        assert resp.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_sufficient_request_is_dispatched(self, authenticated_client, user):
        with patch('apps.core.tasks.create_support_issue_task.delay') as mock_delay:
            resp = authenticated_client.post(
                '/api/support/',
                {'kind': 'bug', 'body': 'When I click play on a transcription the audio does not start',
                 'trace_id': 'trace-xyz'},
                format='json',
            )
        assert resp.status_code == status.HTTP_201_CREATED
        sr = SupportRequest.objects.get(user=user)
        assert sr.status == 'submitted'
        assert sr.trace_id == 'trace-xyz'
        mock_delay.assert_called_once_with(sr.id)

    def test_insufficient_request_is_not_dispatched(self, authenticated_client, user):
        with patch('apps.core.tasks.create_support_issue_task.delay') as mock_delay:
            resp = authenticated_client.post(
                '/api/support/', {'kind': 'bug', 'body': 'fix it'}, format='json',
            )
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['status'] == 'needs_detail'
        assert resp.data['gate_reason']
        mock_delay.assert_not_called()

    def test_list_is_scoped_to_owner(self, authenticated_client, user, user_b):
        SupportRequest.objects.create(user=user_b, kind='bug', body="someone else's request")
        mine = SupportRequest.objects.create(user=user, kind='bug', body='my request')
        resp = authenticated_client.get('/api/support/')
        assert resp.status_code == status.HTTP_200_OK
        ids = [r['id'] for r in (resp.data.get('results') or resp.data)]
        assert mine.id in ids
        assert all(i == mine.id for i in ids)


@pytest.mark.django_db
class TestIssueCreationTask:
    def test_creates_labelled_issue(self, user, settings):
        settings.GITHUB_TOKEN = 'gh-test-token'
        settings.GITHUB_REPO = 'Chaddacus/clio'
        sr = SupportRequest.objects.create(
            user=user, kind='bug', body='Speakers are mislabeled in the transcription view',
            trace_id='trace-1', status='submitted',
        )
        from apps.core.tasks import create_support_issue_task

        class FakeResp:
            def raise_for_status(self):
                pass

            def json(self):
                return {'number': 42, 'html_url': 'https://github.com/Chaddacus/clio/issues/42'}

        with patch('apps.core.tasks.requests.post', return_value=FakeResp()) as mock_post:
            create_support_issue_task(sr.id)

        args, kwargs = mock_post.call_args
        assert kwargs['json']['labels'] == ['codex']
        assert 'trace-1' in kwargs['json']['body']
        sr.refresh_from_db()
        assert sr.github_issue_number == 42
        assert sr.status == 'issue_created'

    def test_no_token_is_noop(self, user, settings):
        settings.GITHUB_TOKEN = ''
        sr = SupportRequest.objects.create(user=user, kind='bug', body='x', status='submitted')
        from apps.core.tasks import create_support_issue_task

        with patch('apps.core.tasks.requests.post') as mock_post:
            create_support_issue_task(sr.id)
        mock_post.assert_not_called()
        sr.refresh_from_db()
        assert sr.status == 'submitted'
