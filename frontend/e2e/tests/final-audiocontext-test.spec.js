import { test, expect } from '@playwright/test';

test.describe('Final AudioContext Isolation Test', () => {
  let authToken;

  test.beforeAll(async ({ request }) => {
    // Login via API to get auth token
    const response = await request.post('http://localhost:8011/api/auth/login/', {
      data: {
        username: 'testuser',
        password: 'testpassword123'
      }
    });
    
    const responseData = await response.json();
    authToken = responseData.access;
    console.log('Successfully obtained auth token');
  });

  test('Test recording functionality without AudioContext interference', async ({ page, context }) => {
    console.log('Starting comprehensive AudioContext isolation test...');
    
    // Grant microphone permissions
    await context.grantPermissions(['microphone']);
    
    // Add auth token to local storage to simulate login
    await page.goto('http://localhost:3011');
    await page.evaluate((token) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'dummy_refresh');
    }, authToken);

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
    await page.waitForTimeout(3000);
    console.log('Page loaded, analyzing interface...');
    
    // Take a screenshot to see what we have
    await page.screenshot({ path: 'authenticated-record-page.png', fullPage: true });
    
    // Check if we're on the recording page (not redirected to login)
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    // Look for recording interface elements
    const recordingSection = await page.locator('text=Record Voice Note').count();
    console.log(`Recording interface found: ${recordingSection > 0}`);
    
    if (recordingSection === 0) {
      console.log('Recording interface not found, checking for login redirect...');
      const loginForm = await page.locator('input[name="username"]').count();
      if (loginForm > 0) {
        console.log('Redirected to login - filling credentials...');
        await page.fill('input[name="username"]', 'testuser');
        await page.fill('input[name="password"]', 'testpassword123');
        await page.click('button[type="submit"]');
        
        // Wait for redirect and try again
        await page.waitForTimeout(2000);
        await page.goto('http://localhost:3011/record');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
      }
    }
    
    // Now look for recording controls
    const buttons = await page.locator('button').count();
    console.log(`Found ${buttons} buttons on the page`);
    
    // Look for microphone button specifically
    const microphoneButton = await page.locator('button').filter({
      has: page.locator('svg')
    }).first();
    
    let recordingStarted = false;
    let recordingStartTime = 0;
    let recordingStopTime = 0;
    
    try {
      console.log('Attempting to start recording...');
      recordingStartTime = Date.now();
      await microphoneButton.click();
      console.log('Clicked recording button');
      
      // Wait a moment to see if recording starts
      await page.waitForTimeout(2000);
      
      // Check for recording status
      const recordingText = await page.locator('text=/recording/i').count();
      const recordingIndicator = await page.locator('[data-testid="recording-status"]').count();
      
      console.log(`Recording text elements: ${recordingText}`);
      console.log(`Recording status indicator: ${recordingIndicator}`);
      
      if (recordingText > 0 || recordingIndicator > 0) {
        recordingStarted = true;
        console.log('✅ Recording appears to have started');
        
        // Let it record for 3 seconds
        console.log('Recording for 3 seconds...');
        await page.waitForTimeout(3000);
        
        // Try to stop recording
        console.log('Attempting to stop recording...');
        recordingStopTime = Date.now();
        
        // Look for stop button or click the same button again
        const stopButton = await page.locator('button').filter({
          has: page.locator('svg')
        }).filter({
          hasNot: page.locator('text="Start"')
        }).first();
        
        await stopButton.click().catch(async () => {
          // If no specific stop button, try the microphone button again
          await microphoneButton.click();
        });
        
        console.log('Clicked stop recording');
        await page.waitForTimeout(2000);
      } else {
        console.log('⚠️ Recording may not have started properly');
      }
      
    } catch (error) {
      console.log(`Error during recording: ${error.message}`);
    }
    
    // Analyze console messages for MediaRecorder events
    console.log('\n=== DETAILED CONSOLE LOG ANALYSIS ===');
    
    // Filter for different types of messages
    const mediaRecorderMessages = consoleMessages.filter(msg => 
      msg.text.includes('MediaRecorder') || 
      msg.text.includes('useAudioRecorder')
    );
    
    const audioContextMessages = consoleMessages.filter(msg => 
      msg.text.toLowerCase().includes('audiocontext')
    );
    
    const disabledMessages = consoleMessages.filter(msg => 
      msg.text.includes('DISABLED') || 
      msg.text.includes('Skipping AudioContext') ||
      msg.text.includes('testing without AudioContext')
    );
    
    const startEvents = consoleMessages.filter(msg => msg.text.includes('ONSTART'));
    const stopEvents = consoleMessages.filter(msg => msg.text.includes('ONSTOP'));
    const dataEvents = consoleMessages.filter(msg => msg.text.includes('ondataavailable'));
    
    console.log(`MediaRecorder messages: ${mediaRecorderMessages.length}`);
    mediaRecorderMessages.forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.type}] ${msg.text}`);
    });
    
    console.log(`\nAudioContext messages: ${audioContextMessages.length}`);
    audioContextMessages.forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.type}] ${msg.text}`);
    });
    
    console.log(`\nAudioContext disabled messages: ${disabledMessages.length}`);
    disabledMessages.forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.type}] ${msg.text}`);
    });
    
    console.log(`\nMediaRecorder events:`);
    console.log(`- Start events: ${startEvents.length}`);
    console.log(`- Stop events: ${stopEvents.length}`);
    console.log(`- Data events: ${dataEvents.length}`);
    
    // Timing analysis
    if (startEvents.length > 0 && stopEvents.length > 0) {
      const actualRecordingDuration = stopEvents[0].timestamp - startEvents[0].timestamp;
      const expectedDuration = recordingStopTime - recordingStartTime;
      
      console.log(`\n=== TIMING ANALYSIS ===`);
      console.log(`Browser action duration: ${expectedDuration}ms`);
      console.log(`MediaRecorder duration: ${actualRecordingDuration}ms`);
      console.log(`Duration difference: ${Math.abs(actualRecordingDuration - expectedDuration)}ms`);
      
      // Check for the specific 189ms issue
      if (actualRecordingDuration < 1000) {
        console.log(`🚨 ISSUE DETECTED: Recording stopped prematurely at ${actualRecordingDuration}ms`);
        console.log(`This suggests the 189ms issue or similar timing problem persists`);
      } else {
        console.log(`✅ SUCCESS: Recording duration appears normal (${actualRecordingDuration}ms)`);
        console.log(`The 189ms issue appears to be resolved`);
      }
    } else {
      console.log(`\n⚠️ WARNING: Could not capture MediaRecorder start/stop events`);
      console.log(`This might indicate the recording didn't initialize properly`);
    }
    
    // AudioContext analysis
    console.log(`\n=== AUDIOCONTEXT ANALYSIS ===`);
    const hasDisabledMessages = disabledMessages.length > 0;
    const hasAudioContextActivity = audioContextMessages.some(msg => 
      !msg.text.includes('DISABLED') && !msg.text.includes('Skipping')
    );
    
    if (hasDisabledMessages) {
      console.log(`✅ AudioContext is properly disabled - found ${disabledMessages.length} disabled message(s)`);
    } else {
      console.log(`⚠️ No AudioContext disabled messages found`);
    }
    
    if (hasAudioContextActivity) {
      console.log(`⚠️ AudioContext activity detected - this might indicate incomplete disabling`);
    } else {
      console.log(`✅ No unexpected AudioContext activity detected`);
    }
    
    // Final assessment
    console.log(`\n=== FINAL ASSESSMENT ===`);
    console.log(`Page errors: ${pageErrors.length}`);
    console.log(`Recording attempted: ${recordingStarted ? 'Yes' : 'No'}`);
    console.log(`MediaRecorder events captured: ${startEvents.length + stopEvents.length + dataEvents.length}`);
    
    if (pageErrors.length > 0) {
      console.log(`❌ Page errors detected:`);
      pageErrors.forEach(error => console.log(`  - ${error}`));
    }
    
    // Determine if AudioContext was causing the issue
    if (startEvents.length > 0 && stopEvents.length > 0) {
      const duration = stopEvents[0].timestamp - startEvents[0].timestamp;
      if (duration < 1000 && hasDisabledMessages) {
        console.log(`❌ CONCLUSION: AudioContext is disabled but premature stopping still occurs`);
        console.log(`The issue may not be related to AudioContext interference`);
      } else if (duration >= 1000 && hasDisabledMessages) {
        console.log(`✅ CONCLUSION: AudioContext disabling appears to have resolved the timing issue`);
        console.log(`MediaRecorder now runs for proper duration without AudioContext interference`);
      } else {
        console.log(`⚠️ CONCLUSION: Test results are inconclusive`);
      }
    } else {
      console.log(`⚠️ CONCLUSION: Could not determine impact due to lack of MediaRecorder events`);
    }
    
    // Save detailed analysis
    const analysisData = {
      testTimestamp: Date.now(),
      recordingAttempted: recordingStarted,
      browserActionDuration: recordingStopTime - recordingStartTime,
      pageErrors: pageErrors.length,
      totalConsoleMessages: consoleMessages.length,
      mediaRecorderMessages: mediaRecorderMessages.length,
      audioContextMessages: audioContextMessages.length,
      disabledMessages: disabledMessages.length,
      mediaRecorderEvents: {
        start: startEvents.length,
        stop: stopEvents.length,
        data: dataEvents.length
      },
      actualDuration: startEvents.length > 0 && stopEvents.length > 0 ? 
                      stopEvents[0].timestamp - startEvents[0].timestamp : null
    };
    
    console.log(`\nAnalysis data saved:`, JSON.stringify(analysisData, null, 2));
    
    // Basic assertions
    expect(pageErrors.length).toBe(0);
    expect(recordingStarted).toBe(true);
    expect(mediaRecorderMessages.length).toBeGreaterThan(0);
  });
});