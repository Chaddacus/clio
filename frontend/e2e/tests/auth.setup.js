import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page, request }) => {
  // Ensure test user exists by attempting registration (ignore if already exists)
  await request.post('http://localhost:8011/api/auth/register/', {
    data: {
      username: 'testuser',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      password: 'TestPass123!',
      password_confirm: 'TestPass123!',
    },
  }).catch(() => {});

  // Login via the UI
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="username"]', 'testuser');
  await page.fill('input[name="password"]', 'TestPass123!');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await expect(page).toHaveURL(/dashboard/);

  // Save authentication state (localStorage tokens)
  await page.context().storageState({ path: authFile });
});
