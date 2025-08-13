const { test, expect } = require('@playwright/test');

test.describe('MediaRecorder Fix - Test 2: Delayed Performance Monitoring', () => {
  test('Recording duration with delayed Performance Manager startup', async ({ browser }) => {
    console.log('🎯 TEST 2: Delayed Performance Monitoring Test');
    console.log('==============================================');
    
    const context = await browser.newContext({
      permissions: ['microphone'],
    });
    const page = await context.newPage();

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

    // Navigate and authenticate
    await page.goto('http://localhost:3011/login');
    
    try {
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
    } catch (error) {
      console.log('⚠️ Login completed');
    }

    await page.goto('http://localhost:3011/record');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 🔧 KEY TEST: DELAY PERFORMANCE MONITORING BY 10 SECONDS
    console.log('🔧 DELAYING Performance Management by 10 seconds...');
    await page.evaluate(() => {
      window.__DELAY_PERFORMANCE_START = 10000; // 10 second delay
      
      // Monkey patch usePerformanceManager to delay autoStart
      if (window.usePerformanceManager) {
        const originalHook = window.usePerformanceManager;
        window.usePerformanceManager = (options = {}) => {
          console.log('[TEST] usePerformanceManager intercepted with delay');
          
          const manager = originalHook({ ...options, autoStart: false });
          
          // Delay the start of monitoring
          if (options.autoStart !== false) {
            setTimeout(() => {
              console.log('[TEST] Starting delayed performance monitoring...');
              manager.startMonitoring();
            }, window.__DELAY_PERFORMANCE_START || 10000);
          }
          
          return manager;
        };
      }
      
      // Also try to override PerformanceManager class if available
      if (window.PerformanceManager) {
        const OriginalPM = window.PerformanceManager;
        window.PerformanceManager = class DelayedPerformanceManager extends OriginalPM {
          startMonitoring() {
            console.log('[TEST] PerformanceManager.startMonitoring() called with delay');
            setTimeout(() => {
              console.log('[TEST] Actually starting performance monitoring after delay');
              super.startMonitoring();
            }, window.__DELAY_PERFORMANCE_START || 10000);
          }
        };
      }
    });

    // Find record button
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
      console.log('⚠️ Using fallback button');
    }

    const isVisible = await recordButton.isVisible().catch(() => false);
    const isEnabled = isVisible ? await recordButton.isEnabled() : false;
    
    if (!isVisible || !isEnabled) {
      console.log('❌ Cannot test - button not available');
      await context.close();
      return;
    }

    // Clear logs for recording focus
    logs.length = 0;
    console.log('\n🎤 STARTING DELAYED MONITORING TEST...');
    console.log('=====================================');
    
    const recordingStartTime = Date.now();
    await recordButton.click();
    console.log('✅ Record button clicked - Performance monitoring delayed by 10s');

    // Monitor the critical first 12 seconds (before and after perf manager starts)
    const monitorDuration = 12000;
    const checkInterval = 500;
    
    let recordingStoppedAt = null;
    let performanceStartedAt = null;
    let lastState = 'unknown';
    
    for (let elapsed = 0; elapsed < monitorDuration; elapsed += checkInterval) {
      await page.waitForTimeout(checkInterval);
      
      // Check for performance manager activity
      const perfLogs = logs.filter(log => 
        log.text.includes('Starting delayed performance monitoring') ||
        log.text.includes('Actually starting performance monitoring')
      );
      
      if (perfLogs.length > 0 && !performanceStartedAt) {
        performanceStartedAt = elapsed;
        console.log(`⚡ Performance monitoring started at ${elapsed}ms`);
      }
      
      // Check MediaRecorder state
      const mediaLogs = logs.filter(log => 
        log.text.includes('MediaRecorder') && 
        (log.text.includes('ONSTART') || log.text.includes('ONSTOP'))
      );
      
      const hasStarted = mediaLogs.some(log => log.text.includes('ONSTART'));
      const hasStopped = mediaLogs.some(log => log.text.includes('ONSTOP'));
      
      const currentState = hasStarted ? (hasStopped ? 'stopped' : 'recording') : 'pending';
      
      if (currentState !== lastState) {
        console.log(`[+${elapsed}ms] MediaRecorder: ${lastState} -> ${currentState}`);
        lastState = currentState;
      }
      
      if (hasStopped && !recordingStoppedAt) {
        recordingStoppedAt = elapsed;
        console.log(`🚨 Recording STOPPED at ${elapsed}ms`);
        
        if (performanceStartedAt) {
          const timingGap = Math.abs(recordingStoppedAt - performanceStartedAt);
          console.log(`⏱️ Time gap between perf start and recording stop: ${timingGap}ms`);
        }
        
        break;
      }
      
      // Status updates
      if (elapsed % 2000 === 0) {
        console.log(`[+${elapsed}ms] Status: Recording=${currentState}, PerfManager=${performanceStartedAt ? 'started' : 'waiting'}`);
      }
      
      // Screenshot key moments
      if (elapsed === 9000 || elapsed === 11000) { // Just before and after expected perf start
        await page.screenshot({ 
          path: `test2-delayed-${elapsed}ms.png`,
          fullPage: true 
        });
      }
    }

    // Analysis
    console.log('\n📊 DELAYED MONITORING TEST RESULTS');
    console.log('===================================');
    
    console.log(`Performance started at: ${performanceStartedAt || 'Never'}ms`);
    console.log(`Recording stopped at: ${recordingStoppedAt || 'Never'}ms`);
    
    const mediaRecorderLogs = logs.filter(log => log.text.includes('MediaRecorder'));
    const performanceLogs = logs.filter(log => 
      log.text.toLowerCase().includes('performance') || 
      log.text.toLowerCase().includes('monitoring') ||
      log.text.toLowerCase().includes('benchmark')
    );
    
    console.log(`MediaRecorder events: ${mediaRecorderLogs.length}`);
    console.log(`Performance events: ${performanceLogs.length}`);
    
    if (recordingStoppedAt && performanceStartedAt) {
      const correlation = Math.abs(recordingStoppedAt - performanceStartedAt);
      console.log(`Timing correlation: ${correlation}ms`);
      
      if (correlation < 2000) { // Within 2 seconds
        console.log('🔥 STRONG CORRELATION: Performance start correlates with recording stop!');
        console.log('   This confirms Performance Manager interference');
      } else {
        console.log('⚠️ WEAK CORRELATION: Performance start and recording stop are not closely related');
      }
    } else if (!recordingStoppedAt) {
      console.log('✅ SUCCESS: Recording continued throughout delay period!');
      console.log('   This suggests timing-based interference from Performance Manager');
    } else if (recordingStoppedAt && recordingStoppedAt < 9000) {
      console.log('❌ EARLY STOP: Recording stopped before performance manager delay');
      console.log('   This suggests another cause besides performance manager');
    }

    // Show key timeline events
    console.log('\n⏰ TIMELINE:');
    [...mediaRecorderLogs.slice(0, 5), ...performanceLogs.slice(0, 5)]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, 10)
      .forEach(log => {
        console.log(`  [+${log.timestamp}ms] ${log.text}`);
      });

    await context.close();

    // Test assertions
    if (performanceStartedAt && recordingStoppedAt) {
      const correlation = Math.abs(recordingStoppedAt - performanceStartedAt);
      expect(correlation).toBeLessThan(3000); // Should correlate within 3 seconds if it's the cause
    }
    
    expect(logs.some(log => log.text.includes('ONSTART'))).toBe(true);
  });
});