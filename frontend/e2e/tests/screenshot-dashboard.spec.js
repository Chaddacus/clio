import { test } from '@playwright/test';

test('Take current dashboard screenshot', async ({ page }) => {
  // Helper function to handle login
  async function loginUser(page) {
    try {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      // Fill login credentials
      await page.fill('input[name="username"], input[type="email"], input[id="username"], input[id="email"]', 'testuser');
      await page.fill('input[name="password"], input[type="password"], input[id="password"]', 'testpassword123');
      
      // Click login button
      await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      // Wait for redirect to dashboard
      await page.waitForURL('/dashboard', { timeout: 10000 }).catch(async () => {
        await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 5000 });
      });
      
      return true;
    } catch (error) {
      console.warn('Login failed, continuing anyway:', error.message);
      return false;
    }
  }

  console.log('📸 Taking current dashboard screenshot...');
  
  // Login first
  await loginUser(page);
  
  // Navigate to dashboard
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // Allow for complete rendering
  
  // Take full page screenshot
  await page.screenshot({ 
    path: 'dashboard-current.png',
    fullPage: true 
  });
  
  // Take focused screenshot of the sidebar
  const sidebar = page.locator('.w-64').first();
  if (await sidebar.count() > 0) {
    await sidebar.screenshot({ 
      path: 'sidebar-current.png' 
    });
  }
  
  console.log('✅ Screenshots saved: dashboard-current.png and sidebar-current.png');
});