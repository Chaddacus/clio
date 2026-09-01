"""Translation boundary behaviour the review asked to see proven:

- stored translations are invalidated when the transcript changes;
- the task retries only transient provider failures and keeps the row pending
  while a retry is scheduled;
- the Claude provider turns truncation, malformed output, and SDK errors into
  TranslationResult failures without echoing model output.
"""
import logging
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings

from apps.translations.models import NoteTranslation
from apps.translations.services import (
    OUTPUT_SCHEMA,
    ClaudeTranslationProvider,
    TranscriptUnit,
    TranslationResult,
    invalidate_translations_for_note,
)
from apps.translations.tasks import USER_ERROR, translate_voice_note_task
from apps.voice_notes.models import TranscriptionSegment, VoiceNote
from apps.voice_notes.tasks import retranscribe_voice_note_task


def _note(user, segments=(('Speaker 1', 'Hola.'), ('Speaker 2', 'Adiós.'))):
    note = VoiceNote.objects.create(
        user=user, title='t', status='completed', transcription='Hola. Adiós.', language_detected='es',
        audio_file=SimpleUploadedFile('t.wav', b'RIFF0000WAVE', content_type='audio/wav'),
    )
    for i, (speaker, text) in enumerate(segments):
        TranscriptionSegment.objects.create(
            voice_note=note, start_time=float(i), end_time=float(i + 1), text=text, speaker_id=speaker,
        )
    return note


def _completed_translation(note, language='en'):
    return NoteTranslation.objects.create(
        voice_note=note, target_language=language, status='completed', text='Hi. Bye.',
        segments=[{'segment_id': s.id, 'text': 'x'} for s in note.segments.all()],
    )


# ---- invalidation ----------------------------------------------------------

@pytest.mark.django_db
class TestInvalidation:
    def test_helper_removes_only_that_notes_rows(self, user):
        a, b = _note(user), _note(user)
        _completed_translation(a)
        _completed_translation(a, 'fr')
        keep = _completed_translation(b)
        assert invalidate_translations_for_note(a.id) == 2
        assert list(NoteTranslation.objects.values_list('id', flat=True)) == [keep.id]

    @patch('apps.voice_notes.tasks.get_transcription_service')
    def test_retranscription_drops_translations(self, mock_factory, user):
        note = _note(user)
        _completed_translation(note)
        service = MagicMock()
        service.transcribe_audio.return_value = {
            'success': True, 'text': 'Nuevo texto.', 'language': 'es', 'confidence_score': 0.9,
            'segments': [{'start_time': 0.0, 'end_time': 1.0, 'text': 'Nuevo texto.', 'confidence': 0.9, 'speaker_id': 'Speaker 1'}],
        }
        mock_factory.return_value = service
        retranscribe_voice_note_task.apply(args=[note.id, 'auto'])
        note.refresh_from_db()
        assert note.transcription == 'Nuevo texto.'
        assert not NoteTranslation.objects.filter(voice_note=note).exists()

    @patch('apps.voice_notes.tasks.get_transcription_service')
    def test_failed_retranscription_keeps_translations(self, mock_factory, user):
        note = _note(user)
        _completed_translation(note)
        service = MagicMock()
        service.transcribe_audio.return_value = {'success': False, 'error': 'boom'}
        mock_factory.return_value = service
        retranscribe_voice_note_task.apply(args=[note.id, 'auto'])
        assert NoteTranslation.objects.filter(voice_note=note).count() == 1

    def test_editing_transcript_drops_translations(self, authenticated_client, user):
        note = _note(user)
        _completed_translation(note)
        r = authenticated_client.patch(f'/api/notes/{note.id}/', {'transcription': 'Edited.'}, format='json')
        assert r.status_code == 200
        assert not NoteTranslation.objects.filter(voice_note=note).exists()

    def test_editing_title_keeps_translations(self, authenticated_client, user):
        note = _note(user)
        _completed_translation(note)
        r = authenticated_client.patch(f'/api/notes/{note.id}/', {'title': 'New title'}, format='json')
        assert r.status_code == 200
        assert NoteTranslation.objects.filter(voice_note=note).count() == 1

    def test_same_transcript_resubmitted_keeps_translations(self, authenticated_client, user):
        note = _note(user)
        _completed_translation(note)
        r = authenticated_client.patch(f'/api/notes/{note.id}/', {'transcription': note.transcription}, format='json')
        assert r.status_code == 200
        assert NoteTranslation.objects.filter(voice_note=note).count() == 1


# ---- retry policy ----------------------------------------------------------

class _Provider:
    name, model = 'fake', 'fake-1'

    def __init__(self, results):
        self.results = list(results)
        self.calls = 0

    def translate(self, units, source_language, target_language):
        self.calls += 1
        return self.results.pop(0)


