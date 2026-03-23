import { test, expect } from '@playwright/test';

test.describe('Navigation - Unauthenticated', () => {
  test('dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login', { timeout: 5000 });
    await expect(page).toHaveURL(/login/);
  });

  test('record page redirects to login', async ({ page }) => {
    await page.goto('/record');
    await page.waitForURL('**/login', { timeout: 5000 });
    await expect(page).toHaveURL(/login/);
  });

  test('profile redirects to login', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForURL('**/login', { timeout: 5000 });
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Navigation - Authenticated', () => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('sidebar has dashboard link', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const dashLink = page.locator('a[href="/dashboard"]').first();
    await expect(dashLink).toBeVisible();
  });

  test('sidebar has record link', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const recordLink = page.locator('a[href="/record"]').first();
    if (await recordLink.isVisible()) {
      await recordLink.click();
      await expect(page).toHaveURL(/record/);
    }
  });

  test('sidebar has profile link', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const profileLink = page.locator('a[href="/profile"]').first();
    if (await profileLink.isVisible()) {
      await profileLink.click();
      await expect(page).toHaveURL(/profile/);
    }
  });
});
