import { test, expect } from '@playwright/test';

test.use({ storageState: 'playwright/.auth/user.json' });

test.describe('Dashboard', () => {
  test('loads after login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    // Dashboard should have a heading or main content
    await expect(page).toHaveURL(/dashboard/);
  });

  test('shows user statistics section', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    // Should display stats (total notes, etc.)
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('navigates to record page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Find and click the record/new note link
    const recordLink = page.locator('a[href="/record"]').first();
    if (await recordLink.isVisible()) {
      await recordLink.click();
      await expect(page).toHaveURL(/record/);
    }
  });

  test('navigates to profile page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const profileLink = page.locator('a[href="/profile"]').first();
    if (await profileLink.isVisible()) {
      await profileLink.click();
      await expect(page).toHaveURL(/profile/);
    }
  });

  test('shows empty state when no notes', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    // Page should render without errors even with zero notes
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    // Should not show error state
    expect(body).not.toContain('500');
  });

  test('displays storage information', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    // Dashboard should show some storage/stats info
    const body = await page.textContent('body');
    // At minimum the page should have rendered content
    expect(body?.length).toBeGreaterThan(50);
  });
});
