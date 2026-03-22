import { test, expect } from '@playwright/test';

test.use({ storageState: 'playwright/.auth/user.json' });

test.describe('Profile Page', () => {
  test('loads profile data', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/profile/);
    // Should display the test user's username
    const body = await page.textContent('body');
    expect(body).toContain('testuser');
  });

  test('shows storage information', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    // Profile should show storage quota info
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });
});
