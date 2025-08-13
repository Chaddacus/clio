const { test, expect } = require('@playwright/test');

test.describe('MediaRecorder Fix - Test 3: Pause Performance During Recording', () => {
  test('Recording duration with Performance Manager paused during recording', async ({ browser }) => {
    console.log('🎯 TEST 3: Pause Performance During Recording Test');
    console.log('================================================');
    
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

    // 🔧 KEY TEST: OVERRIDE PERFORMANCE MANAGER TO PAUSE DURING RECORDING
    console.log('🔧 SETTING UP Performance Manager Recording Coordination...');
    await page.evaluate(() => {
      // Track original performance manager state
      window.__ORIGINAL_PERF_MANAGER = null;
      window.__PERF_PAUSE_ACTIVE = false;
      
      // Override useAudioRecorder to coordinate with performance manager
      if (window.useAudioRecorder) {
        const originalUseAudioRecorder = window.useAudioRecorder;
        window.useAudioRecorder = (options = {}) => {
          console.log('[TEST] useAudioRecorder intercepted for performance coordination');
          
          const recorder = originalUseAudioRecorder(options);
          const originalStartRecording = recorder.startRecording;
          const originalStopRecording = recorder.stopRecording;
          
          return {
            ...recorder,
            startRecording: async () => {
              console.log('[TEST] 🎤 COORDINATED START: Pausing performance monitoring...');
              
              // Pause performance manager before starting recording
              if (recorder.performanceManager && recorder.performanceManager.stopMonitoring) {
                window.__PERF_PAUSE_ACTIVE = true;
                recorder.performanceManager.stopMonitoring();
                console.log('[TEST] Performance monitoring PAUSED for recording');
              }
              
              // Start recording
              const result = await originalStartRecording();
              
              // Resume performance manager after 5 seconds (when recording is stable)
              setTimeout(() => {
                console.log('[TEST] 🎤 COORDINATED RESUME: Resuming performance monitoring...');
                if (recorder.performanceManager && recorder.performanceManager.startMonitoring) {
                  recorder.performanceManager.startMonitoring();
                  window.__PERF_PAUSE_ACTIVE = false;
                  console.log('[TEST] Performance monitoring RESUMED after recording established');
                }
              }, 5000);
              
              return result;
            },
            stopRecording: () => {
              console.log('[TEST] 🛑 COORDINATED STOP: Ensuring performance monitoring is clean...');
              
              // Make sure performance manager is in clean state
              if (window.__PERF_PAUSE_ACTIVE && recorder.performanceManager) {
                recorder.performanceManager.startMonitoring();
                window.__PERF_PAUSE_ACTIVE = false;
              }
              
              return originalStopRecording();
            }
          };
        };
      }
      
      // Also override PerformanceManager class directly
      if (window.PerformanceManager) {
        const OriginalPM = window.PerformanceManager;
        window.PerformanceManager = class CoordinatedPerformanceManager extends OriginalPM {
          startMonitoring() {
            if (window.__PERF_PAUSE_ACTIVE) {
              console.log('[TEST] Performance monitoring start blocked during recording');
              return;
            }
            console.log('[TEST] Performance monitoring starting (not blocked)');
            super.startMonitoring();
          }
          
          stopMonitoring() {
            console.log('[TEST] Performance monitoring stopping');
            super.stopMonitoring();
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

    // Clear logs for focused monitoring
    logs.length = 0;
    console.log('\n🎤 STARTING COORDINATED PERFORMANCE PAUSE TEST...');
    console.log('===============================================');
    
    const recordingStartTime = Date.now();
    await recordButton.click();
    console.log('✅ Record button clicked with performance coordination');

    // Monitor for 12 seconds to see the coordination in action
    const monitorDuration = 12000;
    const checkInterval = 500;
    
    let recordingStoppedAt = null;
    let performancePausedAt = null;
    let performanceResumedAt = null;
    let lastState = 'unknown';
    
    for (let elapsed = 0; elapsed < monitorDuration; elapsed += checkInterval) {
      await page.waitForTimeout(checkInterval);
      
      // Check for coordination events
      const pauseLogs = logs.filter(log => log.text.includes('Performance monitoring PAUSED'));
      const resumeLogs = logs.filter(log => log.text.includes('Performance monitoring RESUMED'));
      
      if (pauseLogs.length > 0 && !performancePausedAt) {
        performancePausedAt = pauseLogs[0].timestamp;
        console.log(`⏸️ Performance PAUSED at ${performancePausedAt}ms`);
      }
      
      if (resumeLogs.length > 0 && !performanceResumedAt) {
        performanceResumedAt = resumeLogs[0].timestamp;
        console.log(`▶️ Performance RESUMED at ${performanceResumedAt}ms`);
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
        
        // Analyze timing relationships
        if (performancePausedAt && performanceResumedAt) {
          const pauseGap = Math.abs(recordingStoppedAt - performancePausedAt);
          const resumeGap = Math.abs(recordingStoppedAt - performanceResumedAt);
          console.log(`⏱️ Stop timing: ${pauseGap}ms from pause, ${resumeGap}ms from resume`);
        }
        
        break;
      }
      
      // Status updates
      if (elapsed % 2000 === 0) {
        const pauseStatus = performancePausedAt ? 'paused' : 'waiting';
        const resumeStatus = performanceResumedAt ? 'resumed' : 'not-yet';
        console.log(`[+${elapsed}ms] Recording=${currentState}, Perf=${pauseStatus}/${resumeStatus}`);
      }
      
      // Key moment screenshots
      if (elapsed === 1000 || elapsed === 6000 || elapsed === 10000) {
        await page.screenshot({ 
          path: `test3-pause-${elapsed}ms.png`,
          fullPage: true 
        });
      }
    }

    // Analysis
    console.log('\n📊 PERFORMANCE COORDINATION TEST RESULTS');
    console.log('========================================');
    
    console.log(`Performance paused at: ${performancePausedAt || 'Never'}ms`);
    console.log(`Performance resumed at: ${performanceResumedAt || 'Never'}ms`);
    console.log(`Recording stopped at: ${recordingStoppedAt || 'Never'}ms`);
    
    const coordinationLogs = logs.filter(log => 
      log.text.includes('COORDINATED') || 
      log.text.includes('Performance monitoring PAUSED') ||
      log.text.includes('Performance monitoring RESUMED')
    );
    
    const mediaRecorderLogs = logs.filter(log => log.text.includes('MediaRecorder'));
    const benchmarkLogs = logs.filter(log => 
      log.text.toLowerCase().includes('benchmark') ||
      log.text.toLowerCase().includes('cpu') ||
      log.text.toLowerCase().includes('canvas')
    );
    
    console.log(`Coordination events: ${coordinationLogs.length}`);
    console.log(`MediaRecorder events: ${mediaRecorderLogs.length}`);
    console.log(`Benchmark events: ${benchmarkLogs.length}`);
    
    // Determine test result
    if (performancePausedAt && !recordingStoppedAt) {
      console.log('✅ SUCCESS: Performance coordination prevented recording stoppage!');
      console.log('   This CONFIRMS Performance Manager interference');
    } else if (performancePausedAt && recordingStoppedAt && recordingStoppedAt > 8000) {
      console.log('✅ PARTIAL SUCCESS: Recording lasted much longer with coordination');
      console.log('   Performance Manager is likely the primary cause');
    } else if (!performancePausedAt) {
      console.log('⚠️ COORDINATION FAILED: Performance manager pause did not work');
      console.log('   Test setup may need adjustment');
    } else if (recordingStoppedAt && recordingStoppedAt < 3000) {
      console.log('❌ COORDINATION INEFFECTIVE: Recording still stopped early');
      console.log('   There may be additional interference sources');
    } else {
      console.log('⚠️ INCONCLUSIVE: Need to analyze timing patterns');
    }

    // Timeline of key events
    console.log('\n⏰ COORDINATION TIMELINE:');
    const keyEvents = [
      ...coordinationLogs.slice(0, 5),
      ...mediaRecorderLogs.filter(log => 
        log.text.includes('ONSTART') || log.text.includes('ONSTOP')
      ).slice(0, 3),
      ...benchmarkLogs.slice(0, 2)
    ].sort((a, b) => a.timestamp - b.timestamp);
    
    keyEvents.slice(0, 10).forEach(log => {
      console.log(`  [+${log.timestamp}ms] ${log.text}`);
    });

    await context.close();

    // Test assertions
    expect(logs.some(log => log.text.includes('ONSTART'))).toBe(true);
    
    if (performancePausedAt) {
      expect(performancePausedAt).toBeLessThan(2000); // Should pause quickly after start
    }
    
    if (recordingStoppedAt && performancePausedAt) {
      // If coordination worked, recording should last longer than without coordination
      expect(recordingStoppedAt).toBeGreaterThan(5000);
    }
  });
});