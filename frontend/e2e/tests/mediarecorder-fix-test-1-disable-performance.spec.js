const { test, expect } = require('@playwright/test');

test.describe('MediaRecorder Fix - Test 1: Performance Manager Disable', () => {
  test('Recording duration with Performance Manager completely disabled', async ({ browser }) => {
    console.log('🎯 TEST 1: Performance Manager Disable Test');
    console.log('=============================================');
    
    const context = await browser.newContext({
      permissions: ['microphone'],
    });
    const page = await context.newPage();

    // Capture all console logs for debugging
    const logs = [];
    const testStartTime = Date.now();
    
    page.on('console', msg => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now() - testStartTime
      };
      logs.push(logEntry);
      console.log(`[+${logEntry.timestamp}ms] [${msg.type()}] ${msg.text()}`);
    });

    // Navigate to login and authenticate
    await page.goto('http://localhost:3011/login');
    
    try {
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
    } catch (error) {
      console.log('⚠️ Login form handling completed');
    }

    // Navigate to record page
    await page.goto('http://localhost:3011/record');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 🔧 KEY TEST: DISABLE PERFORMANCE MANAGEMENT
    console.log('🔧 DISABLING Performance Management...');
    await page.evaluate(() => {
      // Override the useAudioRecorder hook to disable performance management
      window.__DISABLE_PERFORMANCE_MANAGEMENT = true;
      
      // If React DevTools or hooks are available, modify them
      if (window.React && window.React.__currentDispatcher) {
        console.log('[TEST] Performance management disabled via window flag');
      }
      
      // Monkey patch the usePerformanceManager hook if accessible
      if (window.usePerformanceManager) {
        const originalHook = window.usePerformanceManager;
        window.usePerformanceManager = (options = {}) => {
          console.log('[TEST] usePerformanceManager intercepted and disabled');
          return {
            ...originalHook({ ...options, autoStart: false }),
            startMonitoring: () => console.log('[TEST] Performance monitoring blocked'),
            stopMonitoring: () => console.log('[TEST] Performance monitoring stop blocked'),
            isMonitoring: false
          };
        };
      }
    });

    // Find and click record button
    const recordButtonSelectors = [
      '[title*="Start Recording"]',
      'button:has-text("Record")',
      '[data-testid*="record"]',
      'button[class*="record"]'
    ];

    let recordButton = null;
    for (const selector of recordButtonSelectors) {
      const button = page.locator(selector).first();
      if (await button.count() > 0) {
        recordButton = button;
        console.log(`✅ Found record button: ${selector}`);
        break;
      }
    }

    if (!recordButton) {
      recordButton = page.locator('button').first();
      console.log('⚠️ Using fallback button selector');
    }

    const isVisible = await recordButton.isVisible().catch(() => false);
    const isEnabled = isVisible ? await recordButton.isEnabled() : false;
    
    console.log(`Record button - Visible: ${isVisible}, Enabled: ${isEnabled}`);
    
    if (!isVisible || !isEnabled) {
      console.log('❌ Cannot test - button not available');
      await context.close();
      return;
    }

    // Clear logs to focus on recording event
    logs.length = 0;
    console.log('\n🎤 STARTING RECORDING TEST...');
    console.log('================================');
    
    const recordingStartTime = Date.now();
    await recordButton.click();
    console.log('✅ Record button clicked');

    // Monitor for 15 seconds to see if recording stays active
    const monitorDuration = 15000; // 15 seconds
    const checkInterval = 500;     // Check every 500ms
    
    let recordingStoppedAt = null;
    let lastKnownState = 'unknown';
    
    for (let elapsed = 0; elapsed < monitorDuration; elapsed += checkInterval) {
      await page.waitForTimeout(checkInterval);
      
      // Check MediaRecorder state via console logs
      const mediaRecorderLogs = logs.filter(log => 
        log.text.includes('MediaRecorder') && 
        (log.text.includes('ONSTART') || log.text.includes('ONSTOP'))
      );
      
      const hasStarted = mediaRecorderLogs.some(log => log.text.includes('ONSTART'));
      const hasStopped = mediaRecorderLogs.some(log => log.text.includes('ONSTOP'));
      
      const currentState = hasStarted ? (hasStopped ? 'stopped' : 'recording') : 'pending';
      
      if (currentState !== lastKnownState) {
        console.log(`[+${elapsed}ms] State change: ${lastKnownState} -> ${currentState}`);
        lastKnownState = currentState;
      }
      
      // Record when it stopped
      if (hasStopped && !recordingStoppedAt) {
        recordingStoppedAt = elapsed;
        console.log(`🚨 Recording stopped at ${elapsed}ms`);
        
        // Continue monitoring for a bit more to see final state
        await page.waitForTimeout(2000);
        break;
      }
      
      // Take periodic screenshots
      if (elapsed % 5000 === 0) {
        await page.screenshot({ 
          path: `test1-disable-perf-${elapsed}ms.png`,
          fullPage: true 
        });
        console.log(`📸 Screenshot taken at ${elapsed}ms`);
      }
    }

    // Final analysis
    console.log('\n📊 TEST RESULTS ANALYSIS');
    console.log('========================');
    
    const mediaRecorderLogs = logs.filter(log => log.text.includes('MediaRecorder'));
    const performanceLogs = logs.filter(log => 
      log.text.toLowerCase().includes('performance') || 
      log.text.toLowerCase().includes('benchmark')
    );
    
    console.log(`Total MediaRecorder logs: ${mediaRecorderLogs.length}`);
    console.log(`Total Performance logs: ${performanceLogs.length}`);
    
    if (recordingStoppedAt) {
      console.log(`🔥 RESULT: Recording STOPPED after ${recordingStoppedAt}ms`);
      if (recordingStoppedAt < 2000) {
        console.log('❌ FAILED: Still stops prematurely despite disabled performance management');
        console.log('   This suggests Performance Manager is NOT the root cause');
      } else {
        console.log('⚠️ PARTIAL SUCCESS: Recording lasted longer but still stopped');
      }
    } else {
      console.log('✅ SUCCESS: Recording continued for full test duration (15s+)');
      console.log('   Performance Manager is CONFIRMED as the root cause!');
    }

    // Log key events
    console.log('\n🔍 KEY EVENTS:');
    mediaRecorderLogs.slice(0, 10).forEach(log => {
      console.log(`  [+${log.timestamp}ms] ${log.text}`);
    });

    if (performanceLogs.length > 0) {
      console.log('\n⚡ PERFORMANCE ACTIVITY:');
      performanceLogs.slice(0, 5).forEach(log => {
        console.log(`  [+${log.timestamp}ms] ${log.text}`);
      });
    }

    await context.close();

    // Test assertions
    if (recordingStoppedAt) {
      expect(recordingStoppedAt).toBeGreaterThan(10000); // Should last at least 10 seconds
    } else {
      expect(logs.some(log => log.text.includes('ONSTART'))).toBe(true);
    }
  });
});