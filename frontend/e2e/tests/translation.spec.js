// Translation panel proof through the real UI.
//
// The first three tests mock the note and translation endpoints so the panel's
// states (disabled, request -> pending -> completed, failed -> retry) are proven
// without a provider key. The last test runs the real pipeline (upload a
// Spanish clip, translate to English) and needs both provider keys in the dev
// stack; opt in with CLIO_LIVE_TRANSLATION=1.
import path from 'path';
import { test, expect } from '@playwright/test';

const FIXTURES = path.resolve(__dirname, '../../../backend/tests/fixtures/audio');
const NOTE_ID = 4242;

test.use({ storageState: 'playwright/.auth/user.json' });

const mockNote = {
  id: NOTE_ID,
  title: 'Mensaje para mi hermana',
  transcription: 'Hola hermana. Mañana te llamo a las nueve.',
  username: 'testuser',
  audio_file: '',
  audio_url: null,
  duration: '0:00:05',
  file_size_mb: 0.1,
  language_detected: 'es',
  confidence_score: 0.98,
  status: 'completed',
  error_message: '',
  is_favorite: false,
  tags: [],
  folder: null,
  folder_name: null,
  segments: [
    { id: 71, start_time: 0, end_time: 2, duration: 2, text: 'Hola hermana.', confidence: 0.99, speaker_id: 'Speaker 1' },
    { id: 72, start_time: 2, end_time: 5, duration: 3, text: 'Mañana te llamo a las nueve.', confidence: 0.97, speaker_id: 'Speaker 2' },
  ],
  speakers: [
    { id: 5, label: 'Speaker 1', name: 'Ana' },
    { id: 6, label: 'Speaker 2', name: 'Speaker 2' },
  ],
  created_at: '2026-09-01T12:00:00Z',
  updated_at: '2026-09-01T12:00:00Z',
};

const englishRow = (status, extra = {}) => ({
  id: 9,
  voice_note: NOTE_ID,
  target_language: 'en',
  source_language: 'es',
  status,
  text: status === 'completed' ? 'Hi sister. I will call you tomorrow at nine.' : '',
  segments: status === 'completed'
    ? [{ segment_id: 71, text: 'Hi sister.' }, { segment_id: 72, text: 'I will call you tomorrow at nine.' }]
    : [],
  error_message: status === 'failed' ? 'Translation failed. Please try again.' : '',
  model: 'claude-opus-5',
  prompt_version: 'translate-v1',
  created_at: '2026-09-01T12:01:00Z',
  updated_at: '2026-09-01T12:01:00Z',
  ...extra,
});

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const mockNoteRoutes = async (page, { enabled, rows, onPost }) => {
  await page.route(`**/api/notes/${NOTE_ID}/`, (route) => json(route, mockNote));
  await page.route(`**/api/notes/${NOTE_ID}/translations/`, (route) => {
    if (route.request().method() === 'POST') return onPost(route);
    return json(route, { success: true, enabled, data: rows() });
  });
};

test('panel says translation is not enabled when the server has no provider', async ({ page }) => {
  await mockNoteRoutes(page, { enabled: false, rows: () => [], onPost: (r) => json(r, {}, 503) });
  await page.goto(`/notes/${NOTE_ID}`);
  await expect(page.getByTestId('translation-disabled')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Translate' })).toHaveCount(0);
});

test('request a translation: pending, then completed with speaker turns', async ({ page }) => {
  let rows = [];
  let posted = null;
  await mockNoteRoutes(page, {
    enabled: true,
    rows: () => rows,
    onPost: (route) => {
      posted = route.request().postDataJSON();
      rows = [englishRow('pending')];
      return json(route, { success: true, message: 'Translation in progress.', data: rows[0] }, 202);
    },
  });

  await page.goto(`/notes/${NOTE_ID}`);
  await expect(page.getByTestId('translation-empty')).toBeVisible();

  const select = page.locator('#translation-target');
  await expect(select).toHaveValue('en');
  const options = await select.locator('option').allTextContents();
  expect(options).not.toContain('Spanish');
  expect(options).not.toContain('Auto-detect');

  await page.getByRole('button', { name: 'Translate' }).click();
  await expect(page.getByTestId('translation-pending')).toBeVisible();
  expect(posted).toEqual({ target_language: 'en' });

  // Worker finishes: the next poll returns the completed row.
  rows = [englishRow('completed')];
  const text = page.getByTestId('translation-text');
  await expect(text).toBeVisible({ timeout: 10000 });
  await expect(text).toContainText('sister');
  await expect(text).toHaveAttribute('data-language', 'en');

  const turns = page.getByTestId('translation-turns');
  await expect(turns.getByText('Ana')).toBeVisible();
  await expect(turns.getByText('Hi sister.')).toBeVisible();
  await expect(turns.getByText('I will call you tomorrow at nine.')).toBeVisible();

  // The original transcript is still there, untouched.
  await expect(page.getByText('Hola hermana. Mañana te llamo a las nueve.')).toBeVisible();
  await page.screenshot({ path: 'test-results/translation-completed.png', fullPage: true });
});

test('a failed translation shows the message and Retry re-requests it', async ({ page }) => {
  let rows = [englishRow('failed')];
  let posts = 0;
  await mockNoteRoutes(page, {
    enabled: true,
    rows: () => rows,
    onPost: (route) => {
      posts += 1;
      rows = [englishRow('pending')];
      return json(route, { success: true, data: rows[0] }, 202);
    },
  });

  await page.goto(`/notes/${NOTE_ID}`);
  const failed = page.getByTestId('translation-failed');
  await expect(failed).toBeVisible();
  await expect(failed).toContainText('Translation failed');
  await failed.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByTestId('translation-pending')).toBeVisible();
  expect(posts).toBe(1);
});

test('live: Spanish upload translated to English', async ({ page }) => {
  test.skip(!process.env.CLIO_LIVE_TRANSLATION, 'needs DEEPGRAM_API_KEY and ANTHROPIC_API_KEY in the dev stack');
  test.setTimeout(240000);

  await page.goto('/record');
  await page.waitForLoadState('networkidle');
  await page.getByRole('tab', { name: 'Upload' }).click();
  await page.getByLabel('Choose an audio file to upload').setInputFiles(path.join(FIXTURES, 'es_mx.m4a'));
  await expect(page.getByText('Ready to transcribe')).toBeVisible();
  await page.fill('input#note-title', 'Live translation check');
  await page.getByRole('button', { name: 'Save & Transcribe' }).click();
  await page.waitForURL(/\/notes\/\d+/, { timeout: 15000 });
  await expect(page.getByTestId('note-language')).toHaveAttribute('data-language', 'es', { timeout: 90000 });

  await page.locator('#translation-target').selectOption('en');
  await page.getByRole('button', { name: 'Translate' }).click();
  const text = page.getByTestId('translation-text');
  await expect(text).toBeVisible({ timeout: 120000 });
  await expect(text).toContainText(/sister/i);
  await page.screenshot({ path: 'test-results/translation-live.png', fullPage: true });
});
