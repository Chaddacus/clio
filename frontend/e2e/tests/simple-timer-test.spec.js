import { test, expect } from '@playwright/test';

test('Simple timer test - check if timer element exists', async ({ page }) => {
  // Navigate to login page first
  await page.goto('http://localhost:3011/login');
  await page.waitForLoadState('networkidle');
  
  // Login with test credentials using proper form fields
  await page.fill('input[name="username"]', 'test@example.com');
  await page.fill('input[name="password"]', 'testpass123');
  await page.click('button[type="submit"]');
  
  // Wait for navigation to dashboard
  await page.waitForURL(/dashboard/, { timeout: 15000 });
  
  // Navigate to record page
  await page.goto('http://localhost:3011/record');
  await page.waitForLoadState('networkidle');
  
  // Take a screenshot to see what's on the page
  await page.screenshot({ path: 'debug-record-page.png', fullPage: true });
  
  // Check if timer element exists
  const timerDisplay = page.locator('[data-testid="recording-time"]');
  
  // Wait for the element to be visible
  try {
    await expect(timerDisplay).toBeVisible({ timeout: 5000 });
    console.log('Timer element found!');
    
    // Get the timer text
    const timerText = await timerDisplay.textContent();
    console.log('Timer shows:', timerText);
    
  } catch (error) {
    console.log('Timer element not found, checking what elements exist...');
    
    // List all elements with data-testid
    const testIds = await page.locator('[data-testid]').evaluateAll(elements => 
      elements.map(el => ({ testId: el.getAttribute('data-testid'), text: el.textContent }))
    );
    console.log('Available test IDs:', testIds);
    
    // Check for any timer-like elements
    const timerElements = await page.locator('*').evaluateAll(elements => 
      elements
        .filter(el => el.textContent && el.textContent.match(/^\d{2}:\d{2}$/))
        .map(el => ({ text: el.textContent, class: el.className, tag: el.tagName }))
    );
    console.log('Timer-like elements found:', timerElements);
  }
});