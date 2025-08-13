const { test, expect } = require('@playwright/test');

test.describe('Comprehensive MediaRecorder Debugging', () => {
  test('Debug recording start/stop issue with comprehensive analysis', async ({ browser }) => {
    console.log('🔍 Starting comprehensive MediaRecorder debugging session...');

    // Create context with microphone permissions granted
    const context = await browser.newContext({
      permissions: ['microphone'],
    });

    const page = await context.newPage();

    // Enhanced console monitoring with categorization
    const consoleMessages = [];
    const errorMessages = [];
    const networkRequests = [];
    
    // Capture ALL console output with detailed categorization
    page.on('console', msg => {
      const timestamp = Date.now();
      const message = {
        type: msg.type(),
        text: msg.text(),
        timestamp,
        relativeTime: timestamp - testStartTime,
        category: categorizeMessage(msg.text())
      };
      
      consoleMessages.push(message);
      
      // Real-time logging for immediate visibility
      console.log(`[${message.relativeTime}ms] [${msg.type()}] ${msg.text()}`);
    });

    // Capture page errors
    page.on('pageerror', error => {
      const errorInfo = {
        message: error.message,
        stack: error.stack,
        timestamp: Date.now(),
        relativeTime: Date.now() - testStartTime
      };
      errorMessages.push(errorInfo);
      console.log(`[PAGE ERROR] [${errorInfo.relativeTime}ms] ${error.message}`);
    });

    // Monitor network activity
    page.on('request', request => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        timestamp: Date.now(),
        relativeTime: Date.now() - testStartTime
      });
    });

    const testStartTime = Date.now();
    console.log('🎯 Test start time:', testStartTime);

    // PHASE 1: Authentication & Navigation
    console.log('\\n📋 PHASE 1: Authentication & Navigation');
    console.log('==========================================');

    await page.goto('http://localhost:3011/login');
    console.log('✅ Navigated to login page');

    // Take screenshot before login
    await page.screenshot({ path: 'debug-01-login-page.png', fullPage: true });
    
    try {
      // Handle login form
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpassword123');
      console.log('✅ Filled login credentials');
      
      await page.click('button[type="submit"]');
      console.log('✅ Clicked login submit');
      
      // Wait for authentication to complete
      await page.waitForTimeout(3000);
      console.log('✅ Login process completed');
      
    } catch (error) {
      console.log('⚠️ Login form handling completed (might be already authenticated)');
    }

    // Navigate to record page
    await page.goto('http://localhost:3011/record');
    await page.waitForLoadState('networkidle');
    console.log('✅ Navigated to record page');

    // Take screenshot of record page
    await page.screenshot({ path: 'debug-02-record-page.png', fullPage: true });

    // PHASE 2: Initial State Analysis
    console.log('\\n📋 PHASE 2: Initial State Analysis');
    console.log('==========================================');

    // Wait for components to fully initialize
    await page.waitForTimeout(2000);

    // Check for permission prompts
    const permissionButton = page.locator('button:has-text("Allow microphone access")');
    const hasPermissionButton = await permissionButton.count() > 0;
    
    if (hasPermissionButton) {
      console.log('🔐 Permission button found, clicking...');
      await permissionButton.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'debug-03-after-permission.png', fullPage: true });
    } else {
      console.log('✅ No permission button found (likely already granted)');
    }

    // PHASE 3: Recording Button Analysis
    console.log('\\n📋 PHASE 3: Recording Button Analysis');
    console.log('==========================================');

    // Find the record button with multiple selectors
    const recordButtonSelectors = [
      '[title*="Start Recording"]',
      '[title*="microphone"]', 
      'button:has-text("Record")',
      '[data-testid*="record"]',
      'button[class*="record"]'
    ];

    let recordButton = null;
    for (const selector of recordButtonSelectors) {
      const button = page.locator(selector).first();
      if (await button.count() > 0) {
        recordButton = button;
        console.log(`✅ Found record button with selector: ${selector}`);
        break;
      }
    }

    if (!recordButton) {
      // Fallback: look for any button that might be a record button
      recordButton = page.locator('button').first();
      console.log('⚠️ Using fallback button selector');
    }

    const isRecordButtonVisible = await recordButton.isVisible().catch(() => false);
    const isRecordButtonEnabled = isRecordButtonVisible ? await recordButton.isEnabled() : false;
    
    console.log(`Record button - Visible: ${isRecordButtonVisible}, Enabled: ${isRecordButtonEnabled}`);

    // Take screenshot before recording
    await page.screenshot({ path: 'debug-04-before-recording.png', fullPage: true });

    if (isRecordButtonVisible && isRecordButtonEnabled) {
      // PHASE 4: Recording Attempt with Detailed Monitoring
      console.log('\\n📋 PHASE 4: Recording Attempt Analysis');
      console.log('==========================================');

      // Clear previous console messages to focus on recording event
      const preRecordingMessageCount = consoleMessages.length;
      console.log(`Pre-recording console messages: ${preRecordingMessageCount}`);

      // Click the record button and start monitoring
      const recordingStartTime = Date.now();
      console.log(`🎤 Clicking record button at: ${recordingStartTime}`);
      
      await recordButton.click();
      console.log('✅ Record button clicked');

      // Take screenshot immediately after click
      await page.screenshot({ path: 'debug-05-immediately-after-click.png', fullPage: true });

      // Monitor for the next 10 seconds with detailed timing
      const monitoringDuration = 10000; // 10 seconds
      const checkInterval = 500; // Check every 500ms
      
      console.log(`⏱️ Monitoring recording for ${monitoringDuration}ms...`);
      
      for (let elapsed = 0; elapsed < monitoringDuration; elapsed += checkInterval) {
        await page.waitForTimeout(checkInterval);
        
        // Take periodic screenshots to see UI changes
        if (elapsed % 2000 === 0) { // Every 2 seconds
          await page.screenshot({ 
            path: `debug-06-monitoring-${elapsed}ms.png`, 
            fullPage: true 
          });
        }
        
        // Check if recording is still active (look for visual indicators)
        const recordingIndicators = await page.evaluate(() => {
          const indicators = [];
          
          // Check for common recording indicators
          const elements = document.querySelectorAll('*');
          elements.forEach(el => {
            const text = el.textContent || '';
            const classes = el.className || '';
            
            if (text.includes('Recording') || text.includes('recording') ||
                text.includes('Stop') || text.includes('STOP') ||
                classes.includes('recording') || classes.includes('active')) {
              indicators.push({
                text: text.substring(0, 50),
                classes: classes.substring(0, 50),
                tagName: el.tagName
              });
            }
          });
          
          return indicators;
        });
        
        if (elapsed % 2000 === 0 && recordingIndicators.length > 0) {
          console.log(`📊 [${elapsed}ms] Recording indicators found: ${recordingIndicators.length}`);
        }
      }

      // Final screenshot after monitoring period
      await page.screenshot({ path: 'debug-07-after-monitoring.png', fullPage: true });

      // PHASE 5: Detailed Log Analysis
      console.log('\\n📋 PHASE 5: Detailed Log Analysis');
      console.log('==========================================');

      const recordingMessages = consoleMessages.slice(preRecordingMessageCount);
      console.log(`Recording-related messages captured: ${recordingMessages.length}`);

      // Categorize messages for analysis
      const categories = {
        mediaRecorder: recordingMessages.filter(msg => 
          msg.text.includes('MediaRecorder') || 
          msg.text.includes('ONSTART') || 
          msg.text.includes('ONSTOP') ||
          msg.text.includes('ONERROR')
        ),
        audioContext: recordingMessages.filter(msg => 
          msg.text.includes('AudioContext') || 
          msg.text.includes('createMediaStreamSource')
        ),
        getUserMedia: recordingMessages.filter(msg => 
          msg.text.includes('getUserMedia') || 
          msg.text.includes('Stream validation') ||
          msg.text.includes('stream')
        ),
        timing: recordingMessages.filter(msg => 
          msg.text.includes('state after') || 
          msg.text.includes('timing') ||
          msg.text.includes('delay')
        ),
        errors: recordingMessages.filter(msg => 
          msg.type === 'error' || 
          msg.text.includes('error') || 
          msg.text.includes('Error')
        ),
        performance: recordingMessages.filter(msg =>
          msg.text.includes('performance') ||
          msg.text.includes('Quality') ||
          msg.text.includes('monitoring')
        )
      };

      // Detailed analysis of each category
      console.log('\\n🔍 DETAILED CATEGORY ANALYSIS:');
      console.log('=====================================');

      Object.entries(categories).forEach(([category, messages]) => {
        if (messages.length > 0) {
          console.log(`\\n📋 ${category.toUpperCase()}:`);
          console.log('-----------------------------------');
          messages.forEach(msg => {
            console.log(`[+${msg.relativeTime}ms] [${msg.type}] ${msg.text}`);
          });
        } else {
          console.log(`\\n❌ ${category.toUpperCase()}: No messages found`);
        }
      });

      // PHASE 6: Failure Analysis
      console.log('\\n📋 PHASE 6: Failure Point Analysis');
      console.log('==========================================');

      const hasGetUserMediaSuccess = categories.getUserMedia.some(msg => 
        msg.text.includes('getUserMedia returned') || msg.text.includes('Stream validation passed')
      );
      
      const hasMediaRecorderCreated = categories.mediaRecorder.some(msg => 
        msg.text.includes('constructor succeeded') || msg.text.includes('MediaRecorder created')
      );
      
      const hasRecordingStarted = categories.mediaRecorder.some(msg => 
        msg.text.includes('ONSTART')
      );
      
      const hasRecordingStopped = categories.mediaRecorder.some(msg => 
        msg.text.includes('ONSTOP')
      );
      
      const hasRecordingErrors = categories.errors.length > 0;
      
      // Calculate timing metrics
      const startEvents = categories.mediaRecorder.filter(msg => msg.text.includes('ONSTART'));
      const stopEvents = categories.mediaRecorder.filter(msg => msg.text.includes('ONSTOP'));
      
      let recordingDuration = 'Unknown';
      if (startEvents.length > 0 && stopEvents.length > 0) {
        recordingDuration = stopEvents[0].relativeTime - startEvents[0].relativeTime;
      }

      console.log('\\n📊 DIAGNOSTIC SUMMARY:');
      console.log('======================');
      console.log(`✅ getUserMedia Success: ${hasGetUserMediaSuccess}`);
      console.log(`✅ MediaRecorder Created: ${hasMediaRecorderCreated}`);
      console.log(`✅ Recording Started: ${hasRecordingStarted}`);
      console.log(`❌ Recording Stopped: ${hasRecordingStopped}`);
      console.log(`❌ Recording Duration: ${recordingDuration}ms`);
      console.log(`❌ Errors Detected: ${hasRecordingErrors}`);
      
      if (hasRecordingErrors) {
        console.log('\\n🚨 ERROR DETAILS:');
        categories.errors.forEach(error => {
          console.log(`  - [+${error.relativeTime}ms] ${error.text}`);
        });
      }

      // Network activity during recording
      const recordingNetworkActivity = networkRequests.filter(req => 
        req.relativeTime >= recordingStartTime - testStartTime
      );
      
      if (recordingNetworkActivity.length > 0) {
        console.log('\\n🌐 NETWORK ACTIVITY DURING RECORDING:');
        recordingNetworkActivity.forEach(req => {
          console.log(`  - [+${req.relativeTime}ms] ${req.method} ${req.url}`);
        });
      }

      // PHASE 7: Determine Root Cause
      console.log('\\n📋 PHASE 7: Root Cause Analysis');
      console.log('==========================================');
      
      if (!hasGetUserMediaSuccess) {
        console.log('🔥 ROOT CAUSE: getUserMedia failed - permission or hardware issue');
      } else if (!hasMediaRecorderCreated) {
        console.log('🔥 ROOT CAUSE: MediaRecorder creation failed - browser compatibility');
      } else if (!hasRecordingStarted) {
        console.log('🔥 ROOT CAUSE: MediaRecorder.start() never called or failed');
      } else if (hasRecordingStopped && recordingDuration < 2000) {
        console.log(`🔥 ROOT CAUSE: Premature stopping after ${recordingDuration}ms - likely interference`);
        
        // Analyze what happened between start and stop
        const betweenStartStop = recordingMessages.filter(msg => {
          if (startEvents.length > 0 && stopEvents.length > 0) {
            return msg.relativeTime > startEvents[0].relativeTime && 
                   msg.relativeTime < stopEvents[0].relativeTime;
          }
          return false;
        });
        
        if (betweenStartStop.length > 0) {
          console.log('\\n⚡ EVENTS BETWEEN START AND STOP:');
          betweenStartStop.forEach(msg => {
            console.log(`  - [+${msg.relativeTime}ms] ${msg.text}`);
          });
        }
      } else {
        console.log('✅ Recording appears to be working correctly');
      }

    } else {
      console.log('❌ Cannot test recording - button not available or enabled');
    }

    console.log('\\n==========================================');
    console.log('🔬 COMPREHENSIVE DEBUG SESSION COMPLETE');
    console.log('==========================================\\n');

    await context.close();

    // Basic assertion to ensure test runs
    expect(consoleMessages.length).toBeGreaterThan(0);
  });
});

// Helper function to categorize console messages
function categorizeMessage(text) {
  if (text.includes('MediaRecorder') || text.includes('ONSTART') || text.includes('ONSTOP')) {
    return 'mediaRecorder';
  } else if (text.includes('AudioContext')) {
    return 'audioContext';  
  } else if (text.includes('getUserMedia') || text.includes('stream')) {
    return 'getUserMedia';
  } else if (text.includes('performance') || text.includes('Quality')) {
    return 'performance';
  } else if (text.includes('error') || text.includes('Error')) {
    return 'error';
  } else if (text.includes('useAudioRecorder')) {
    return 'recorder';
  }
  return 'general';
}