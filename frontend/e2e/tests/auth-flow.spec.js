import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'nonexistent');
    await page.fill('input[name="password"]', 'wrongpass');
    await page.click('button[type="submit"]');

    // Should stay on login page or show error
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain('login');
  });

  test('register page loads', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
