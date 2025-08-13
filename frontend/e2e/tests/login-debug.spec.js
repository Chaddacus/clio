const { test, expect } = require('@playwright/test');

test.describe('Login Debug', () => {
  test('debug login process', async ({ page }) => {
    console.log('🔐 Starting login debug...');
    
    // Go to login page
    await page.goto('http://localhost:3011/login');
    await page.waitForLoadState('networkidle');
    
    console.log('📄 Current URL:', page.url());
    
    // Check if login form exists
    const loginForm = await page.locator('form').count();
    console.log('📝 Login forms found:', loginForm);
    
    const usernameInput = await page.locator('input[name="username"], input[type="email"], input[id="username"], input[id="email"]').count();
    const passwordInput = await page.locator('input[name="password"], input[type="password"], input[id="password"]').count();
    const submitButton = await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').count();
    
    console.log('🔧 Form elements:', { usernameInput, passwordInput, submitButton });
    
    if (usernameInput > 0 && passwordInput > 0 && submitButton > 0) {
      console.log('✅ Login form is present, attempting login...');
      
      // Fill the form
      await page.fill('input[name="username"], input[type="email"], input[id="username"], input[id="email"]', 'testuser');
      await page.fill('input[name="password"], input[type="password"], input[id="password"]', 'testpassword123');
      
      // Take screenshot before submit
      await page.screenshot({ path: 'before-login-submit.png' });
      
      // Submit the form
      await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      // Wait for response
      await page.waitForTimeout(3000);
      
      console.log('📄 URL after login attempt:', page.url());
      
      // Take screenshot after login attempt
      await page.screenshot({ path: 'after-login-attempt.png' });
      
      // Check for error messages
      const errorMessages = await page.locator('.error, .alert, .text-red', { hasText: /error|failed|invalid/i }).count();
      console.log('❌ Error messages found:', errorMessages);
      
      if (errorMessages > 0) {
        const errorText = await page.locator('.error, .alert, .text-red').first().textContent();
        console.log('❌ Error message:', errorText);
      }
      
      // Check if we're now on dashboard
      if (page.url().includes('/dashboard')) {
        console.log('✅ Successfully reached dashboard!');
        
        // Wait for data to load
        await page.waitForTimeout(3000);
        
        // Check for recording cards
        const recordingCards = await page.locator('div:has-text("Created"), div:has-text("MB")').count();
        console.log('📋 Recording elements found on dashboard:', recordingCards);
        
        // Take screenshot of dashboard
        await page.screenshot({ path: 'successful-dashboard.png' });
        
      } else {
        console.log('❌ Did not reach dashboard, still on:', page.url());
      }
      
    } else {
      console.log('❌ Login form elements missing');
    }
    
    console.log('✅ Login debug completed');
  });
});