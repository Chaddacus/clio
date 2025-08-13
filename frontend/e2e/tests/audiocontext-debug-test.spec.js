const { test, expect } = require('@playwright/test');

test.describe('AudioContext Debugging - MediaRecorder Isolation Test', () => {
  test('Test recording functionality without AudioContext interference', async ({ page, context }) => {
    console.log('Starting AudioContext isolation test...');
    
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
    console.log('Navigating to recording page...');
    await page.goto('http://localhost:3011/record');
    
    // Wait for page to load completely
    await page.waitForLoadState('networkidle');
    console.log('Page loaded, looking for record button...');

    // Wait for the microphone button to be visible (it should be a red circular button with microphone icon)
    await page.waitForSelector('button:has(svg)', { timeout: 15000 });
    console.log('Buttons with icons found!');
    
    // Find and click the record button (red background with microphone icon)
    const recordButton = await page.locator('button').filter({ 
      hasText: '' // Empty because it's just an icon
    }).filter({
      has: page.locator('svg') // Has an SVG icon
    }).first();
    
    console.log('Looking for red microphone button...');
    await recordButton.waitFor({ timeout: 10000 });
    console.log('Record button found!');
    
    // Start recording and monitor timing
    const recordingStartTime = Date.now();
    console.log(`Starting recording at timestamp: ${recordingStartTime}`);
    
    await recordButton.click();
    console.log('Clicked start recording button');
    
    // Wait a moment to ensure recording starts
    await page.waitForTimeout(1000);
    
    // Check for recording status text
    const recordingStatus = await page.locator('[data-testid="recording-status"]').textContent();
    console.log(`Recording status: ${recordingStatus}`);
    
    // Let recording run for 3 seconds to test duration
    console.log('Letting recording run for 3 seconds...');
    await page.waitForTimeout(3000);
    
    // Look for stop button (should be gray with stop icon)
    const stopButton = await page.locator('button').filter({
      has: page.locator('svg') // Has stop icon
    }).filter({
      hasText: '' 
    }).last(); // Usually the last button when recording
    
    const recordingStopTime = Date.now();
    console.log(`Stopping recording at timestamp: ${recordingStopTime}`);
    console.log(`Total intended recording duration: ${recordingStopTime - recordingStartTime}ms`);
    
    await stopButton.click();
    console.log('Clicked stop recording button');
    
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
    } else {
      console.log('✅ RESULT: MediaRecorder appears to be running for appropriate duration - AudioContext may have been causing interference');
    }
    
    // Verify basic functionality worked
    expect(pageErrors.length).toBe(0);
    expect(startEvents.length).toBeGreaterThan(0);
  });
});