@pytest.mark.django_db
class TestRetryPolicy:
    def test_transient_failure_is_retried_and_row_stays_pending_meanwhile(self, user):
        note = _note(user)
        t = NoteTranslation.objects.create(voice_note=note, target_language='en')
        provider = _Provider([
            TranslationResult(success=False, error='provider rate limited', retryable=True, provider='fake', model='fake-1'),
            TranslationResult(success=True, units=[{'id': s.id, 'text': 'ok'} for s in note.segments.all()],
                              provider='fake', model='fake-1'),
        ])
        statuses = []
        original_retry = translate_voice_note_task.retry

        def spy_retry(*args, **kwargs):
            t.refresh_from_db()
            statuses.append(t.status)
            return original_retry(*args, **kwargs)

        with patch('apps.translations.tasks.get_translation_provider', return_value=provider), \
             patch.object(translate_voice_note_task, 'retry', side_effect=spy_retry):
            translate_voice_note_task.apply(args=[t.id])
        t.refresh_from_db()
        assert statuses == ['pending']          # not marked failed while a retry is scheduled
        assert provider.calls == 2
        assert t.status == 'completed'

    def test_transient_failure_gives_up_after_max_retries(self, user):
        t = NoteTranslation.objects.create(voice_note=_note(user), target_language='en')
        fail = TranslationResult(success=False, error='provider unreachable', retryable=True, provider='fake', model='fake-1')
        provider = _Provider([fail, fail, fail, fail])
        with patch('apps.translations.tasks.get_translation_provider', return_value=provider):
            translate_voice_note_task.apply(args=[t.id])
        t.refresh_from_db()
        assert provider.calls == translate_voice_note_task.max_retries + 1
        assert (t.status, t.error_message) == ('failed', USER_ERROR)

    def test_permanent_failure_is_not_retried(self, user):
        t = NoteTranslation.objects.create(voice_note=_note(user), target_language='en')
        provider = _Provider([
            TranslationResult(success=False, error='transcript too long to translate in one pass', provider='fake', model='fake-1'),
        ])
        with patch('apps.translations.tasks.get_translation_provider', return_value=provider):
            translate_voice_note_task.apply(args=[t.id])
        t.refresh_from_db()
        assert provider.calls == 1
        assert t.status == 'failed'

    def test_provider_construction_error_fails_fast_and_logs_type_only(self, user, caplog):
        t = NoteTranslation.objects.create(voice_note=_note(user), target_language='en')
        # The app's logging config does not propagate, so attach caplog's real
        # handler to the module logger: formatted records include exc_info text.
        task_logger = logging.getLogger('apps.translations.tasks')
        task_logger.addHandler(caplog.handler)
        try:
            with patch('apps.translations.tasks.get_translation_provider',
                       side_effect=ValueError('secret-ish detail that must not be logged')):
                translate_voice_note_task.apply(args=[t.id])
        finally:
            task_logger.removeHandler(caplog.handler)
        t.refresh_from_db()
        assert t.status == 'failed'
        assert 'ValueError' in caplog.text
        assert 'secret-ish' not in caplog.text

    def test_result_is_discarded_when_the_note_was_retranscribed_meanwhile(self, user):
        note = _note(user)
        t = NoteTranslation.objects.create(voice_note=note, target_language='en')
        ids = [s.id for s in note.segments.all()]

        class RacingProvider:
            name, model = 'fake', 'fake-1'

            def translate(self, units, source_language, target_language):
                # The user presses Re-transcribe while the provider call is in flight.
                invalidate_translations_for_note(note.id)
                return TranslationResult(success=True, units=[{'id': i, 'text': 'stale'} for i in ids],
                                         provider='fake', model='fake-1')

        with patch('apps.translations.tasks.get_translation_provider', return_value=RacingProvider()):
            translate_voice_note_task.apply(args=[t.id])
        assert not NoteTranslation.objects.filter(voice_note=note).exists()

    def test_failure_is_discarded_when_the_note_was_retranscribed_meanwhile(self, user):
        note = _note(user)
        t = NoteTranslation.objects.create(voice_note=note, target_language='en')

        class RacingProvider:
            name, model = 'fake', 'fake-1'

            def translate(self, units, source_language, target_language):
                invalidate_translations_for_note(note.id)
                return TranslationResult(success=False, error='provider error 400', provider='fake', model='fake-1')

        with patch('apps.translations.tasks.get_translation_provider', return_value=RacingProvider()):
            translate_voice_note_task.apply(args=[t.id])
        assert not NoteTranslation.objects.filter(voice_note=note).exists()

    def test_segments_are_untouched_by_a_translation(self, user):
        note = _note(user)
        before = list(note.segments.order_by('id').values_list('id', 'text', 'speaker_id'))
        t = NoteTranslation.objects.create(voice_note=note, target_language='en')
        provider = _Provider([TranslationResult(
            success=True, units=[{'id': i, 'text': f'tr{i}'} for i, _, _ in before], provider='fake', model='fake-1')])
        with patch('apps.translations.tasks.get_translation_provider', return_value=provider):
            translate_voice_note_task.apply(args=[t.id])
        assert list(note.segments.order_by('id').values_list('id', 'text', 'speaker_id')) == before


# ---- Claude provider boundary ---------------------------------------------

