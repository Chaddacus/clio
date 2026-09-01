"""Tests for apps/translations: contract validation, the Celery task, and the REST adapter.

The provider is faked everywhere here. Real-provider behaviour is covered by
evals/translation (marker ai_eval), which needs the Anthropic key.
"""
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings

from apps.translations.models import NoteTranslation
from apps.translations.services import (
    TranscriptUnit,
    TranslationResult,
    join_units,
    units_from_note,
    validate_units,
)
from apps.translations.tasks import USER_ERROR, translate_voice_note_task
from apps.voice_notes.models import TranscriptionSegment, VoiceNote

SPANISH = 'Hola hermana, ¿cómo estás? Mañana te llamo.'


def _note(user, text=SPANISH, language='es', status='completed', segments=()):
    note = VoiceNote.objects.create(
        user=user, title='t', status=status, transcription=text, language_detected=language,
        audio_file=SimpleUploadedFile('t.wav', b'RIFF0000WAVE', content_type='audio/wav'),
    )
    for i, (speaker, seg_text) in enumerate(segments):
        TranscriptionSegment.objects.create(
            voice_note=note, start_time=float(i), end_time=float(i + 1), text=seg_text, speaker_id=speaker,
        )
    return note


class FakeProvider:
    """Deterministic stand-in for the LLM boundary."""
    name = 'fake'
    model = 'fake-1'

    def __init__(self, fail='', units_override=None):
        self.fail = fail
        self.units_override = units_override
        self.calls = []

    def translate(self, units, source_language, target_language):
        self.calls.append((units, source_language, target_language))
        if self.fail:
            return TranslationResult(success=False, error=self.fail, provider=self.name, model=self.model)
        out = self.units_override
        if out is None:
            out = [{'id': u.id, 'text': f'[{target_language}] {u.text}'} for u in units]
        return TranslationResult(
            success=True, units=out, provider=self.name, model=self.model, input_tokens=10, output_tokens=20,
        )


# ---- contract helpers ------------------------------------------------------

class TestContract:
    def test_validate_units_accepts_matching_ids(self):
        units = [TranscriptUnit(id=5, text='a'), TranscriptUnit(id=9, text='b')]
        assert validate_units(units, [{'id': 5, 'text': 'x'}, {'id': 9, 'text': 'y'}]) is None

    def test_validate_units_rejects_reordered_ids(self):
        units = [TranscriptUnit(id=5, text='a'), TranscriptUnit(id=9, text='b')]
        assert 'do not match' in validate_units(units, [{'id': 9, 'text': 'y'}, {'id': 5, 'text': 'x'}])

    def test_validate_units_rejects_dropped_unit(self):
        units = [TranscriptUnit(id=5, text='a'), TranscriptUnit(id=9, text='b')]
        assert validate_units(units, [{'id': 5, 'text': 'x'}]) is not None

    def test_validate_units_rejects_empty_text(self):
        units = [TranscriptUnit(id=5, text='a')]
        assert 'empty' in validate_units(units, [{'id': 5, 'text': '   '}])

    def test_join_units_strips_and_joins(self):
        assert join_units([{'id': 1, 'text': ' a '}, {'id': 2, 'text': 'b'}]) == 'a b'


@pytest.mark.django_db
class TestUnitsFromNote:
    def test_segments_become_units_with_speaker_and_pk(self, user):
        note = _note(user, segments=[('Speaker 1', 'Hola.'), ('Speaker 2', 'Adiós.')])
        units, source = units_from_note(note)
        segs = list(note.segments.order_by('start_time'))
        assert source == 'es'
        assert [u.id for u in units] == [segs[0].id, segs[1].id]
        assert [u.speaker for u in units] == ['Speaker 1', 'Speaker 2']

    def test_no_segments_uses_whole_transcript_as_unit_zero(self, user):
        units, _ = units_from_note(_note(user))
        assert len(units) == 1 and units[0].id == 0 and units[0].text == SPANISH

    def test_empty_transcript_gives_no_units(self, user):
        units, _ = units_from_note(_note(user, text='   '))
        assert units == []


# ---- task ------------------------------------------------------------------

