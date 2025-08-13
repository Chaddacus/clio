const { test, expect } = require('@playwright/test');

test.describe('Simple Recording Debug', () => {
  test('Capture screenshot and debug info', async ({ page, context }) => {
    console.log('🔍 Simple debug test starting...');

    // Login quickly
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    try {
      await page.fill('input[name="username"], input[type="email"]', 'testuser');
      await page.fill('input[name="password"], input[type="password"]', 'testpassword123');
      await page.click('button[type="submit"], button:has-text("Login")');
      await page.waitForTimeout(3000);
    } catch (error) {
      console.log('Login handled, continuing...');
    }

    // Go to record page
    await page.goto('/record');
    await page.waitForLoadState('networkidle');
    
    // Take initial screenshot
    await page.screenshot({ path: 'debug-initial.png', fullPage: true });
    console.log('📷 Initial screenshot taken');

    // Check if debugger is visible
    const debuggerExists = await page.locator('h2:has-text("Debug Recording Issue")').count();
    console.log('🔧 Debugger section exists:', debuggerExists > 0);

    // Check start button
    const startButton = page.locator('button:has-text("Start Recording")').first();
    const startButtonExists = await startButton.count();
    console.log('🎯 Start button count:', startButtonExists);

    if (startButtonExists > 0) {
      const isEnabled = await startButton.isEnabled();
      const text = await startButton.textContent();
      console.log('▶️ Start button enabled:', isEnabled);
      console.log('📝 Start button text:', text);

      // Click the button and immediately check what happens
      console.log('🖱️ Clicking start button...');
      await startButton.click();
      
      // Wait just a moment
      await page.waitForTimeout(1000);
      
      // Check button state after click
      const afterClickEnabled = await startButton.isEnabled();
      const afterClickText = await startButton.textContent();
      console.log('📊 After click - enabled:', afterClickEnabled);
      console.log('📊 After click - text:', afterClickText);
      
      // Take screenshot after click
      await page.screenshot({ path: 'debug-after-click.png', fullPage: true });
      console.log('📷 After-click screenshot taken');
      
      // Look for any error messages or status changes
      const toastMessages = await page.locator('.toast, [role="alert"], .error').allTextContents();
      if (toastMessages.length > 0) {
        console.log('🚨 Toast/Alert messages:', toastMessages);
      }
      
      // Check if logs appeared in debugger
      const logContainer = page.locator('.bg-black.text-green-400');
      if (await logContainer.count() > 0) {
        const logText = await logContainer.textContent();
        console.log('📋 Debug logs:', logText?.slice(0, 500) + '...');
      }
    }

    console.log('✅ Simple debug test completed');
  });
});