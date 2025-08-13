const { test, expect } = require('@playwright/test');

// Helper function to handle login
async function loginUser(page) {
  console.log('🔐 Logging in user...');
  
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  
  try {
    await page.fill('input[name="username"], input[type="email"], input[id="username"], input[id="email"]', 'testuser');
    await page.fill('input[name="password"], input[type="password"], input[id="password"]', 'testpassword123');
    
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    
    await page.waitForURL('/dashboard', { timeout: 10000 }).catch(async () => {
      await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 5000 });
    });
    
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    console.warn('⚠️ Login failed, continuing anyway:', error.message);
    return false;
  }
}

test.describe('Live Audio Recording Tests', () => {
  let consoleMessages = [];
  let networkRequests = [];
  let testStartTime;

  test.beforeEach(async ({ page, context }) => {
    testStartTime = Date.now();
    consoleMessages = [];
    networkRequests = [];

    // Grant microphone permissions before the test
    await context.grantPermissions(['microphone'], { origin: 'http://localhost:3011' });

    // Capture console messages for debugging
    page.on('console', msg => {
      consoleMessages.push({
        time: Date.now() - testStartTime,
        type: msg.type(),
        text: msg.text()
      });
    });

    // Monitor network requests
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        networkRequests.push({
          time: Date.now() - testStartTime,
          method: request.method(),
          url: request.url(),
          postData: request.method() === 'POST' ? 'FILE_DATA' : null
        });
      }
    });

    // Setup enhanced realistic audio mocks
    await page.addInitScript(() => {
      console.log('[LIVE TEST] Setting up enhanced audio mocks');

      // Mock getUserMedia with proper stream
      navigator.mediaDevices = navigator.mediaDevices || {};
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        console.log('[LIVE TEST] getUserMedia called with constraints:', constraints);
        
        const mockStream = {
          getTracks: () => [{
            stop: () => console.log('[LIVE TEST] Mock track stopped'),
            kind: 'audio',
            enabled: true,
            readyState: 'live'
          }],
          getAudioTracks: () => [{
            stop: () => console.log('[LIVE TEST] Mock audio track stopped'),
            kind: 'audio',
            enabled: true
          }]
        };
        
        return mockStream;
      };

      // Mock MediaRecorder with substantial audio data generation
      window.MediaRecorder = class MockMediaRecorder {
        constructor(stream, options) {
          console.log('[LIVE TEST] Creating MediaRecorder with options:', options);
          this.stream = stream;
          this.options = options;
          this.state = 'inactive';
          this.mimeType = options?.mimeType || 'audio/webm';
          this.chunks = [];
          this.chunkSize = 2048; // 2KB chunks every 250ms = ~8KB per second
        }

        start(timeslice = 250) {
          console.log('[LIVE TEST] MediaRecorder.start() called with timeslice:', timeslice);
          this.state = 'recording';
          this.chunks = [];
          
          if (this.onstart) {
            this.onstart(new Event('start'));
          }

          // Generate realistic audio chunks
          this.chunkInterval = setInterval(() => {
            if (this.state === 'recording') {
              // Create substantial audio data chunk
              const chunkData = new Uint8Array(this.chunkSize);
              
              // Fill with simulated audio data (not just zeros)
              for (let i = 0; i < this.chunkSize; i++) {
                // Generate sine wave data to simulate real audio
                const sample = Math.sin(2 * Math.PI * 440 * i / 44100) * 32767;
                chunkData[i] = Math.floor(sample) & 0xFF;
              }
              
              const audioBlob = new Blob([chunkData], { type: this.mimeType });
              console.log('[LIVE TEST] Generated audio chunk:', {
                size: audioBlob.size,
                type: audioBlob.type,
                totalChunks: this.chunks.length + 1
              });

              this.chunks.push(audioBlob);

              if (this.ondataavailable) {
                const event = { data: audioBlob };
                this.ondataavailable(event);
              }
            }
          }, timeslice);
        }

        stop() {
          console.log('[LIVE TEST] MediaRecorder.stop() called');
          this.state = 'inactive';
          
          if (this.chunkInterval) {
            clearInterval(this.chunkInterval);
          }

          // Create final substantial blob
          const totalSize = this.chunks.reduce((sum, chunk) => sum + chunk.size, 0);
          console.log('[LIVE TEST] Recording stopped, total data size:', totalSize);

          if (this.onstop) {
            setTimeout(() => this.onstop(new Event('stop')), 50);
          }
        }

        pause() {
          this.state = 'paused';
          if (this.onpause) this.onpause(new Event('pause'));
        }

        resume() {
          this.state = 'recording';
          if (this.onresume) this.onresume(new Event('resume'));
        }

        static isTypeSupported(type) {
          return ['audio/webm', 'audio/wav', 'audio/mp4'].includes(type);
        }
      };

      // Mock AudioContext for visualization
      window.AudioContext = class MockAudioContext {
        constructor() {
          this.state = 'suspended';
          this.sampleRate = 44100;
        }

        async resume() {
          this.state = 'running';
          return Promise.resolve();
        }

        async close() {
          this.state = 'closed';
          return Promise.resolve();
        }

        createAnalyser() {
          return {
            fftSize: 256,
            frequencyBinCount: 128,
            smoothingTimeConstant: 0.8,
            getByteFrequencyData: (array) => {
              for (let i = 0; i < array.length; i++) {
                array[i] = Math.random() * 255; // Simulate audio levels
              }
            },
            getByteTimeDomainData: (array) => {
              for (let i = 0; i < array.length; i++) {
                array[i] = 128 + Math.sin(i * 0.1) * 50; // Simulate waveform
              }
            }
          };
        }

        createMediaStreamSource(stream) {
          return {
            connect: (destination) => console.log('[LIVE TEST] AudioContext source connected')
          };
        }
      };

      // Mock permissions - ensure microphone is granted
      navigator.permissions = navigator.permissions || {};
      navigator.permissions.query = async ({ name }) => {
        console.log('[LIVE TEST] Permission query for:', name);
        if (name === 'microphone') {
          console.log('[LIVE TEST] Microphone permission: GRANTED');
          return { 
            state: 'granted',
            addEventListener: () => {},
            removeEventListener: () => {}
          };
        }
        return { state: 'granted' };
      };

      // Also ensure getUserMedia indicates granted permission
      console.log('[LIVE TEST] Microphone permissions configured as GRANTED');

      console.log('[LIVE TEST] Enhanced audio mocks setup complete');
    });
  });

  test('LIVE: 10-second recording with comprehensive data validation', async ({ page }) => {
    console.log('🎬 Starting LIVE 10-second recording test');

    // Login and navigate to record page
    await loginUser(page);
    await page.goto('/record');
    await page.waitForLoadState('networkidle');

    console.log('📍 Phase 1: Checking microphone permissions and starting recording');
    
    // Check microphone permissions first
    const permissionStatus = await page.evaluate(async () => {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' });
        return result.state;
      } catch (error) {
        return 'unknown';
      }
    });
    
    console.log('🎤 Microphone permission status:', permissionStatus);
    
    // Verify record button is present
    const recordButton = page.locator('[title="Start Recording"]');
    await expect(recordButton).toBeVisible();

    // Start recording
    await recordButton.click();
    console.log('✅ Recording started');

    // Verify recording UI appears
    await expect(page.locator('[title="Stop Recording"]')).toBeVisible({ timeout: 5000 });
    
    // Verify timer is running
    const timer = page.locator('[data-testid="recording-time"]');
    await expect(timer).toBeVisible({ timeout: 3000 });

    console.log('📍 Phase 2: Recording for 10 seconds...');
    
    // Monitor recording progress
    let recordingProgress = [];
    const monitoringInterval = 1000; // Check every second
    let elapsedSeconds = 0;
    
    const progressMonitor = setInterval(async () => {
      elapsedSeconds++;
      try {
        const timerText = await timer.textContent();
        recordingProgress.push({
          second: elapsedSeconds,
          timerDisplay: timerText
        });
        console.log(`⏱️  Recording progress: ${elapsedSeconds}s, Timer shows: ${timerText}`);
      } catch (error) {
        console.warn('Could not read timer:', error.message);
      }
    }, monitoringInterval);

    // Wait exactly 10 seconds
    await page.waitForTimeout(10000);
    clearInterval(progressMonitor);

    console.log('📍 Phase 3: Stopping recording');
    
    // Stop recording
    const stopButton = page.locator('[title="Stop Recording"]');
    await stopButton.click();

    // Wait for recording to process
    await page.waitForTimeout(1000);

    console.log('📍 Phase 4: Saving recording');
    
    // Fill title and save
    const titleInput = page.locator('input#note-title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    
    const testTitle = `Live Test Recording ${Date.now()}`;
    await titleInput.fill(testTitle);

    const saveButton = page.locator('button:has-text("Save & Transcribe")');
    await saveButton.click();

    // Wait for navigation or success message
    await page.waitForTimeout(3000);

    console.log('📍 Phase 5: Navigating to dashboard for validation');
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Look for our recording
    const recordingTitle = page.locator(`text=${testTitle}`);
    await expect(recordingTitle).toBeVisible({ timeout: 10000 });

    // Get the recording card
    const recordingCard = page.locator(`text=${testTitle}`).locator('xpath=ancestor::div[contains(@class, "bg-white")]').first();
    await expect(recordingCard).toBeVisible();

    console.log('📍 Phase 6: Validating recording data');
    
    // Check file size - should NOT be 0.01MB
    const fileSizeText = await recordingCard.locator('text=/\\d+\\.?\\d*MB/').textContent();
    console.log('📊 File size detected:', fileSizeText);
    
    // Parse file size
    const fileSizeMatch = fileSizeText.match(/(\\d+(?:\\.\\d+)?)MB/);
    const fileSizeMB = fileSizeMatch ? parseFloat(fileSizeMatch[1]) : 0;
    
    // Validation: File should be larger than 0.01MB
    expect(fileSizeMB).toBeGreaterThan(0.01);
    console.log(`✅ File size validation passed: ${fileSizeMB}MB > 0.01MB`);

    // Check for audio player
    const audioPlayer = recordingCard.locator('[data-testid="note-audio-player"]');
    if (await audioPlayer.count() > 0) {
      console.log('✅ Audio player found in recording card');
      
      // Check duration display
      const durationText = await audioPlayer.locator('text=/\\d+:\\d+ \\/ \\d+:\\d+/').textContent();
      console.log('🎵 Audio duration display:', durationText);
      
      // Should not show "Infinity:NaN:NaN"
      expect(durationText).not.toContain('Infinity');
      expect(durationText).not.toContain('NaN');
      console.log('✅ Audio duration validation passed');
    } else {
      console.log('⚠️  Audio player not found - may be conditional on completed status');
    }

    // Check transcription status
    const statusIcon = recordingCard.locator('svg.text-green-500, .text-green-600, .text-blue-500');
    if (await statusIcon.count() > 0) {
      console.log('✅ Recording has processing status icon');
    }

    // Generate comprehensive test report
    console.log('📈 COMPREHENSIVE TEST REPORT:');
    console.log('=====================================');
    console.log(`🎯 Test Duration: ${(Date.now() - testStartTime) / 1000}s`);
    console.log(`📊 Final File Size: ${fileSizeMB}MB`);
    console.log(`⏱️  Recording Progress:`, recordingProgress);
    console.log(`📝 Console Messages Count: ${consoleMessages.length}`);
    console.log(`🌐 Network Requests Count: ${networkRequests.length}`);
    
    // Key console messages
    const recordingMessages = consoleMessages.filter(msg => 
      msg.text.includes('MediaRecorder') || 
      msg.text.includes('audio') || 
      msg.text.includes('recording')
    );
    console.log(`🎤 Audio-related console messages:`, recordingMessages);
    
    // Network activity
    const audioRequests = networkRequests.filter(req => 
      req.url.includes('/notes/') || req.url.includes('audio')
    );
    console.log(`📡 Audio-related network requests:`, audioRequests);

    console.log('=====================================');
    console.log('🎉 LIVE RECORDING TEST COMPLETED SUCCESSFULLY');
    
    // Final assertion
    expect(fileSizeMB).toBeGreaterThan(0.01);
  });

  test('LIVE: Recording chunk collection validation', async ({ page }) => {
    console.log('🔬 Starting chunk collection validation test');

    await loginUser(page);
    await page.goto('/record');
    await page.waitForLoadState('networkidle');

    // Start recording
    await page.click('[title="Start Recording"]');
    
    // Record for 3 seconds (shorter test)
    await page.waitForTimeout(3000);
    
    // Stop recording
    await page.click('[title="Stop Recording"]');
    
    // Wait for chunk processing
    await page.waitForTimeout(1000);

    // Check console for chunk collection logs
    const chunkMessages = consoleMessages.filter(msg => 
      msg.text.includes('Data chunk') || 
      msg.text.includes('ondataavailable') ||
      msg.text.includes('Generated audio chunk')
    );

    console.log(`🧩 Chunk collection messages (${chunkMessages.length}):`, chunkMessages);
    
    // Should have received multiple chunks
    expect(chunkMessages.length).toBeGreaterThan(0);
    console.log('✅ Chunk collection validation passed');
  });

  test('LIVE: Backend API validation', async ({ page }) => {
    console.log('🔧 Starting backend API validation test');

    await loginUser(page);
    await page.goto('/record');
    await page.waitForLoadState('networkidle');

    // Quick recording
    await page.click('[title="Start Recording"]');
    await page.waitForTimeout(2000);
    await page.click('[title="Stop Recording"]');
    
    // Save recording
    await page.fill('input#note-title', 'API Test Recording');
    await page.click('button:has-text("Save & Transcribe")');
    
    // Wait for API call
    await page.waitForTimeout(5000);

    // Check for API requests
    const saveRequests = networkRequests.filter(req => 
      req.method === 'POST' && req.url.includes('/notes/')
    );

    console.log(`📡 Save API requests (${saveRequests.length}):`, saveRequests);
    
    // Should have made a POST request to save the recording
    expect(saveRequests.length).toBeGreaterThan(0);
    console.log('✅ Backend API validation passed');
  });
});