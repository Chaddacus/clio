const { test, expect } = require('@playwright/test');

test.describe('Recording Debug Tests', () => {
  let consoleMessages = [];
  let debugLogs = [];

  test.beforeEach(async ({ page, context }) => {
    consoleMessages = [];
    debugLogs = [];

    // Grant microphone permissions
    await context.grantPermissions(['microphone'], { origin: 'http://localhost:3011' });

    // Capture console messages
    page.on('console', msg => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      };
      consoleMessages.push(message);
      
      // Capture RecordingDebugger specific logs
      if (message.text.includes('[RecordingDebugger]')) {
        debugLogs.push(message.text);
      }
    });

    // Setup enhanced audio mocks for testing
    await page.addInitScript(() => {
      console.log('[TEST] Setting up audio mocks...');

      // Mock getUserMedia with proper stream
      navigator.mediaDevices = navigator.mediaDevices || {};
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        console.log('[TEST] getUserMedia called with:', constraints);
        
        const mockStream = {
          getTracks: () => [
            {
              stop: () => console.log('[TEST] Mock track stopped'),
              kind: 'audio',
              enabled: true,
              readyState: 'live',
              id: 'mock-audio-track'
            }
          ],
          getAudioTracks: () => [
            {
              stop: () => console.log('[TEST] Mock audio track stopped'),
              kind: 'audio',
              enabled: true,
              readyState: 'live'
            }
          ],
          id: 'mock-stream',
          active: true
        };
        
        return mockStream;
      };

      // Mock MediaRecorder with detailed logging
      window.MediaRecorder = class MockMediaRecorder {
        constructor(stream, options) {
          console.log('[TEST] MockMediaRecorder constructor:', { stream: stream.id, options });
          this.stream = stream;
          this.options = options || {};
          this.state = 'inactive';
          this.mimeType = options?.mimeType || 'audio/webm';
          this.chunks = [];
          
          // Track constructor call
          this.constructorTime = Date.now();
        }

        start(timeslice = 1000) {
          console.log('[TEST] MediaRecorder.start() called:', { 
            timeslice, 
            currentState: this.state,
            mimeType: this.mimeType,
            timeFromConstruction: Date.now() - this.constructorTime
          });
          
          this.state = 'recording';
          
          if (this.onstart) {
            setTimeout(() => {
              console.log('[TEST] Firing onstart event');
              this.onstart(new Event('start'));
            }, 10);
          }

          // Simulate data collection with small delay
          this.dataInterval = setInterval(() => {
            if (this.state === 'recording') {
              const chunkData = new Uint8Array(1024); // 1KB chunks
              
              // Fill with mock audio data
              for (let i = 0; i < 1024; i++) {
                chunkData[i] = Math.floor(Math.random() * 256);
              }
              
              const audioBlob = new Blob([chunkData], { type: this.mimeType });
              
              console.log('[TEST] Generating mock data chunk:', {
                size: audioBlob.size,
                type: audioBlob.type,
                totalChunks: this.chunks.length + 1
              });

              this.chunks.push(audioBlob);

              if (this.ondataavailable) {
                const event = { data: audioBlob };
                setTimeout(() => {
                  console.log('[TEST] Firing ondataavailable event');
                  this.ondataavailable(event);
                }, 5);
              }
            }
          }, timeslice);

          console.log('[TEST] MediaRecorder start setup complete');
        }

        stop() {
          console.log('[TEST] MediaRecorder.stop() called:', {
            currentState: this.state,
            totalChunks: this.chunks.length,
            totalDataSize: this.chunks.reduce((sum, chunk) => sum + chunk.size, 0)
          });
          
          this.state = 'inactive';
          
          if (this.dataInterval) {
            clearInterval(this.dataInterval);
          }

          if (this.onstop) {
            setTimeout(() => {
              console.log('[TEST] Firing onstop event');
              this.onstop(new Event('stop'));
            }, 50);
          }
        }

        pause() {
          console.log('[TEST] MediaRecorder.pause() called');
          this.state = 'paused';
          if (this.onpause) this.onpause(new Event('pause'));
        }

        resume() {
          console.log('[TEST] MediaRecorder.resume() called');
          this.state = 'recording';
          if (this.onresume) this.onresume(new Event('resume'));
        }

        static isTypeSupported(type) {
          const supported = ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg'].includes(type);
          console.log('[TEST] MediaRecorder.isTypeSupported:', { type, supported });
          return supported;
        }
      };

      // Mock permissions
      navigator.permissions = navigator.permissions || {};
      navigator.permissions.query = async ({ name }) => {
        console.log('[TEST] Permission query for:', name);
        if (name === 'microphone') {
          return { 
            state: 'granted',
            addEventListener: () => {},
            removeEventListener: () => {}
          };
        }
        return { state: 'granted' };
      };

      console.log('[TEST] Audio mocks setup complete');
    });

    // Login to the application
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    try {
      await page.fill('input[name="username"], input[type="email"], input[id="username"], input[id="email"]', 'testuser');
      await page.fill('input[name="password"], input[type="password"], input[id="password"]', 'testpassword123');
      await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      await page.waitForURL('/dashboard', { timeout: 10000 }).catch(() => {
        console.log('Login redirect timeout, continuing...');
      });
    } catch (error) {
      console.log('Login process encountered issues, continuing with test...');
    }
  });

  test('Debug recording start/stop issue with detailed logging', async ({ page }) => {
    console.log('🔍 Starting recording debug test...');

    // Navigate to record page
    await page.goto('/record');
    await page.waitForLoadState('networkidle');
    
    console.log('📍 Page loaded, looking for debugger...');

    // Wait for the recording debugger to be present
    await expect(page.locator('h2:has-text("Debug Recording Issue")')).toBeVisible();
    
    // Check if the debugger buttons are present
    const startButton = page.locator('button:has-text("Start Recording")').first();
    const stopButton = page.locator('button:has-text("Stop Recording")').first();
    
    await expect(startButton).toBeVisible();
    await expect(stopButton).toBeVisible();
    
    console.log('✅ Debugger UI elements found');

    // Click start recording button
    console.log('🎤 Clicking Start Recording button...');
    await startButton.click();
    
    // Wait a moment for events to process
    await page.waitForTimeout(2000);
    
    // Check if recording started by looking for button state change
    const isRecordingStarted = await startButton.isDisabled();
    console.log('Recording started?', isRecordingStarted);

    // Wait a bit longer to collect data
    await page.waitForTimeout(3000);
    
    // Try to stop recording
    console.log('🛑 Clicking Stop Recording button...');
    await stopButton.click();
    
    // Wait for stop processing
    await page.waitForTimeout(2000);

    // Capture the debug logs from the UI
    const logContainer = page.locator('.bg-black.text-green-400');
    await expect(logContainer).toBeVisible();
    
    const logText = await logContainer.textContent();
    console.log('📋 Debug logs from UI:', logText);

    // Capture any audio element that might have been created
    const audioElement = page.locator('audio[controls]');
    if (await audioElement.count() > 0) {
      const audioSrc = await audioElement.getAttribute('src');
      console.log('🎵 Audio element created with src:', audioSrc);
    }

    // Generate comprehensive report
    console.log('\n🔍 COMPREHENSIVE DEBUG REPORT');
    console.log('=====================================');
    
    console.log('\n📋 UI Debug Logs:');
    if (logText && logText.length > 20) {
      console.log(logText);
    } else {
      console.log('No debug logs captured from UI');
    }
    
    console.log('\n📝 Console Messages:');
    const testMessages = consoleMessages.filter(msg => 
      msg.text.includes('[TEST]') || 
      msg.text.includes('[RecordingDebugger]') ||
      msg.text.includes('MediaRecorder') ||
      msg.text.includes('getUserMedia') ||
      msg.text.includes('permission')
    );
    
    testMessages.forEach(msg => {
      console.log(`[${msg.type}] ${msg.text}`);
    });

    console.log('\n🎯 Analysis:');
    
    // Analyze the messages for common issues
    const hasPermissionError = consoleMessages.some(msg => 
      msg.text.toLowerCase().includes('permission') && 
      (msg.text.toLowerCase().includes('denied') || msg.text.toLowerCase().includes('error'))
    );
    
    const hasMediaRecorderError = consoleMessages.some(msg =>
      msg.text.includes('MediaRecorder') && msg.type === 'error'
    );
    
    const hasGetUserMediaError = consoleMessages.some(msg =>
      msg.text.includes('getUserMedia') && msg.type === 'error'
    );

    if (hasPermissionError) {
      console.log('❌ ISSUE: Permission denied or permission-related error detected');
    } else {
      console.log('✅ Permissions: No permission errors detected');
    }

    if (hasMediaRecorderError) {
      console.log('❌ ISSUE: MediaRecorder error detected');
    } else {
      console.log('✅ MediaRecorder: No MediaRecorder errors detected');
    }

    if (hasGetUserMediaError) {
      console.log('❌ ISSUE: getUserMedia error detected');
    } else {
      console.log('✅ getUserMedia: No getUserMedia errors detected');
    }

    // Check if we got any mock data
    const hasMockData = consoleMessages.some(msg =>
      msg.text.includes('[TEST]') && msg.text.includes('data chunk')
    );

    if (hasMockData) {
      console.log('✅ Mock Data: Mock audio data was generated successfully');
    } else {
      console.log('❌ ISSUE: No mock audio data was generated - recording may not have started');
    }

    console.log('\n📊 Summary:');
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Test-related messages: ${testMessages.length}`);
    console.log(`Recording debugger messages: ${debugLogs.length}`);
    
    console.log('=====================================');
    console.log('🔬 DEBUG TEST COMPLETED');
    
    // The test passes if we captured debug information
    expect(consoleMessages.length).toBeGreaterThan(0);
  });

  test('Test basic MediaRecorder functionality', async ({ page }) => {
    console.log('🧪 Testing basic MediaRecorder functionality...');
    
    await page.goto('/record');
    await page.waitForLoadState('networkidle');

    // Test MediaRecorder support directly in browser
    const mediaRecorderInfo = await page.evaluate(() => {
      const info = {
        mediaRecorderExists: typeof MediaRecorder !== 'undefined',
        getUserMediaExists: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        supportedMimeTypes: []
      };

      if (typeof MediaRecorder !== 'undefined') {
        const types = ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/mpeg'];
        for (const type of types) {
          if (MediaRecorder.isTypeSupported(type)) {
            info.supportedMimeTypes.push(type);
          }
        }
      }

      return info;
    });

    console.log('🔧 Browser Capabilities:', mediaRecorderInfo);
    
    expect(mediaRecorderInfo.mediaRecorderExists).toBe(true);
    expect(mediaRecorderInfo.getUserMediaExists).toBe(true);
    expect(mediaRecorderInfo.supportedMimeTypes.length).toBeGreaterThan(0);
  });
});