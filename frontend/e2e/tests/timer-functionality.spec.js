import { test, expect } from '@playwright/test';

test.describe('Timer Functionality Test', () => {
  test('timer should increment when recording', async ({ page }) => {
    // Go to the application - it will redirect to login if not authenticated
    await page.goto('http://localhost:3011/record');
    await page.waitForLoadState('networkidle');
    
    // Handle login if needed
    if (page.url().includes('/login')) {
      console.log('Logging in...');
      await page.fill('input[name="username"]', 'test@example.com');
      await page.fill('input[name="password"]', 'testpass123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/dashboard/, { timeout: 10000 });
      
      // Go to record page
      await page.goto('http://localhost:3011/record');
      await page.waitForLoadState('networkidle');
    }
    
    // Grant microphone permission
    await page.context().grantPermissions(['microphone']);
    
    // Find the timer element
    const timerElement = page.locator('[data-testid="recording-time"]');
    await expect(timerElement).toBeVisible();
    
    // Check initial timer value
    const initialTime = await timerElement.textContent();
    console.log('Initial timer value:', initialTime);
    expect(initialTime).toBe('00:00');
    
    // Start recording by clicking the record button
    const recordButton = page.locator('button').filter({ hasText: /start recording/i }).or(
      page.locator('button[title*="Start Recording"]')
    ).or(
      page.locator('button').filter({ has: page.locator('svg') }).first()
    );
    
    console.log('Looking for record button...');
    await expect(recordButton).toBeVisible({ timeout: 5000 });
    
    // Take screenshot before clicking
    await page.screenshot({ path: 'before-record-click.png' });
    
    await recordButton.click();
    console.log('Record button clicked');
    
    // Wait a moment for recording to start
    await page.waitForTimeout(1000);
    
    // Check if status changed to recording
    const statusElement = page.locator('[data-testid="recording-status"]');
    if (await statusElement.isVisible()) {
      const status = await statusElement.textContent();
      console.log('Recording status:', status);
    }
    
    // Wait for timer to increment (check every second for up to 5 seconds)
    let timerUpdated = false;
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(1000);
      const currentTime = await timerElement.textContent();
      console.log(`Timer after ${i + 1} second(s):`, currentTime);
      
      if (currentTime !== '00:00' && currentTime !== initialTime) {
        timerUpdated = true;
        console.log('Timer successfully updated to:', currentTime);
        break;
      }
    }
    
    // Take screenshot after waiting
    await page.screenshot({ path: 'after-recording-wait.png' });
    
    // Stop recording if button exists
    const stopButton = page.locator('button').filter({ hasText: /stop/i }).or(
      page.locator('button[title*="Stop Recording"]')
    );
    
    if (await stopButton.isVisible()) {
      await stopButton.click();
      console.log('Recording stopped');
    }
    
    // Assert that timer was updated
    expect(timerUpdated).toBeTruthy();
  });
});