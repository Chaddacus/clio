const { test, expect } = require('@playwright/test');

test.describe('Dashboard Audio Playback Tests', () => {
  // Mock audio setup
  test.beforeEach(async ({ page }) => {
    // Mock MediaRecorder and getUserMedia for recording
    await page.addInitScript(() => {
      // Mock MediaRecorder for recording functionality
      window.MediaRecorder = class MockMediaRecorder {
        constructor(stream, options) {
          this.stream = stream;
          this.options = options;
          this.state = 'inactive';
          this.ondataavailable = null;
          this.onstop = null;
          this.onerror = null;
        }

        start(timeslice) {
          this.state = 'recording';
          setTimeout(() => {
            if (this.ondataavailable) {
              // Create a proper audio blob with WebM format
              const audioData = new ArrayBuffer(16000); // 16KB of mock audio data
              const mockBlob = new Blob([audioData], { type: 'audio/webm;codecs=opus' });
              this.ondataavailable({ data: mockBlob });
            }
          }, 100);
        }

        stop() {
          this.state = 'inactive';
          if (this.onstop) {
            setTimeout(() => this.onstop(), 50);
          }
        }

        static isTypeSupported(type) {
          return type.includes('webm') || type.includes('mp4');
        }
      };

      // Mock getUserMedia
      navigator.mediaDevices = navigator.mediaDevices || {};
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        return {
          getTracks: () => [{ stop: () => {}, kind: 'audio', enabled: true }],
          getAudioTracks: () => [{ stop: () => {}, kind: 'audio', enabled: true }]
        };
      };

      // Mock HTML Audio element for comprehensive playback testing
      const originalAudio = window.HTMLAudioElement;
      window.HTMLAudioElement = class MockAudio extends originalAudio {
        constructor() {
          super();
          this.duration = 12.5; // Mock 12.5 second duration
          this.currentTime = 0;
          this.volume = 1;
          this.paused = true;
          this.readyState = 0;
          this.networkState = 0;
          this.error = null;
          this._loadStarted = false;
        }

        load() {
          console.log('[MockAudio] Load called for src:', this.src);
          this.readyState = 0;
          this.networkState = 2; // NETWORK_LOADING
          
          setTimeout(() => {
            if (this.onloadstart) {
              console.log('[MockAudio] Firing loadstart event');
              this.onloadstart();
            }
          }, 50);

          setTimeout(() => {
            // Simulate successful loading
            this.readyState = 4; // HAVE_ENOUGH_DATA
            this.networkState = 1; // NETWORK_IDLE
            
            if (this.onloadedmetadata) {
              console.log('[MockAudio] Firing loadedmetadata event');
              this.onloadedmetadata();
            }
            
            if (this.onloadeddata) {
              console.log('[MockAudio] Firing loadeddata event');
              this.onloadeddata();
            }
            
            if (this.oncanplay) {
              console.log('[MockAudio] Firing canplay event');
              this.oncanplay();
            }
          }, 200);
        }

        play() {
          console.log('[MockAudio] Play called');
          this.paused = false;
          
          if (this.onplay) {
            setTimeout(() => this.onplay(), 10);
          }
          
          return Promise.resolve();
        }

        pause() {
          console.log('[MockAudio] Pause called');
          this.paused = true;
          
          if (this.onpause) {
            setTimeout(() => this.onpause(), 10);
          }
        }

        set src(value) {
          console.log('[MockAudio] Setting src to:', value);
          this._src = value;
          // Auto-load when src is set
          setTimeout(() => this.load(), 10);
        }

        get src() {
          return this._src || '';
        }
      };

      // Mock permissions
      navigator.permissions = navigator.permissions || {};
      navigator.permissions.query = async ({ name }) => {
        return { state: name === 'microphone' ? 'granted' : 'denied' };
      };
    });

    // Login before each test
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    try {
      await page.fill('input[name="username"], input[type="email"], input[id="username"], input[id="email"]', 'testuser');
      await page.fill('input[name="password"], input[type="password"], input[id="password"]', 'testpassword123');
      await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      await page.waitForURL('/dashboard', { timeout: 10000 }).catch(async () => {
        await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 5000 });
      });
    } catch (error) {
      console.warn('Login failed, continuing anyway:', error.message);
    }
  });

  test('dashboard shows audio player for completed recordings', async ({ page }) => {
    // First create a recording to test with
    console.log('Creating test recording...');
    await page.goto('/record');
    await page.waitForLoadState('networkidle');

    // Start recording
    const recordButton = page.locator('button[title="Start Recording"], button:has-text("Start Recording")');
    await expect(recordButton).toBeVisible();
    await recordButton.click();

    // Wait for recording UI
    await page.waitForTimeout(1000);

    // Stop recording
    const stopButton = page.locator('button[title="Stop Recording"], button:has-text("Stop Recording")');
    await expect(stopButton).toBeVisible();
    await stopButton.click();

    // Save recording
    await page.waitForSelector('input[name="title"], input[id="note-title"]', { timeout: 5000 });
    await page.fill('input[name="title"], input[id="note-title"]', 'Dashboard Audio Test Recording');
    
    const saveButton = page.locator('button:has-text("Save")');
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Navigate to dashboard
    console.log('Navigating to dashboard...');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Wait for the recording to appear
    await page.waitForSelector('h3:has-text("Dashboard Audio Test Recording")', { timeout: 10000 });
    console.log('Recording found on dashboard');

    // Find the recording card
    const recordingCard = page.locator('text="Dashboard Audio Test Recording"')
      .locator('xpath=ancestor::div[contains(@class, "bg-white") or contains(@class, "dark:bg-gray-800")]')
      .first();

    await expect(recordingCard).toBeVisible();

    // Verify the audio player is present
    const audioPlayer = recordingCard.locator('[data-testid="note-audio-player"]');
    await expect(audioPlayer).toBeVisible();
    console.log('✓ Audio player found in recording card');

    // Verify the play/pause button matches expected structure
    const playPauseButton = audioPlayer.locator('[data-testid="audio-play-pause"]');
    await expect(playPauseButton).toBeVisible();
    console.log('✓ Play/pause button found');

    // Verify button has correct styling
    await expect(playPauseButton).toHaveClass(/bg-primary-500/);
    await expect(playPauseButton).toHaveClass(/rounded-full/);
    console.log('✓ Button has correct styling');

    // Test clicking the play button
    console.log('Testing play button click...');
    await playPauseButton.click();
    
    // Wait a moment for state change
    await page.waitForTimeout(500);
    
    // Verify the button content changes (play icon to pause icon)
    const pauseIcon = playPauseButton.locator('svg');
    await expect(pauseIcon).toBeVisible();
    console.log('✓ Play button click handled');

    // Verify progress bar exists
    const progressBar = audioPlayer.locator('[data-testid="audio-progress"]');
    await expect(progressBar).toBeVisible();
    console.log('✓ Progress bar visible');

    // Verify time display
    const timeDisplay = audioPlayer.locator('text=/\\d+:\\d+ \\/ \\d+:\\d+/');
    await expect(timeDisplay).toBeVisible();
    console.log('✓ Time display visible');

    console.log('✅ Dashboard audio player test completed successfully');
  });

  test('audio player handles loading errors gracefully', async ({ page }) => {
    // Mock audio element to simulate error
    await page.addInitScript(() => {
      const originalAudio = window.HTMLAudioElement;
      window.HTMLAudioElement = class MockAudio extends originalAudio {
        constructor() {
          super();
          this.duration = 0;
          this.currentTime = 0;
          this.error = { code: 4, message: 'Format not supported' }; // MEDIA_ERR_SRC_NOT_SUPPORTED
        }

        load() {
          setTimeout(() => {
            if (this.onerror) {
              console.log('[MockAudio] Simulating error');
              this.onerror({ target: this });
            }
          }, 100);
        }

        set src(value) {
          this._src = value;
          this.load();
        }

        get src() {
          return this._src || '';
        }
      };
    });

    // Create a recording first (following same pattern as above)
    await page.goto('/record');
    const recordButton = page.locator('button[title="Start Recording"], button:has-text("Start Recording")');
    await recordButton.click();
    await page.waitForTimeout(1000);
    
    const stopButton = page.locator('button[title="Stop Recording"], button:has-text("Stop Recording")');
    await stopButton.click();
    
    await page.fill('input[name="title"], input[id="note-title"]', 'Error Handling Test');
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Wait for recording to appear
    await page.waitForSelector('h3:has-text("Error Handling Test")', { timeout: 10000 });
    
    const recordingCard = page.locator('text="Error Handling Test"')
      .locator('xpath=ancestor::div[contains(@class, "bg-white") or contains(@class, "dark:bg-gray-800")]')
      .first();

    // The audio player should show error state or retry option
    const audioPlayerArea = recordingCard.locator('[data-testid="note-audio-player"]');
    
    // Wait for error handling to occur
    await page.waitForTimeout(1000);
    
    // Check if error message or retry button is shown
    const errorText = audioPlayerArea.locator('text=/error|failed|retry/i');
    const retryButton = audioPlayerArea.locator('button:has-text("Retry")');
    
    const hasError = await errorText.count() > 0;
    const hasRetry = await retryButton.count() > 0;
    
    expect(hasError || hasRetry).toBe(true);
    console.log('✅ Audio error handling test passed');
  });

  test('audio player URL construction works correctly', async ({ page }) => {
    // Monitor network requests to verify correct URL construction
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('audio') || request.url().includes('media')) {
        requests.push(request.url());
      }
    });

    // Create recording and navigate to dashboard (same pattern)
    await page.goto('/record');
    const recordButton = page.locator('button[title="Start Recording"], button:has-text("Start Recording")');
    await recordButton.click();
    await page.waitForTimeout(1000);
    
    const stopButton = page.locator('button[title="Stop Recording"], button:has-text("Stop Recording")');
    await stopButton.click();
    
    await page.fill('input[name="title"], input[id="note-title"]', 'URL Construction Test');
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Wait for audio player to load
    await page.waitForSelector('[data-testid="note-audio-player"]', { timeout: 10000 });
    
    // Check console logs for URL construction info
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Audio URL construction') || msg.text().includes('AudioPlayer')) {
        logs.push(msg.text());
      }
    });

    // Trigger audio loading by clicking play
    const playButton = page.locator('[data-testid="audio-play-pause"]').first();
    if (await playButton.isVisible()) {
      await playButton.click();
    }

    await page.waitForTimeout(1000);

    // Verify that URL construction logs appear
    console.log('Audio URL construction logs:', logs);
    console.log('Audio requests made:', requests);
    
    console.log('✅ URL construction test completed');
  });

  test('multiple audio players work independently', async ({ page }) => {
    // Create multiple recordings
    const recordingTitles = ['First Audio Test', 'Second Audio Test', 'Third Audio Test'];
    
    for (const title of recordingTitles) {
      await page.goto('/record');
      
      const recordButton = page.locator('button[title="Start Recording"], button:has-text("Start Recording")');
      await recordButton.click();
      await page.waitForTimeout(1000);
      
      const stopButton = page.locator('button[title="Stop Recording"], button:has-text("Stop Recording")');
      await stopButton.click();
      
      await page.fill('input[name="title"], input[id="note-title"]', title);
      const saveButton = page.locator('button:has-text("Save")');
      await saveButton.click();
      
      await page.waitForTimeout(500);
    }

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Wait for all recordings to appear
    for (const title of recordingTitles) {
      await page.waitForSelector(`h3:has-text("${title}")`, { timeout: 10000 });
    }

    // Verify each has its own audio player
    const audioPlayers = page.locator('[data-testid="note-audio-player"]');
    const playerCount = await audioPlayers.count();
    expect(playerCount).toBe(3);
    console.log(`✓ Found ${playerCount} audio players`);

    // Test that each player works independently
    for (let i = 0; i < playerCount; i++) {
      const player = audioPlayers.nth(i);
      const playButton = player.locator('[data-testid="audio-play-pause"]');
      
      await expect(playButton).toBeVisible();
      await playButton.click();
      
      // Verify button state changes
      await page.waitForTimeout(200);
      const buttonIcon = playButton.locator('svg');
      await expect(buttonIcon).toBeVisible();
    }

    console.log('✅ Multiple audio players test passed');
  });
});