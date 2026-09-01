// Spoken-language proof through the real UI: upload a Spanish clip, wait for the
// worker to transcribe it, and check the note shows Spanish text with a Spanish
// badge. Needs the dev stack running with a real provider key. Opt in with
// CLIO_LIVE_E2E=1 so CI (which has no provider key) is unaffected.
import path from 'path';
import { test, expect } from '@playwright/test';

const FIXTURES = path.resolve(__dirname, '../../../backend/tests/fixtures/audio');

test.use({ storageState: 'playwright/.auth/user.json' });

const uploadAndWaitForTranscript = async (page, fileName, title) => {
  await page.goto('/record');
  await page.waitForLoadState('networkidle');

  await page.getByRole('tab', { name: 'Upload' }).click();
  await page.getByLabel('Choose an audio file to upload').setInputFiles(path.join(FIXTURES, fileName));
  await expect(page.getByText('Ready to transcribe')).toBeVisible();

  await page.fill('input#note-title', title);
  await page.getByRole('button', { name: 'Save & Transcribe' }).click();

  await page.waitForURL(/\/notes\/\d+/, { timeout: 15000 });
  // The page polls while the worker runs. Wait for a positive completion signal (the
  // language badge only renders once transcription finished) rather than for the
  // processing indicator to disappear, which is not yet rendered on first paint.
  await expect(page.getByTestId('note-language')).toBeVisible({ timeout: 90000 });
  return page;
};

test.describe('Multilingual transcription', () => {
  test.skip(!process.env.CLIO_LIVE_E2E, 'set CLIO_LIVE_E2E=1 against a dev stack that has a real provider key');

  test('Spanish upload comes back as Spanish text with a Spanish badge', async ({ page }) => {
    await uploadAndWaitForTranscript(page, 'es_mx.m4a', 'e2e spanish');

    const badge = page.getByTestId('note-language');
    await expect(badge).toHaveText('Spanish');
    await expect(badge).toHaveAttribute('data-language', 'es');

    const body = (await page.textContent('main, body')).toLowerCase();
    expect(body).toContain('hermana');
    expect(body).not.toContain('my sister'); // not translated
    await page.screenshot({ path: 'test-results/multilingual-spanish.png', fullPage: true });
  });

  test('English then Spanish upload keeps both languages', async ({ page }) => {
    await uploadAndWaitForTranscript(page, 'mixed_en_es.m4a', 'e2e mixed');

    const body = (await page.textContent('main, body')).toLowerCase();
    expect(body).toContain('sister');
    expect(body).toContain('hermana');
    await page.screenshot({ path: 'test-results/multilingual-mixed.png', fullPage: true });
  });
});
