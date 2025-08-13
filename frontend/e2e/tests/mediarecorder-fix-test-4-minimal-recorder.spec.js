const { test, expect } = require('@playwright/test');

test.describe('MediaRecorder Fix - Test 4: Minimal Recorder', () => {
  test('Recording duration with bare-minimum MediaRecorder implementation', async ({ browser }) => {
    console.log('🎯 TEST 4: Minimal Recorder Implementation Test');
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

    // Navigate to any page - we'll inject our own minimal recorder
    await page.goto('http://localhost:3011/login');
    
    try {
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
    } catch (error) {
      console.log('⚠️ Login completed');
    }

    // Navigate to a simple page where we can inject our test
    await page.goto('http://localhost:3011/record');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 🔧 KEY TEST: INJECT MINIMAL MEDIARECORDER IMPLEMENTATION
    console.log('🔧 INJECTING Minimal MediaRecorder Test...');
    await page.evaluate(() => {
      // Create a completely isolated minimal recorder test
      window.__MINIMAL_RECORDER_TEST = {
        mediaRecorder: null,
        stream: null,
        isRecording: false,
        startTime: null,
        chunks: [],
        
        async start() {
          console.log('[MINIMAL] Starting minimal recorder test...');
          
          try {
            // Get user media with minimal constraints
            console.log('[MINIMAL] Requesting getUserMedia...');
            this.stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              }
            });
            
            console.log('[MINIMAL] getUserMedia successful:', {
              streamId: this.stream.id,
              tracks: this.stream.getAudioTracks().length
            });
            
            // Create MediaRecorder with basic options
            console.log('[MINIMAL] Creating MediaRecorder...');
            this.mediaRecorder = new MediaRecorder(this.stream, {
              mimeType: 'audio/webm;codecs=opus'
            });
            
            console.log('[MINIMAL] MediaRecorder created:', {
              state: this.mediaRecorder.state,
              mimeType: this.mediaRecorder.mimeType
            });
            
            // Set up event handlers
            this.mediaRecorder.onstart = (event) => {
              console.log('[MINIMAL] MediaRecorder ONSTART:', {
                state: this.mediaRecorder.state,
                timestamp: Date.now()
              });
            };
            
            this.mediaRecorder.ondataavailable = (event) => {
              console.log('[MINIMAL] MediaRecorder ONDATAAVAILABLE:', {
                dataSize: event.data.size,
                state: this.mediaRecorder.state,
                chunksTotal: this.chunks.length
              });
              
              if (event.data.size > 0) {
                this.chunks.push(event.data);
              }
            };
            
            this.mediaRecorder.onstop = (event) => {
              const duration = Date.now() - this.startTime;
              console.log('[MINIMAL] MediaRecorder ONSTOP:', {
                state: this.mediaRecorder.state,
                duration: duration + 'ms',
                chunks: this.chunks.length,
                totalSize: this.chunks.reduce((sum, chunk) => sum + chunk.size, 0)
              });
            };
            
            this.mediaRecorder.onerror = (event) => {
              console.error('[MINIMAL] MediaRecorder ERROR:', event.error);
            };
            
            // Start recording
            console.log('[MINIMAL] Starting MediaRecorder...');
            this.startTime = Date.now();
            this.mediaRecorder.start(1000); // 1 second chunks
            this.isRecording = true;
            
            console.log('[MINIMAL] MediaRecorder started, state:', this.mediaRecorder.state);
            
            return true;
            
          } catch (error) {
            console.error('[MINIMAL] Error in minimal recorder:', {
              error: error.message,
              name: error.name,
              stack: error.stack
            });
            return false;
          }
        },
        
        stop() {
          console.log('[MINIMAL] Stopping minimal recorder...');
          if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
          }
          
          if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
          }
        },
        
        getState() {
          return {
            isRecording: this.isRecording,
            mediaRecorderState: this.mediaRecorder ? this.mediaRecorder.state : 'none',
            chunks: this.chunks.length,
            duration: this.startTime ? Date.now() - this.startTime : 0
          };
        }
      };
      
      // Add a visual indicator
      const indicator = document.createElement('div');
      indicator.id = 'minimal-test-indicator';
      indicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff0000;
        color: white;
        padding: 10px;
        border-radius: 5px;
        z-index: 10000;
        font-family: monospace;
      `;
      indicator.innerHTML = 'MINIMAL TEST: Ready to start';
      document.body.appendChild(indicator);
      
      // Add a start button for the test
      const startBtn = document.createElement('button');
      startBtn.id = 'minimal-test-start';
      startBtn.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: #00ff00;
        color: black;
        padding: 10px;
        border: none;
        border-radius: 5px;
        z-index: 10000;
        font-family: monospace;
        cursor: pointer;
      `;
      startBtn.innerHTML = 'START MINIMAL TEST';
      startBtn.onclick = () => {
        console.log('[MINIMAL] Test button clicked');
        window.__MINIMAL_RECORDER_TEST.start();
      };
      document.body.appendChild(startBtn);
      
      console.log('[MINIMAL] Test interface injected');
    });

    // Give the injection time to complete
    await page.waitForTimeout(1000);

    // Clear logs to focus on the minimal test
    logs.length = 0;
    console.log('\n🎤 STARTING MINIMAL MEDIARECORDER TEST...');
    console.log('========================================');

    // Click the minimal test start button
    const startButton = page.locator('#minimal-test-start');
    await expect(startButton).toBeVisible();
    
    const recordingStartTime = Date.now();
    await startButton.click();
    console.log('✅ Minimal test started');

    // Monitor for 15 seconds to see if this minimal implementation works
    const monitorDuration = 15000;
    const checkInterval = 1000;
    
    let recordingStoppedAt = null;
    let lastState = null;
    let maxChunks = 0;
    
    for (let elapsed = 0; elapsed < monitorDuration; elapsed += checkInterval) {
      await page.waitForTimeout(checkInterval);
      
      // Check state via page evaluation
      const state = await page.evaluate(() => {
        return window.__MINIMAL_RECORDER_TEST ? window.__MINIMAL_RECORDER_TEST.getState() : null;
      });
      
      if (state) {
        if (state.chunks > maxChunks) {
          maxChunks = state.chunks;
          console.log(`[+${elapsed}ms] New chunk received. Total: ${state.chunks}, Duration: ${state.duration}ms`);
        }
        
        if (lastState && lastState.mediaRecorderState !== state.mediaRecorderState) {
          console.log(`[+${elapsed}ms] State change: ${lastState.mediaRecorderState} -> ${state.mediaRecorderState}`);
        }
        
        if (state.mediaRecorderState === 'inactive' && lastState && lastState.mediaRecorderState === 'recording') {
          recordingStoppedAt = elapsed;
          console.log(`🚨 MINIMAL TEST: Recording stopped at ${elapsed}ms`);
          break;
        }
        
        lastState = state;
        
        // Regular status update
        if (elapsed % 3000 === 0) {
          console.log(`[+${elapsed}ms] Status: ${state.mediaRecorderState}, Chunks: ${state.chunks}, Duration: ${state.duration}ms`);
        }
      }
      
      // Take screenshots at key moments
      if (elapsed % 5000 === 0) {
        await page.screenshot({ 
          path: `test4-minimal-${elapsed}ms.png`,
          fullPage: true 
        });
      }
    }

    // Final state check
    const finalState = await page.evaluate(() => {
      return window.__MINIMAL_RECORDER_TEST ? window.__MINIMAL_RECORDER_TEST.getState() : null;
    });

    // Stop the test
    await page.evaluate(() => {
      if (window.__MINIMAL_RECORDER_TEST) {
        window.__MINIMAL_RECORDER_TEST.stop();
      }
    });

    // Analysis
    console.log('\n📊 MINIMAL RECORDER TEST RESULTS');
    console.log('=================================');
    
    console.log(`Final state:`, finalState);
    console.log(`Recording stopped at: ${recordingStoppedAt || 'Never'}ms`);
    console.log(`Maximum chunks received: ${maxChunks}`);
    
    const minimalLogs = logs.filter(log => log.text.includes('[MINIMAL]'));
    const startEvents = minimalLogs.filter(log => log.text.includes('ONSTART'));
    const stopEvents = minimalLogs.filter(log => log.text.includes('ONSTOP'));
    const dataEvents = minimalLogs.filter(log => log.text.includes('ONDATAAVAILABLE'));
    const errorEvents = minimalLogs.filter(log => log.text.includes('ERROR'));
    
    console.log(`Start events: ${startEvents.length}`);
    console.log(`Stop events: ${stopEvents.length}`);
    console.log(`Data events: ${dataEvents.length}`);
    console.log(`Error events: ${errorEvents.length}`);
    
    // Determine the result
    if (errorEvents.length > 0) {
      console.log('❌ MINIMAL TEST FAILED: Errors in basic MediaRecorder implementation');
      console.log('   This suggests fundamental browser or permission issues');
    } else if (!recordingStoppedAt) {
      console.log('✅ MINIMAL TEST SUCCESS: Basic MediaRecorder works perfectly!');
      console.log('   This CONFIRMS that complex application features cause the interference');
      console.log('   Performance Manager or related features are the culprits');
    } else if (recordingStoppedAt && recordingStoppedAt < 2000) {
      console.log('❌ MINIMAL TEST FAILED: Even basic implementation stops early');
      console.log('   This suggests the problem is deeper than Performance Manager');
    } else if (recordingStoppedAt && recordingStoppedAt > 10000) {
      console.log('⚠️ MINIMAL TEST PARTIAL: Basic implementation works longer than full app');
      console.log('   This suggests application-level interference');
    } else {
      console.log('⚠️ MINIMAL TEST INCONCLUSIVE: Need to analyze timing patterns');
    }

    // Show key events timeline
    console.log('\n⏰ MINIMAL TEST TIMELINE:');
    minimalLogs.slice(0, 15).forEach(log => {
      console.log(`  [+${log.timestamp}ms] ${log.text}`);
    });

    await context.close();

    // Test assertions
    expect(startEvents.length).toBeGreaterThan(0); // Should have started
    expect(dataEvents.length).toBeGreaterThan(0);  // Should have received data
    
    if (recordingStoppedAt) {
      expect(recordingStoppedAt).toBeGreaterThan(5000); // Should last longer than full app
    } else {
      expect(finalState.mediaRecorderState).toBe('recording'); // Should still be recording
    }
  });
});