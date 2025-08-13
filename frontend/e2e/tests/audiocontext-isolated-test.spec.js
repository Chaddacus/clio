import { test, expect } from '@playwright/test';

test.describe('AudioContext Isolation Test - MediaRecorder Without AudioContext', () => {
  
  // Set up authentication before the test
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    
    // Fill in login form
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'testpassword123');
    
    // Submit login
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard');
  });

  test('Test MediaRecorder without AudioContext interference', async ({ page, context }) => {
    console.log('Starting AudioContext isolation test with authentication...');
    
    // Grant microphone permissions
    await context.grantPermissions(['microphone']);
    
    // Enhanced console logging to capture all MediaRecorder events
    const consoleMessages = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({
        type: msg.type(),
        text: text,
        timestamp: Date.now()
      });
      console.log(`[BROWSER ${msg.type().toUpperCase()}] ${text}`);
    });

    // Capture any page errors
    const pageErrors = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    // Navigate to recording page
    console.log('Navigating to authenticated recording page...');
    await page.goto('/record');
    
    // Wait for page to load completely
    await page.waitForLoadState('networkidle');
    console.log('Page loaded, waiting for recording interface...');
    
    // Wait for recording interface to be ready
    await page.waitForTimeout(2000);
    
    // Look for the microphone button (should be red circular button)
    await page.waitForSelector('button', { timeout: 10000 });
    console.log('Buttons found on page');
    
    // Count all buttons
    const buttonCount = await page.locator('button').count();
    console.log(`Total buttons found: ${buttonCount}`);
    
    // Look for the record button by finding a button that triggers recording
    let recordButton = null;
    
    // Try to find the microphone button by looking for buttons in the center area
    const buttons = await page.locator('button').all();
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      const buttonClass = await button.getAttribute('class');
      const buttonTitle = await button.getAttribute('title');
      
      console.log(`Button ${i}: class="${buttonClass}", title="${buttonTitle}"`);
      
      // Look for red button or microphone-related button
      if (buttonClass && (buttonClass.includes('bg-red') || buttonClass.includes('microphone')) ||
          buttonTitle && buttonTitle.toLowerCase().includes('record')) {
        recordButton = button;
        console.log(`Found potential record button at index ${i}`);
        break;
      }
    }
    
    // If we can't find it by class/title, try the first button that's not a nav button
    if (!recordButton) {
      // Look for buttons that are likely the record button (larger, circular, etc.)
      const possibleRecordButtons = await page.locator('button').filter({
        hasNot: page.locator('text="Sign in"')
      }).filter({
        hasNot: page.locator('text="Dashboard"')
      }).all();
      
      if (possibleRecordButtons.length > 0) {
        recordButton = possibleRecordButtons[0];
        console.log('Using first non-nav button as record button');
      }
    }
    
    if (!recordButton) {
      console.error('Could not find record button');
      await page.screenshot({ path: 'no-record-button.png', fullPage: true });
      throw new Error('Record button not found');
    }
    
    // Start recording and monitor timing
    const recordingStartTime = Date.now();
    console.log(`Starting recording at timestamp: ${recordingStartTime}`);
    
    await recordButton.click();
    console.log('Clicked record button');
    
    // Wait a moment for recording to initialize
    await page.waitForTimeout(1000);
    
    // Check for recording status
    const recordingStatus = await page.locator('[data-testid="recording-status"]').textContent().catch(() => 'Status not found');
    console.log(`Recording status: ${recordingStatus}`);
    
    // Let recording run for 3 seconds to test duration
    console.log('Letting recording run for 3 seconds...');
    await page.waitForTimeout(3000);
    
    // Look for stop button
    const stopButtons = await page.locator('button').filter({
      hasText: ''
    }).all();
    
    // Try to find the stop button (often gray with stop icon, or look for different state)
    let stopButton = null;
    for (const button of stopButtons) {
      const buttonClass = await button.getAttribute('class');
      const buttonTitle = await button.getAttribute('title');
      
      if (buttonTitle && buttonTitle.toLowerCase().includes('stop') ||
          buttonClass && buttonClass.includes('bg-gray')) {
        stopButton = button;
        break;
      }
    }
    
    // If no specific stop button found, try clicking the record button again (toggle)
    if (!stopButton) {
      stopButton = recordButton;
      console.log('Using record button as stop button (toggle)');
    }
    
    const recordingStopTime = Date.now();
    console.log(`Stopping recording at timestamp: ${recordingStopTime}`);
    console.log(`Total intended recording duration: ${recordingStopTime - recordingStartTime}ms`);
    
    await stopButton.click();
    console.log('Clicked stop button');
    
    // Wait for recording to complete
    await page.waitForTimeout(2000);
    
    // Analyze console messages for MediaRecorder events
    console.log('\n=== CONSOLE LOG ANALYSIS ===');
    const mediaRecorderMessages = consoleMessages.filter(msg => 
      msg.text.includes('MediaRecorder') || 
      msg.text.includes('useAudioRecorder') ||
      msg.text.includes('AudioContext') ||
      msg.text.includes('ONSTART') ||
      msg.text.includes('ONSTOP') ||
      msg.text.includes('ondataavailable')
    );
    
    console.log(`Found ${mediaRecorderMessages.length} MediaRecorder-related messages:`);
    mediaRecorderMessages.forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.type}] ${msg.text}`);
    });
    
    // Look for specific timing issues
    const startEvents = consoleMessages.filter(msg => msg.text.includes('ONSTART'));
    const stopEvents = consoleMessages.filter(msg => msg.text.includes('ONSTOP'));
    const dataEvents = consoleMessages.filter(msg => msg.text.includes('ondataavailable'));
    
    console.log('\n=== TIMING ANALYSIS ===');
    console.log(`Start events: ${startEvents.length}`);
    console.log(`Stop events: ${stopEvents.length}`);
    console.log(`Data events: ${dataEvents.length}`);
    
    if (startEvents.length > 0 && stopEvents.length > 0) {
      const actualRecordingDuration = stopEvents[0].timestamp - startEvents[0].timestamp;
      console.log(`Actual MediaRecorder duration: ${actualRecordingDuration}ms`);
      console.log(`Expected duration: ~3000ms`);
      console.log(`Duration difference: ${Math.abs(actualRecordingDuration - 3000)}ms`);
      
      // Check if we still have the 189ms issue
      if (actualRecordingDuration < 1000) {
        console.log(`🚨 ISSUE DETECTED: Recording stopped prematurely at ${actualRecordingDuration}ms`);
      } else {
        console.log(`✅ SUCCESS: Recording duration appears normal (${actualRecordingDuration}ms)`);
      }
    }
    
    // Check for AudioContext messages
    const audioContextMessages = consoleMessages.filter(msg => 
      msg.text.toLowerCase().includes('audiocontext')
    );
    console.log(`\nAudioContext messages: ${audioContextMessages.length}`);
    audioContextMessages.forEach(msg => {
      console.log(`  - ${msg.text}`);
    });
    
    // Check for debug messages about AudioContext being disabled
    const disabledMessages = consoleMessages.filter(msg => 
      msg.text.includes('DISABLED') || 
      msg.text.includes('Skipping AudioContext') ||
      msg.text.includes('testing without AudioContext')
    );
    console.log(`\nAudioContext disabled messages: ${disabledMessages.length}`);
    disabledMessages.forEach(msg => {
      console.log(`  - ${msg.text}`);
    });
    
    // Final assessment
    console.log('\n=== FINAL ASSESSMENT ===');
    if (pageErrors.length > 0) {
      console.log(`❌ Page errors detected: ${pageErrors.length}`);
      pageErrors.forEach(error => console.log(`  - ${error}`));
    } else {
      console.log('✅ No page errors detected');
    }
    
    // Check if recording seems to be working without early termination
    const hasEarlyStop = stopEvents.length > 0 && startEvents.length > 0 && 
                        (stopEvents[0].timestamp - startEvents[0].timestamp) < 1000;
    
    if (hasEarlyStop) {
      console.log('❌ RESULT: MediaRecorder still stopping prematurely - AudioContext may not have been the cause');
    } else if (startEvents.length > 0) {
      console.log('✅ RESULT: MediaRecorder appears to be running for appropriate duration - AudioContext may have been causing interference');
    } else {
      console.log('⚠️ RESULT: No MediaRecorder events captured - may need to check recording initiation');
    }
    
    // Save all console messages to a file for further analysis
    console.log('\n=== SAVING DETAILED LOGS ===');
    const logData = {
      testTimestamp: Date.now(),
      totalMessages: consoleMessages.length,
      mediaRecorderMessages,
      audioContextMessages,
      disabledMessages,
      startEvents,
      stopEvents,
      dataEvents,
      pageErrors,
      allMessages: consoleMessages
    };
    
    // Basic assertions
    expect(pageErrors.length).toBe(0);
    expect(buttonCount).toBeGreaterThan(0);
  });
});