@pytest.mark.django_db
class TestTranslateTask:
    def _run(self, translation, provider):
        with patch('apps.translations.tasks.get_translation_provider', return_value=provider):
            translate_voice_note_task.apply(args=[translation.id], kwargs={'trace_id': 'trace-1'})
        translation.refresh_from_db()
        return translation

    def test_happy_path_with_segments(self, user):
        note = _note(user, segments=[('Speaker 1', 'Hola hermana.'), ('Speaker 2', 'Hola.')])
        t = NoteTranslation.objects.create(voice_note=note, target_language='en')
        provider = FakeProvider()
        t = self._run(t, provider)
        segs = list(note.segments.order_by('start_time'))
        assert t.status == 'completed'
        assert t.text == '[en] Hola hermana. [en] Hola.'
        assert t.segments == [
            {'segment_id': segs[0].id, 'text': '[en] Hola hermana.'},
            {'segment_id': segs[1].id, 'text': '[en] Hola.'},
        ]
        assert (t.provider, t.model, t.prompt_version) == ('fake', 'fake-1', 'translate-v1')
        assert (t.input_tokens, t.output_tokens, t.source_language) == (10, 20, 'es')
        assert provider.calls[0][1:] == ('es', 'en')
        # The note itself is untouched.
        note.refresh_from_db()
        assert note.transcription == SPANISH

    def test_happy_path_without_segments(self, user):
        t = NoteTranslation.objects.create(voice_note=_note(user), target_language='en')
        t = self._run(t, FakeProvider())
        assert t.status == 'completed'
        assert t.text == f'[en] {SPANISH}'
        assert t.segments == []

    def test_provider_failure_marks_failed_with_safe_message(self, user):
        t = NoteTranslation.objects.create(voice_note=_note(user), target_language='en')
        t = self._run(t, FakeProvider(fail='provider error 529: overloaded'))
        assert t.status == 'failed'
        assert t.error_message == USER_ERROR
        assert '529' not in t.error_message
        assert t.provider == 'fake'

    def test_contract_violation_marks_failed(self, user):
        note = _note(user, segments=[('Speaker 1', 'Hola.'), ('Speaker 2', 'Adiós.')])
        t = NoteTranslation.objects.create(voice_note=note, target_language='en')
        seg = note.segments.first()
        t = self._run(t, FakeProvider(units_override=[{'id': seg.id, 'text': 'Hi.'}]))  # dropped one
        assert t.status == 'failed'
        assert t.text == ''

    def test_empty_transcript_marks_failed(self, user):
        t = NoteTranslation.objects.create(voice_note=_note(user, text=''), target_language='en')
        provider = FakeProvider()
        t = self._run(t, provider)
        assert t.status == 'failed'
        assert provider.calls == []

    def test_provider_construction_error_marks_failed(self, user):
        t = NoteTranslation.objects.create(voice_note=_note(user), target_language='en')
        with patch('apps.translations.tasks.get_translation_provider', side_effect=ValueError('no key')):
            translate_voice_note_task.apply(args=[t.id])
        t.refresh_from_db()
        assert t.status == 'failed'
        assert t.error_message == USER_ERROR


# ---- REST adapter ----------------------------------------------------------

def _url(note):
    return f'/api/notes/{note.id}/translations/'


