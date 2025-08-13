const { test, expect } = require('@playwright/test');

test.describe('Enhanced Recording Error Debugging', () => {
  test('Capture detailed recording error with enhanced debugging', async ({ browser }) => {
    console.log('🔍 Testing enhanced recording error debugging...');

    // Create context with microphone permissions granted
    const context = await browser.newContext({
      permissions: ['microphone'],
    });

    const page = await context.newPage();

    // Collect ALL console messages including detailed debugging
    const consoleMessages = [];
    page.on('console', msg => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now()
      };
      consoleMessages.push(message);
      // Log to our test console in real-time for immediate visibility
      console.log(`[${msg.type()}] ${msg.text()}`);
    });

    // Also capture any page errors
    page.on('pageerror', error => {
      console.log(`[PAGE ERROR] ${error.message}`);
      consoleMessages.push({
        type: 'pageerror',
        text: error.message,
        timestamp: Date.now()
      });
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

    // Wait for components to initialize
    await page.waitForTimeout(2000);

    // Try to grant microphone permission first if the component exists
    const permissionButton = page.locator('button:has-text("Allow microphone access")');
    const hasPermissionButton = await permissionButton.count() > 0;
    
    if (hasPermissionButton) {
      console.log('🔐 Found permission button, clicking to grant access...');
      await permissionButton.first().click();
      await page.waitForTimeout(2000);
    }

    // Now find the record button
    const recordButton = page.locator('[title*="Start Recording"], [title*="microphone"]').first();
    const isRecordButtonVisible = await recordButton.isVisible().catch(() => false);
    
    if (isRecordButtonVisible) {
      const isDisabled = await recordButton.isDisabled();
      console.log(`🎤 Record button found - disabled: ${isDisabled}`);
      
      if (!isDisabled) {
        console.log('🖱️  Clicking record button...');
        await recordButton.click();
        
        // Wait longer to capture all the enhanced debugging logs
        console.log('⏳ Waiting 8 seconds for complete debug output...');
        await page.waitForTimeout(8000);
        
      } else {
        console.log('⚠️  Record button is disabled, checking permission status...');
      }
    } else {
      console.log('❌ Record button not found or not visible');
    }

    // Filter and analyze all the debugging logs
    const debugLogs = consoleMessages.filter(msg => 
      msg.text.includes('[useAudioRecorder]') ||
      msg.text.includes('[RecorderControls]') ||
      msg.text.includes('MediaRecorder') ||
      msg.text.includes('getUserMedia') ||
      msg.text.includes('Full error details') ||
      msg.text.includes('constructor') ||
      msg.text.includes('stream') ||
      msg.type === 'error' ||
      msg.type === 'warn'
    );

    console.log('\n🔍 ENHANCED DEBUG LOG ANALYSIS');
    console.log('==========================================');
    console.log(`Total debug messages captured: ${debugLogs.length}`);
    
    // Group logs by category for easier analysis
    const categories = {
      permissions: debugLogs.filter(log => 
        log.text.toLowerCase().includes('permission') || 
        log.text.toLowerCase().includes('getusermedia')
      ),
      streamValidation: debugLogs.filter(log => 
        log.text.includes('Stream validation') || 
        log.text.includes('getUserMedia returned') ||
        log.text.includes('streamInfo')
      ),
      mediaRecorderCreation: debugLogs.filter(log => 
        log.text.includes('MediaRecorder constructor') ||
        log.text.includes('Attempt') ||
        log.text.includes('config')
      ),
      errors: debugLogs.filter(log => 
        log.type === 'error' || 
        log.text.includes('Full error details') ||
        log.text.includes('failed')
      ),
      events: debugLogs.filter(log => 
        log.text.includes('ONSTART') ||
        log.text.includes('ONSTOP') ||
        log.text.includes('ONERROR')
      )
    };

    // Display each category
    Object.entries(categories).forEach(([category, logs]) => {
      if (logs.length > 0) {
        console.log(`\n📋 ${category.toUpperCase()}:`);
        console.log('-----------------------------------');
        logs.forEach(log => {
          console.log(`[${log.type}] ${log.text}`);
        });
      }
    });

    // Specific analysis
    console.log('\n🎯 DETAILED ANALYSIS:');
    console.log('==========================================');

    const hasGetUserMediaSuccess = categories.streamValidation.some(log => 
      log.text.includes('getUserMedia returned:')
    );
    const hasStreamValidation = categories.streamValidation.some(log => 
      log.text.includes('Stream validation passed')
    );
    const hasMediaRecorderAttempts = categories.mediaRecorderCreation.some(log => 
      log.text.includes('Attempt')
    );
    const hasMediaRecorderSuccess = categories.mediaRecorderCreation.some(log => 
      log.text.includes('constructor succeeded')
    );
    const hasRecordingEvents = categories.events.length > 0;
    const hasErrors = categories.errors.length > 0;

    console.log(`✅ getUserMedia success: ${hasGetUserMediaSuccess}`);
    console.log(`✅ Stream validation passed: ${hasStreamValidation}`);
    console.log(`✅ MediaRecorder creation attempts: ${hasMediaRecorderAttempts}`);
    console.log(`✅ MediaRecorder creation success: ${hasMediaRecorderSuccess}`);
    console.log(`✅ Recording events fired: ${hasRecordingEvents}`);
    console.log(`❌ Errors detected: ${hasErrors}`);

    if (hasErrors) {
      console.log('\n🚨 ERROR DETAILS:');
      categories.errors.forEach(error => {
        console.log(`  - ${error.text}`);
      });
    }

    // Determine the failure point
    console.log('\n🔍 FAILURE POINT ANALYSIS:');
    if (!hasGetUserMediaSuccess) {
      console.log('❌ FAILURE: getUserMedia never succeeded - permission or hardware issue');
    } else if (!hasStreamValidation) {
      console.log('❌ FAILURE: Stream validation failed - invalid stream received');
    } else if (!hasMediaRecorderAttempts) {
      console.log('❌ FAILURE: MediaRecorder creation never attempted - code path issue');
    } else if (!hasMediaRecorderSuccess) {
      console.log('❌ FAILURE: MediaRecorder creation failed - browser compatibility issue');
    } else if (!hasRecordingEvents) {
      console.log('❌ FAILURE: MediaRecorder created but events never fired - recording start issue');
    } else {
      console.log('✅ SUCCESS: All steps completed, recording should work');
    }

    console.log('\n==========================================');
    console.log('🔬 ENHANCED ERROR DEBUGGING COMPLETED');
    console.log('==========================================\n');

    await context.close();

    // Assert that we captured useful debug information
    expect(debugLogs.length).toBeGreaterThan(0);
  });
});