def _response(text, stop_reason='end_turn'):
    return SimpleNamespace(
        stop_reason=stop_reason,
        content=[SimpleNamespace(type='text', text=text)],
        usage=SimpleNamespace(input_tokens=11, output_tokens=7),
    )


PROVIDER_SETTINGS = dict(ANTHROPIC_API_KEY='k', CLIO_TRANSLATION_MODEL='claude-opus-5', CLIO_TRANSLATION_EFFORT='medium')


class TestClaudeProvider:
    units = [TranscriptUnit(id=1, text='Hola.'), TranscriptUnit(id=2, text='Adiós.')]

    def _provider(self, response=None, side_effect=None):
        with override_settings(**PROVIDER_SETTINGS):
            provider = ClaudeTranslationProvider()
        provider._client = MagicMock()
        provider._client.messages.create = MagicMock(return_value=response, side_effect=side_effect)
        return provider

    def test_success_uses_schema_output_and_parses_units(self):
        p = self._provider(_response('{"units":[{"id":1,"text":"Hi."},{"id":2,"text":"Bye."}]}'))
        r = p.translate(self.units, 'es', 'en')
        assert r.success and r.units == [{'id': 1, 'text': 'Hi.'}, {'id': 2, 'text': 'Bye.'}]
        assert (r.input_tokens, r.output_tokens, r.model, r.provider) == (11, 7, 'claude-opus-5', 'anthropic')
        kwargs = p._client.messages.create.call_args.kwargs
        assert kwargs['output_config'] == {'effort': 'medium', 'format': {'type': 'json_schema', 'schema': OUTPUT_SCHEMA}}
        assert kwargs['model'] == 'claude-opus-5'
        assert 'Hola.' in kwargs['messages'][0]['content']

    def test_truncation_is_a_controlled_failure(self):
        p = self._provider(_response('{"units":[{"id":1,"text":"Hi', stop_reason='max_tokens'))
        r = p.translate(self.units, 'es', 'en')
        assert not r.success and not r.retryable
        assert 'too long' in r.error

    def test_malformed_output_fails_without_echoing_the_text(self):
        p = self._provider(_response('{"units":[{"id":1,"text":"Hi SECRET-CONTENT'))
        r = p.translate(self.units, 'es', 'en')
        assert not r.success and not r.retryable
        assert 'schema validation' in r.error
        assert 'SECRET-CONTENT' not in r.error

    def test_refusal_is_a_permanent_failure(self):
        p = self._provider(_response('', stop_reason='refusal'))
        r = p.translate(self.units, 'es', 'en')
        assert not r.success and not r.retryable

    def test_rate_limit_and_5xx_are_retryable_but_4xx_is_not(self):
        import anthropic
        import httpx2 as httpx

        def status_error(code):
            resp = httpx.Response(code, request=httpx.Request('POST', 'https://api.anthropic.com/v1/messages'))
            return anthropic.APIStatusError('x', response=resp, body=None)

        p = self._provider(side_effect=anthropic.RateLimitError('x', response=httpx.Response(
            429, request=httpx.Request('POST', 'https://api.anthropic.com/v1/messages')), body=None))
        assert p.translate(self.units, 'es', 'en').retryable is True
        p = self._provider(side_effect=status_error(529))
        assert p.translate(self.units, 'es', 'en').retryable is True
        p = self._provider(side_effect=status_error(400))
        r = p.translate(self.units, 'es', 'en')
        assert r.retryable is False and r.error == 'provider error 400'

    def test_connection_error_is_retryable(self):
        import anthropic
        import httpx2 as httpx
        p = self._provider(side_effect=anthropic.APIConnectionError(
            request=httpx.Request('POST', 'https://api.anthropic.com/v1/messages')))
        assert p.translate(self.units, 'es', 'en').retryable is True

    def test_output_schema_is_bound_to_the_pydantic_model(self):
        # The SDK's own transform of the model is the oracle for what the API
        # accepts. It keeps $defs/$ref and titles; OUTPUT_SCHEMA inlines and
        # drops them, so normalise the oracle the same way before comparing.
        from anthropic.lib._parse._transform import transform_schema

        from apps.translations.services import _TranslationOut

        oracle = transform_schema(_TranslationOut)
        defs = oracle.pop('$defs', {})

        def normalise(node):
            if isinstance(node, dict):
                if '$ref' in node:
                    node = {**defs[node.pop('$ref').split('/')[-1]], **node}
                node.pop('title', None)
                return {k: normalise(v) for k, v in node.items()}
            if isinstance(node, list):
                return [normalise(v) for v in node]
            return node

        assert OUTPUT_SCHEMA == normalise(oracle)
        # And the schema really is closed at every object level.
        assert OUTPUT_SCHEMA['additionalProperties'] is False
        assert OUTPUT_SCHEMA['properties']['units']['items']['additionalProperties'] is False

    def test_invalid_effort_is_rejected_at_construction(self):
        with override_settings(**{**PROVIDER_SETTINGS, 'CLIO_TRANSLATION_EFFORT': 'turbo'}), pytest.raises(ValueError):
            ClaudeTranslationProvider()
