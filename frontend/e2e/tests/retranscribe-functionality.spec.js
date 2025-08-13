import { test, expect } from '@playwright/test';

test.describe('Retranscribe Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication cookies
    await page.goto('http://localhost:3011');
    await page.evaluate(() => {
      localStorage.setItem('access_token', 'test_access_token');
      localStorage.setItem('refresh_token', 'test_refresh_token');
    });
  });

  test('should show retry button for failed transcription', async ({ page }) => {
    console.log('🧪 Testing retranscribe functionality for failed note');
    
    // Navigate to the failed note (ID 15)
    await page.goto('http://localhost:3011/notes/15');
    
    // Wait for page to load and verify it's the correct note
    await expect(page.locator('h1')).toContainText('Ai4 Hinton Talk');
    
    // Look for the failed transcription section
    const failedSection = page.locator('text=Transcription failed');
    await expect(failedSection).toBeVisible();
    console.log('✅ Found failed transcription section');
    
    // Check for "Try Again" button
    const retryButton = page.locator('button:has-text("Try Again")');
    await expect(retryButton).toBeVisible();
    console.log('✅ Found "Try Again" button');
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/retranscribe-initial-state.png' });
  });

  test('should open retranscribe dialog when clicking retry button', async ({ page }) => {
    console.log('🧪 Testing retranscribe dialog functionality');
    
    // Navigate to the failed note
    await page.goto('http://localhost:3011/notes/15');
    
    // Wait for the retry button and click it
    const retryButton = page.locator('button:has-text("Try Again")');
    await expect(retryButton).toBeVisible();
    
    await retryButton.click();
    console.log('✅ Clicked "Try Again" button');
    
    // Verify the retranscribe dialog appears
    const dialog = page.locator('.fixed.inset-0'); // Dialog backdrop
    await expect(dialog).toBeVisible();
    
    const dialogTitle = page.locator('h3:has-text("Re-transcribe Audio")');
    await expect(dialogTitle).toBeVisible();
    console.log('✅ Retranscribe dialog opened');
    
    // Verify language selector is present
    const languageSelect = page.locator('#language-select');
    await expect(languageSelect).toBeVisible();
    console.log('✅ Language selector found');
    
    // Take screenshot of dialog
    await page.screenshot({ path: 'test-results/retranscribe-dialog.png' });
  });

  test('should handle retranscribe request properly', async ({ page }) => {
    console.log('🧪 Testing complete retranscribe workflow');
    
    // Set up request interception to monitor API calls
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/retranscribe/')) {
        apiRequests.push(request);
        console.log('📡 Retranscribe API request detected:', request.method(), request.url());
      }
    });
    
    // Monitor responses for errors
    page.on('response', response => {
      if (response.url().includes('/retranscribe/')) {
        console.log('📨 Retranscribe API response:', response.status());
        if (response.status() >= 400) {
          console.error('❌ API Error response:', response.status(), response.statusText());
        }
      }
    });
    
    // Navigate to the failed note
    await page.goto('http://localhost:3011/notes/15');
    
    // Click retry button to open dialog
    await page.locator('button:has-text("Try Again")').click();
    
    // Select language (English)
    await page.locator('#language-select').selectOption('en');
    console.log('✅ Selected English language');
    
    // Submit the retranscribe request
    const submitButton = page.locator('button:has-text("Re-transcribe")');
    await expect(submitButton).toBeVisible();
    
    // Take screenshot before submitting
    await page.screenshot({ path: 'test-results/retranscribe-before-submit.png' });
    
    await submitButton.click();
    console.log('✅ Submitted retranscribe request');
    
    // Wait a moment for the request to be processed
    await page.waitForTimeout(2000);
    
    // Check if any API requests were made
    expect(apiRequests.length).toBeGreaterThan(0);
    console.log(`✅ ${apiRequests.length} retranscribe API request(s) made`);
    
    // Look for processing state (dialog should close, status should update)
    const processingText = page.locator('text=Processing');
    const retryingText = page.locator('text=Retrying');
    
    // Take screenshot after submission
    await page.screenshot({ path: 'test-results/retranscribe-after-submit.png' });
    
    // Wait for either processing state or error state
    await Promise.race([
      page.waitForSelector('text=Processing', { timeout: 5000 }).catch(() => null),
      page.waitForSelector('text=Retrying', { timeout: 5000 }).catch(() => null),
      page.waitForSelector('text=failed', { timeout: 5000 }).catch(() => null),
      page.waitForSelector('text=completed', { timeout: 5000 }).catch(() => null)
    ]);
    
    console.log('✅ Retranscribe workflow completed');
  });

  test('should handle API errors gracefully', async ({ page }) => {
    console.log('🧪 Testing error handling in retranscribe');
    
    let hasApiError = false;
    
    // Monitor for API errors
    page.on('response', response => {
      if (response.url().includes('/retranscribe/') && response.status() >= 400) {
        hasApiError = true;
        console.log('📨 API Error detected:', response.status());
      }
    });
    
    // Navigate and attempt retranscribe
    await page.goto('http://localhost:3011/notes/15');
    await page.locator('button:has-text("Try Again")').click();
    await page.locator('#language-select').selectOption('en');
    await page.locator('button:has-text("Re-transcribe")').click();
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/retranscribe-final-state.png' });
    
    // If there was an API error, the UI should still be functional
    if (hasApiError) {
      console.log('⚠️  API error occurred, checking UI remains functional');
      
      // Verify the page is still responsive
      const pageTitle = page.locator('h1');
      await expect(pageTitle).toBeVisible();
      
      // The retry button should still be available for another attempt
      const retryButton = page.locator('button:has-text("Try Again")');
      await expect(retryButton).toBeVisible();
    }
    
    console.log('✅ Error handling test completed');
  });
});