@pytest.mark.django_db
class TestTranslationsEndpoint:
    def test_list_is_empty_for_new_note_and_reports_enabled_flag(self, authenticated_client, user):
        note = _note(user)
        with override_settings(ANTHROPIC_API_KEY=''):
            r = authenticated_client.get(_url(note))
        assert r.status_code == 200
        assert r.data == {'success': True, 'enabled': False, 'data': []}
        with override_settings(ANTHROPIC_API_KEY='k'):
            assert authenticated_client.get(_url(note)).data['enabled'] is True

    def test_foreign_note_is_404_for_get_and_post(self, authenticated_client, user_b):
        note = _note(user_b)
        assert authenticated_client.get(_url(note)).status_code == 404
        with override_settings(ANTHROPIC_API_KEY='k'):
            assert authenticated_client.post(_url(note), {'target_language': 'en'}).status_code == 404

    def test_anonymous_is_401(self, api_client, user):
        assert api_client.get(_url(_note(user))).status_code == 401

    @override_settings(ANTHROPIC_API_KEY='')
    def test_post_without_provider_key_is_503(self, authenticated_client, user):
        r = authenticated_client.post(_url(_note(user)), {'target_language': 'en'})
        assert r.status_code == 503
        assert NoteTranslation.objects.count() == 0

    @override_settings(ANTHROPIC_API_KEY='k')
    @patch('apps.translations.tasks.translate_voice_note_task.delay')
    def test_post_dispatches_and_returns_202(self, mock_delay, authenticated_client, user):
        note = _note(user)
        r = authenticated_client.post(_url(note), {'target_language': 'en'}, HTTP_X_REQUEST_ID='req-42')
        assert r.status_code == 202
        assert r.data['success'] is True
        assert r.data['data']['status'] == 'pending'
        assert r.data['data']['target_language'] == 'en'
        row = NoteTranslation.objects.get(voice_note=note, target_language='en')
        mock_delay.assert_called_once_with(row.id, trace_id='req-42')

    @override_settings(ANTHROPIC_API_KEY='k')
    @pytest.mark.parametrize('target', ['xx', 'auto', ''])
    def test_post_rejects_bad_target(self, target, authenticated_client, user):
        r = authenticated_client.post(_url(_note(user)), {'target_language': target})
        assert r.status_code == 400
        assert 'target_language' in r.data['errors']

    @override_settings(ANTHROPIC_API_KEY='k')
    def test_post_rejects_target_equal_to_detected(self, authenticated_client, user):
        r = authenticated_client.post(_url(_note(user, language='es')), {'target_language': 'es'})
        assert r.status_code == 400
        assert 'already' in r.data['message']

    @override_settings(ANTHROPIC_API_KEY='k')
    def test_post_rejects_untranscribed_note(self, authenticated_client, user):
        r = authenticated_client.post(_url(_note(user, status='processing')), {'target_language': 'en'})
        assert r.status_code == 400
        assert 'transcribed' in r.data['message']

    @override_settings(ANTHROPIC_API_KEY='k')
    @patch('apps.translations.tasks.translate_voice_note_task.delay')
    def test_post_while_pending_does_not_redispatch(self, mock_delay, authenticated_client, user):
        note = _note(user)
        NoteTranslation.objects.create(voice_note=note, target_language='en', status='pending')
        r = authenticated_client.post(_url(note), {'target_language': 'en'})
        assert r.status_code == 202
        mock_delay.assert_not_called()

    @override_settings(ANTHROPIC_API_KEY='k')
    @patch('apps.translations.tasks.translate_voice_note_task.delay')
    def test_post_when_completed_returns_existing(self, mock_delay, authenticated_client, user):
        note = _note(user)
        NoteTranslation.objects.create(voice_note=note, target_language='en', status='completed', text='Hi sister.')
        r = authenticated_client.post(_url(note), {'target_language': 'en'})
        assert r.status_code == 200
        assert r.data['data']['text'] == 'Hi sister.'
        mock_delay.assert_not_called()

    @override_settings(ANTHROPIC_API_KEY='k')
    @patch('apps.translations.tasks.translate_voice_note_task.delay')
    def test_post_when_failed_retries(self, mock_delay, authenticated_client, user):
        note = _note(user)
        row = NoteTranslation.objects.create(voice_note=note, target_language='en', status='failed', error_message='x')
        r = authenticated_client.post(_url(note), {'target_language': 'en'})
        assert r.status_code == 202
        row.refresh_from_db()
        assert (row.status, row.error_message) == ('pending', '')
        mock_delay.assert_called_once()

    def test_list_returns_rows_ordered_by_language(self, authenticated_client, user):
        note = _note(user)
        NoteTranslation.objects.create(voice_note=note, target_language='fr', status='completed', text='Salut.')
        NoteTranslation.objects.create(voice_note=note, target_language='en', status='failed', error_message='oops')
        r = authenticated_client.get(_url(note))
        assert [row['target_language'] for row in r.data['data']] == ['en', 'fr']
        assert r.data['data'][0]['error_message'] == 'oops'
