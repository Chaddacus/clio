"""Live provider check: real audio through the real Deepgram service.

Excluded from the default run (pytest.ini adds ``-m "not live"``). Run before a
deploy with::

    DEEPGRAM_API_KEY=... pytest -m live

Each fixture in tests/fixtures/audio/ is a short synthetic clip (macOS speech
voices) with a known language and a keyword the transcript must contain.
This is the MODULE-tier evidence that the auto path keeps the spoken language;
the unit tests only prove how a recorded response is handled.
"""
from pathlib import Path

import pytest
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.core.services import DeepgramTranscriptionService

FIXTURES = Path(__file__).resolve().parent.parent / 'fixtures' / 'audio'

# file, expected language, keyword that must appear in the transcript
CASES = [
    ('es_mx.m4a', 'es', 'hermana'),
    ('es_es.m4a', 'es', 'informe'),
    ('en_us.m4a', 'en', 'dentist'),
    ('ko_kr.m4a', 'ko', '병원'),
    ('zh_cn.m4a', 'zh', '医生'),
]

pytestmark = pytest.mark.live


@pytest.fixture(scope='module')
def service():
    if not settings.DEEPGRAM_API_KEY:
        pytest.skip('DEEPGRAM_API_KEY not set; live provider check skipped')
    return DeepgramTranscriptionService()


@pytest.mark.parametrize('file_name, expected_language, keyword', CASES)
def test_auto_keeps_spoken_language(service, file_name, expected_language, keyword):
    audio = SimpleUploadedFile(file_name, (FIXTURES / file_name).read_bytes(), content_type='audio/mp4')
    result = service.transcribe_audio(audio, language='auto')
    assert result['success'] is True, result.get('error')
    assert result['language'] == expected_language
    assert keyword in result['text'].lower()


def test_mixed_english_spanish_keeps_both_languages(service):
    audio = SimpleUploadedFile(
        'mixed_en_es.m4a', (FIXTURES / 'mixed_en_es.m4a').read_bytes(), content_type='audio/mp4'
    )
    result = service.transcribe_audio(audio, language='auto')
    assert result['success'] is True, result.get('error')
    text = result['text'].lower()
    assert 'sister' in text          # English half survives
    assert 'hermana' in text         # Spanish half survives, not translated
