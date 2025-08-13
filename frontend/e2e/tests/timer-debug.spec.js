import { test, expect } from '@playwright/test';

test.describe('Timer Debug Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to record page
    await page.goto('http://localhost:3011/record');
    
    // Check if we need to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      // Login with test credentials
      await page.fill('input[placeholder*="username"]', 'test@example.com');
      await page.fill('input[placeholder*="password"]', 'testpass123');
      await page.click('button[type="submit"]');
      
      // Wait for navigation to dashboard
      await page.waitForURL(/dashboard/, { timeout: 10000 });
      
      // Navigate to record page
      await page.goto('http://localhost:3011/record');
      await page.waitForLoadState('networkidle');
    }
    
    // Wait for the record page to load - be more flexible with the text
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('timer shows 00:00 initially', async ({ page }) => {
    // Check that timer shows 00:00 when not recording
    const timerDisplay = page.locator('[data-testid="recording-time"]');
    await expect(timerDisplay).toContainText('00:00');
    
    console.log('Initial timer value verified: 00:00');
  });

  test('timer starts counting when recording begins', async ({ page }, testInfo) => {
    // Grant microphone permission (this might show a browser permission dialog)
    await page.context().grantPermissions(['microphone']);
    
    // Check initial timer value
    const timerDisplay = page.locator('[data-testid="recording-time"]');
    await expect(timerDisplay).toContainText('00:00');
    
    // Start recording
    const recordButton = page.locator('button[title*="Start Recording"]');
    await expect(recordButton).toBeVisible();
    
    // Click record button
    await recordButton.click();
    
    // Wait a bit for recording to start
    await page.waitForTimeout(1000);
    
    // Check that status changed to recording
    const statusDisplay = page.locator('[data-testid="recording-status"]');
    await expect(statusDisplay).toContainText('Recording');
    
    // Wait for timer to increment (at least 2 seconds)
    await page.waitForTimeout(3000);
    
    // Check that timer has incremented
    const timerText = await timerDisplay.textContent();
    console.log('Timer after 3 seconds:', timerText);
    
    // Timer should show at least 00:01 or 00:02
    expect(timerText).toMatch(/00:0[1-9]|00:[1-9][0-9]/);
    
    // Stop recording
    const stopButton = page.locator('button[title*="Stop Recording"]');
    if (await stopButton.isVisible()) {
      await stopButton.click();
    }
    
    // Take a screenshot for debugging
    await page.screenshot({ path: `debug-timer-${testInfo.title.replace(/\s+/g, '-')}.png` });
  });

  test('timer updates every second during recording', async ({ page }, testInfo) => {
    // Grant microphone permission
    await page.context().grantPermissions(['microphone']);
    
    const timerDisplay = page.locator('[data-testid="recording-time"]');
    
    // Start recording
    await page.locator('button[title*="Start Recording"]').click();
    await page.waitForTimeout(500);
    
    // Capture timer values every second for 5 seconds
    const timerValues = [];
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(1000);
      const timerText = await timerDisplay.textContent();
      timerValues.push(timerText);
      console.log(`Timer at second ${i + 1}:`, timerText);
    }
    
    // Verify timer is incrementing
    for (let i = 1; i < timerValues.length; i++) {
      const prevTime = timerValues[i - 1];
      const currentTime = timerValues[i];
      
      // Convert time to seconds for comparison
      const prevSeconds = timeToSeconds(prevTime);
      const currentSeconds = timeToSeconds(currentTime);
      
      expect(currentSeconds).toBeGreaterThan(prevSeconds);
    }
    
    // Stop recording
    const stopButton = page.locator('button[title*="Stop Recording"]');
    if (await stopButton.isVisible()) {
      await stopButton.click();
    }
    
    await page.screenshot({ path: `debug-timer-incrementing-${testInfo.title.replace(/\s+/g, '-')}.png` });
  });
});

// Helper function to convert MM:SS to total seconds
function timeToSeconds(timeString) {
  const parts = timeString.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}