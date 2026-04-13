const { test, expect } = require('@playwright/test');

const BASE = 'https://clio.chadacus.dev';
const UNIQUE = `sweep_${Date.now()}`;
const USER = { username: UNIQUE, email: `${UNIQUE}@test.com`, password: 'SweepPass123!' };

test.describe.serial('Production Full Sweep', () => {

  test('1. register new user', async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[name="first_name"]', 'Sweep');
    await page.fill('input[name="last_name"]', 'Test');
    await page.fill('input[name="username"]', USER.username);
    await page.fill('input[name="email"]', USER.email);
    await page.fill('input[name="password"]', USER.password);
    await page.fill('input[name="password_confirm"]', USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await expect(page).toHaveURL(/dashboard/);
  });

  test('2. dashboard loads with stats and greeting', async ({ page }) => {
    // Login
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', USER.username);
    await page.fill('input[name="password"]', USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('text=Welcome back')).toBeVisible();
    await expect(page.locator('text=Total Notes')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();
    await expect(page.locator('text=Processing')).toBeVisible();
    await expect(page.locator('text=Favorites')).toBeVisible();
    await expect(page.locator('text=Storage Usage')).toBeVisible();
  });

  test('3. navigate to record page', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', USER.username);
    await page.fill('input[name="password"]', USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    await page.click('a:has-text("Record")');
    await page.waitForURL('**/record');
    await expect(page.locator('h1:has-text("Record Voice Note")')).toBeVisible();
    await expect(page.locator('text=Recording Tips')).toBeVisible();
  });

  test('4. navigate to profile page and verify user data', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', USER.username);
    await page.fill('input[name="password"]', USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    await page.click('a:has-text("Profile")');
    await page.waitForURL('**/profile');
    await expect(page.locator('h1:has-text("Profile")')).toBeVisible();
    const body = await page.textContent('body');
    expect(body).toContain(USER.username);
  });

  test('5. edit profile — enter edit mode, change, save, verify', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', USER.username);
    await page.fill('input[name="password"]', USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    await page.goto(`${BASE}/profile`);
    await page.waitForLoadState('networkidle');
    await page.click('button:has-text("Edit Profile")');
    await expect(page.locator('input#first_name')).toBeVisible();
    await page.fill('input#first_name', 'SweepEdited');
    await page.click('button:has-text("Save")');
    // Wait for save to complete — look for edit button to reappear (means save succeeded and exited edit mode)
    await expect(page.locator('button:has-text("Edit Profile")')).toBeVisible({ timeout: 10000 });
    // Verify the name updated in the profile view
    const body = await page.textContent('body');
    expect(body).toContain('SweepEdited');
  });

  test('6. create voice note via API and verify transcription', async ({ page, request }) => {
    // Login via API to get cookies
    const loginResp = await request.post(`${BASE}/api/auth/login/`, {
      data: { username: USER.username, password: USER.password },
    });
    expect(loginResp.ok()).toBeTruthy();

    // Generate a tiny WAV file inline (PCM sine wave)
    const sampleRate = 16000;
    const duration = 2;
    const numSamples = sampleRate * duration;
    const headerSize = 44;
    const dataSize = numSamples * 2;
    const buffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    for (let i = 0; i < numSamples; i++) {
      const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 16000;
      view.setInt16(headerSize + i * 2, sample, true);
    }

    // Upload
    const formData = request.createFormData ? undefined : null;
    const uploadResp = await request.post(`${BASE}/api/notes/`, {
      multipart: {
        title: 'Production Sweep Test Note',
        audio_file: {
          name: 'test.wav',
          mimeType: 'audio/wav',
          buffer: Buffer.from(buffer),
        },
      },
    });
    expect(uploadResp.ok()).toBeTruthy();
    const uploadData = await uploadResp.json();
    expect(uploadData.success).toBe(true);
    const noteId = uploadData.data.id;

    // Poll for transcription completion (max 120s)
    let status = 'processing';
    let noteData = null;
    for (let i = 0; i < 24 && status === 'processing'; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const resp = await request.get(`${BASE}/api/notes/${noteId}/`);
      noteData = await resp.json();
      status = noteData.status || noteData.data?.status || 'unknown';
      if (typeof noteData === 'object' && !noteData.status && noteData.id) {
        status = noteData.status;
      }
    }

    expect(status).toBe('completed');
    expect(noteData).toBeTruthy();

    // Now verify it shows on dashboard
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', USER.username);
    await page.fill('input[name="password"]', USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    await expect(page.locator('text=Production Sweep Test Note')).toBeVisible({ timeout: 10000 });
  });

  test('7. view note detail page', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', USER.username);
    await page.fill('input[name="password"]', USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    await page.click('text=Production Sweep Test Note');
    await page.waitForURL('**/notes/**');
    await expect(page.locator('h1:has-text("Production Sweep Test Note")')).toBeVisible();
    await expect(page.locator('text=Transcription')).toBeVisible();
  });

  test('8. delete note with confirm dialog', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', USER.username);
    await page.fill('input[name="password"]', USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // Click delete on the note card
    const deleteBtn = page.locator('button[aria-label="Delete note"]');
    await deleteBtn.click();

    // Confirm dialog should appear (not window.confirm)
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=This action cannot be undone')).toBeVisible();
    await page.click('button:has-text("Delete")');

    // Note should disappear
    await expect(page.locator('text=Production Sweep Test Note')).not.toBeVisible({ timeout: 10000 });
  });

  test('9. logout and verify redirect', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', USER.username);
    await page.fill('input[name="password"]', USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    await page.click('button:has-text("Sign out")');
    await expect(page).toHaveURL(/login/);
  });

  test('10. unauthenticated access blocked', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page).toHaveURL(/login/);
  });
});
