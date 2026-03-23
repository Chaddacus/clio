import { test, expect } from '@playwright/test';

test.describe('Registration Flow', () => {
  test('register page loads with form', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('register with valid data redirects to dashboard', async ({ page }) => {
    const uniqueUser = `regtest_${Date.now()}`;
    await page.goto('/register');
    await page.fill('input[name="first_name"]', 'Reg');
    await page.fill('input[name="last_name"]', 'Test');
    await page.fill('input[name="username"]', uniqueUser);
    await page.fill('input[name="email"]', `${uniqueUser}@example.com`);
    await page.fill('input[name="password"]', 'StrongPass123!');
    await page.fill('input[name="password_confirm"]', 'StrongPass123!');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL(/dashboard/);
  });

  test('register with duplicate username shows error', async ({ page }) => {
    // testuser was created by auth.setup.js
    await page.goto('/register');
    await page.fill('input[name="first_name"]', 'Dup');
    await page.fill('input[name="last_name"]', 'User');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="email"]', 'dup@example.com');
    await page.fill('input[name="password"]', 'StrongPass123!');
    await page.fill('input[name="password_confirm"]', 'StrongPass123!');
    await page.click('button[type="submit"]');

    // Should stay on register page or show error
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain('register');
  });

  test('register with password mismatch shows error', async ({ page }) => {
    await page.goto('/register');
    await page.fill('input[name="username"]', 'mismatch_user');
    await page.fill('input[name="email"]', 'mismatch@example.com');
    await page.fill('input[name="password"]', 'StrongPass123!');
    await page.fill('input[name="password_confirm"]', 'DifferentPass123!');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain('register');
  });
});
