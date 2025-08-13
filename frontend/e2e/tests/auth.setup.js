import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the login page
  await page.goto('/login');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Fill in the login form
  await page.fill('input[name="username"]', 'testuser');
  await page.fill('input[name="password"]', 'testpassword123');
  
  // Click the login button
  await page.click('button[type="submit"]');
  
  // Wait for successful login - should redirect to dashboard
  await page.waitForURL('/dashboard');
  
  // Verify we're logged in by checking for dashboard content
  await expect(page.locator('h1')).toContainText('Dashboard');
  
  // Save the authentication state
  await page.context().storageState({ path: authFile });
});