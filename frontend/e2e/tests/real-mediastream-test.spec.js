const { test, expect } = require('@playwright/test');

test.describe('Real MediaStream Test', () => {
  test('Test with real getUserMedia (no mocking)', async ({ page, context }) => {
    console.log('🔍 Testing with real getUserMedia...');

    // Grant microphone permissions
    await context.grantPermissions(['microphone']);

    // Collect console logs
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Login
    await page.goto('/login');
    try {
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
    } catch (error) {
      console.log('Login handled');
    }

    // Navigate to record page
    await page.goto('/record');
    await page.waitForLoadState('networkidle');
    console.log('📍 Record page loaded');

    // Find and click the record button
    const recordButton = page.locator('[title="Start Recording"]').last();
    await expect(recordButton).toBeVisible();
    
    console.log('🎤 Clicking record button with real MediaStream...');
    await recordButton.click();
    
    // Wait for processing and check for any permission dialogs
    console.log('⏳ Waiting for any permission dialogs...');
    await page.waitForTimeout(2000);
    
    // Check if there's a permission dialog and try to approve it
    try {
      // Look for browser permission dialog (this is tricky to automate)
      console.log('🔍 Checking page state...');
      const pageTitle = await page.title();
      console.log('Page title:', pageTitle);
      
      // Check for any error toasts or messages
      const errorElements = await page.locator('[role="alert"], .error, .toast').allTextContents();
      if (errorElements.length > 0) {
        console.log('Error elements found:', errorElements);
      }
      
    } catch (error) {
      console.log('Permission check error:', error.message);
    }
    
    console.log('⏳ Waiting additional 3 seconds for MediaRecorder logs...');
    await page.waitForTimeout(3000);
    
    // Filter relevant logs including errors
    const relevantLogs = consoleMessages.filter(msg => 
      msg.text.includes('[useAudioRecorder]') ||
      msg.text.includes('[RecorderControls]') ||
      msg.text.includes('MediaRecorder') ||
      msg.type === 'error'
    );

    console.log('\n🔍 REAL MEDIASTREAM TEST RESULTS');
    console.log('==========================================');
    
    // Show all relevant logs
    relevantLogs.forEach(log => {
      console.log(`[${log.type}] ${log.text}`);
    });

    // Look for specific patterns
    const constructorSuccessLogs = relevantLogs.filter(log => 
      log.text.includes('MediaRecorder constructor succeeded')
    );
    const constructorFailLogs = relevantLogs.filter(log => 
      log.text.includes('MediaRecorder constructor failed')
    );
    const startEventLogs = relevantLogs.filter(log => 
      log.text.includes('ONSTART event fired')
    );
    const stopEventLogs = relevantLogs.filter(log => 
      log.text.includes('ONSTOP event fired')
    );

    console.log('\n🎯 ANALYSIS:');
    console.log(`Constructor Success: ${constructorSuccessLogs.length}`);
    console.log(`Constructor Failed: ${constructorFailLogs.length}`);
    console.log(`ONSTART Events: ${startEventLogs.length}`);
    console.log(`ONSTOP Events: ${stopEventLogs.length}`);

    if (constructorSuccessLogs.length > 0) {
      console.log('✅ MediaRecorder constructor works with real MediaStream!');
    } else if (constructorFailLogs.length > 0) {
      console.log('❌ MediaRecorder constructor still fails with real MediaStream');
      constructorFailLogs.forEach(log => console.log(`  Error: ${log.text}`));
    } else {
      console.log('⚠️  No clear constructor result');
    }

    console.log('==========================================\n');

    // Basic assertion
    expect(relevantLogs.length).toBeGreaterThan(0);
  });
});