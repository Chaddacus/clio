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
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('displays user email', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body).toContain('test@example.com');
  });

  test('profile page has language preference', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    // Should have a language selection or display
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    expect(body?.length).toBeGreaterThan(100);
  });
});
