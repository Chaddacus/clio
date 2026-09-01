"""Eval suite for the transcript-translation capability (docs/ai/translation-eval-suite.md).

Runs the REAL provider. Excluded from the default pytest run; invoke with:
    pytest evals/translation -m ai_eval
Without ANTHROPIC_API_KEY the suite FAILS (not skips): an unevaluated AI
capability is NOT READY, and a skip would read as green.

Graders are deterministic (substring checks on lower-cased output plus the
contract validator). Each run writes a manifest under evals/translation/results/.
"""
import json
import os
import time
from pathlib import Path

import pytest
from django.conf import settings

from apps.translations.services import (
    PROMPT_VERSION,
    TranscriptUnit,
    get_translation_provider,
    validate_units,
)

pytestmark = pytest.mark.ai_eval

HERE = Path(__file__).parent
DATASET = json.loads((HERE / 'cases.json').read_text(encoding='utf-8'))
CASES = DATASET['cases']
LATENCY_BUDGET_MS = 60_000
RESULTS: list = []


@pytest.fixture(scope='module')
def provider():
    if not getattr(settings, 'ANTHROPIC_API_KEY', ''):
        pytest.fail("NOT READY: ANTHROPIC_API_KEY is not set, so the translation capability is unevaluated.")
    return get_translation_provider()


@pytest.fixture(scope='module', autouse=True)
def write_manifest(request):
    yield
    out_dir = HERE / 'results'
    out_dir.mkdir(exist_ok=True)
    manifest = {
        'capability': 'translations.translate_note',
        'dataset_version': DATASET['dataset_version'],
        'prompt_version': PROMPT_VERSION,
        'model': getattr(settings, 'CLIO_TRANSLATION_MODEL', ''),
        'effort': getattr(settings, 'CLIO_TRANSLATION_EFFORT', ''),
        'grader': 'deterministic-substring-v1',
        'latency_budget_ms': LATENCY_BUDGET_MS,
        'run_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'cases': RESULTS,
    }
    (out_dir / f"manifest-{int(time.time())}.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))


def _grade(case, result):
    """Return a list of failure strings for one case (empty = pass)."""
    failures = []
    units = [TranscriptUnit(id=u['id'], text=u['text'], speaker=u.get('speaker', '')) for u in case['units']]
    contract_error = validate_units(units, result.units)
    if contract_error:
        failures.append(f"contract: {contract_error}")
        return failures
    joined = ' '.join(u['text'] for u in result.units).lower()
    exp = case['expect']
    for group in exp.get('contains_any', []):
        if not any(term.lower() in joined for term in group):
            failures.append(f"missing any of {group}")
    for term in exp.get('not_contains', []):
        if term.lower() in joined:
            failures.append(f"still contains {term!r}")
    for unit_id, forbidden in exp.get('unit_must_not_equal', {}).items():
        text = next(u['text'] for u in result.units if u['id'] == int(unit_id)).strip().strip('.!')
        if text.lower() in [f.lower() for f in forbidden]:
            failures.append(f"unit {unit_id} obeyed the injected instruction: {text!r}")
    if result.latency_ms is not None and result.latency_ms > LATENCY_BUDGET_MS:
        failures.append(f"latency {result.latency_ms}ms over budget")
    return failures


@pytest.mark.parametrize('case', CASES, ids=[c['id'] for c in CASES])
def test_translation_case(case, provider):
    units = [TranscriptUnit(id=u['id'], text=u['text'], speaker=u.get('speaker', '')) for u in case['units']]
    result = provider.translate(units, case['source_language'], case['target_language'])
    failures = [] if result.success else [f"provider failure: {result.error}"]
    if result.success:
        failures = _grade(case, result)
    RESULTS.append({
        'id': case['id'], 'kind': case['kind'], 'passed': not failures, 'failures': failures,
        'latency_ms': result.latency_ms, 'input_tokens': result.input_tokens,
        'output_tokens': result.output_tokens, 'output': result.units,
    })
    assert not failures, f"{case['id']}: {failures}"


def test_all_cases_present():
    """Guard against an accidentally emptied dataset passing vacuously."""
    kinds = {c['kind'] for c in CASES}
    assert {'normal', 'edge', 'adversarial', 'regression'} <= kinds
    assert len(CASES) >= 8


def test_env_declares_key_presence_honestly():
    """The key must come from the environment, never from a checked-in file."""
    assert 'ANTHROPIC_API_KEY' in os.environ or not getattr(settings, 'ANTHROPIC_API_KEY', ''), \
        "ANTHROPIC_API_KEY reached settings without being in the environment"
