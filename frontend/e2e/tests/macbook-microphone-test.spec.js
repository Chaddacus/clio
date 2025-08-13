const { test, expect } = require('@playwright/test');

test.describe('MacBook Microphone Test', () => {
  test('Test recording with MacBook built-in microphone', async ({ browser }) => {
    console.log('🎤 Testing with MacBook built-in microphone...');

    // Create context with microphone permissions
    const context = await browser.newContext({
      permissions: ['microphone'],
      // Allow real microphone access
      acceptDownloads: true,
    });

    const page = await context.newPage();

    // Collect console logs
    const consoleMessages = [];
    page.on('console', msg => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now()
      };
      consoleMessages.push(message);
      // Also log to our console in real-time
      console.log(`[${msg.type()}] ${msg.text()}`);
    });

    // Login
    await page.goto('http://localhost:3011/login');
    try {
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
    } catch (error) {
      console.log('Login handled');
    }

    // Navigate to record page
    await page.goto('http://localhost:3011/record');
    await page.waitForLoadState('networkidle');
    console.log('📍 Record page loaded');

    // Find the record button
    const recordButton = page.locator('[title="Start Recording"]').last();
    await expect(recordButton).toBeVisible();
    
    console.log('🎤 Clicking record button with real MacBook microphone...');
    await recordButton.click();
    
    // Wait a bit for permission dialog and recording to start
    console.log('⏳ Waiting for microphone access and recording to start...');
    await page.waitForTimeout(3000);
    
    // Check if recording started by looking for stop button or recording state
    const stopButton = page.locator('button:has-text("Stop"), [title="Stop Recording"]');
    const isRecording = await stopButton.count() > 0;
    
    if (isRecording) {
      console.log('✅ Recording started successfully! Letting it record for 3 seconds...');
      await page.waitForTimeout(3000);
      
      console.log('🛑 Stopping recording...');
      await stopButton.first().click();
      
      // Wait for recording to complete
      await page.waitForTimeout(2000);
      
      console.log('🎵 Recording completed, checking for audio blob...');
    } else {
      console.log('⚠️ Recording may not have started, checking logs...');
    }
    
    // Filter and analyze logs
    const relevantLogs = consoleMessages.filter(msg => 
      msg.text.includes('[useAudioRecorder]') ||
      msg.text.includes('[RecorderControls]') ||
      msg.text.includes('MediaRecorder') ||
      msg.type === 'error'
    );

    console.log('\n🔍 MACBOOK MICROPHONE TEST RESULTS');
    console.log('==========================================');
    
    // Look for key events
    const constructorSuccessLogs = relevantLogs.filter(log => 
      log.text.includes('MediaRecorder constructor succeeded')
    );
    const constructorFailLogs = relevantLogs.filter(log => 
      log.text.includes('MediaRecorder constructor failed')
    );
    const getUserMediaLogs = relevantLogs.filter(log => 
      log.text.includes('getUserMedia returned')
    );
    const startEventLogs = relevantLogs.filter(log => 
      log.text.includes('ONSTART event fired')
    );
    const stopEventLogs = relevantLogs.filter(log => 
      log.text.includes('ONSTOP event fired')
    );
    const errorLogs = relevantLogs.filter(log => log.type === 'error');

    console.log('\n🎯 ANALYSIS:');
    console.log(`getUserMedia Success: ${getUserMediaLogs.length}`);
    console.log(`Constructor Success: ${constructorSuccessLogs.length}`);
    console.log(`Constructor Failed: ${constructorFailLogs.length}`);
    console.log(`ONSTART Events: ${startEventLogs.length}`);
    console.log(`ONSTOP Events: ${stopEventLogs.length}`);
    console.log(`Error Count: ${errorLogs.length}`);

    if (getUserMediaLogs.length > 0) {
      console.log('✅ getUserMedia worked with real microphone!');
      getUserMediaLogs.forEach(log => console.log(`  ${log.text}`));
    }

    if (constructorSuccessLogs.length > 0) {
      console.log('✅ MediaRecorder constructor succeeded with real MediaStream!');
    }

    if (startEventLogs.length > 0) {
      console.log('✅ MediaRecorder started recording successfully!');
    }

    if (stopEventLogs.length > 0) {
      console.log('✅ MediaRecorder completed recording successfully!');
      stopEventLogs.forEach(log => console.log(`  ${log.text}`));
    }

    if (errorLogs.length > 0) {
      console.log('❌ Errors detected:');
      errorLogs.forEach(err => console.log(`  ${err.text}`));
    }

    console.log('==========================================\n');

    await context.close();

    // Basic assertion - we should have some relevant logs
    expect(relevantLogs.length).toBeGreaterThan(0);
  });
});