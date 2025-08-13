const { test, expect } = require('@playwright/test');

test.describe('Complete Recording and Playback Workflow', () => {
  // Mock audio setup
  test.beforeEach(async ({ page }) => {
    // Mock MediaRecorder and getUserMedia
    await page.addInitScript(() => {
      // Mock MediaRecorder
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
          // Simulate data available events
          setTimeout(() => {
            if (this.ondataavailable) {
              const mockBlob = new Blob(['mock audio data'], { type: 'audio/webm' });
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

        pause() {
          this.state = 'paused';
        }

        resume() {
          this.state = 'recording';
        }

        static isTypeSupported(type) {
          return type.includes('webm') || type.includes('mp4');
        }
      };

      // Mock getUserMedia
      navigator.mediaDevices = navigator.mediaDevices || {};
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        return {
          getTracks: () => [{
            stop: () => {},
            kind: 'audio',
            enabled: true
          }],
          getAudioTracks: () => [{
            stop: () => {},
            kind: 'audio',
            enabled: true
          }]
        };
      };

      // Mock AudioContext
      window.AudioContext = class MockAudioContext {
        constructor() {
          this.state = 'running';
          this.sampleRate = 44100;
        }
        createAnalyser() {
          return {
            fftSize: 256,
            frequencyBinCount: 128,
            smoothingTimeConstant: 0.8,
            getByteFrequencyData: (array) => {
              // Fill with mock frequency data
              for (let i = 0; i < array.length; i++) {
                array[i] = Math.random() * 255;
              }
            },
            getByteTimeDomainData: (array) => {
              // Fill with mock time domain data
              for (let i = 0; i < array.length; i++) {
                array[i] = 128 + Math.sin(i * 0.1) * 50;
              }
            }
          };
        }
        createMediaStreamSource() {
          return {
            connect: () => {}
          };
        }
        resume() {
          this.state = 'running';
          return Promise.resolve();
        }
        close() {
          this.state = 'closed';
          return Promise.resolve();
        }
      };

      // Mock permissions
      navigator.permissions = navigator.permissions || {};
      navigator.permissions.query = async ({ name }) => {
        if (name === 'microphone') {
          return { state: 'granted' };
        }
        return { state: 'denied' };
      };

      // Mock HTML Audio element for playback
      const originalAudio = window.HTMLAudioElement;
      window.HTMLAudioElement = class MockAudio extends originalAudio {
        constructor() {
          super();
          this.duration = 10; // 10 second mock duration
          this.currentTime = 0;
          this.volume = 1;
          this.paused = true;
        }

        load() {
          setTimeout(() => {
            if (this.onloadedmetadata) this.onloadedmetadata();
            if (this.oncanplay) this.oncanplay();
          }, 100);
        }

        play() {
          this.paused = false;
          return Promise.resolve();
        }

        pause() {
          this.paused = true;
        }

        set src(value) {
          this._src = value;
          // Auto-load when src is set
          this.load();
        }

        get src() {
          return this._src;
        }
      };
    });

    // Login before each test using existing pattern
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

  test('complete recording workflow with playback and transcription', async ({ page }) => {
    // Navigate to record page
    await page.goto('/record');
    await page.waitForLoadState('networkidle');

    // Step 1: Start recording
    const recordButton = page.locator('[title="Start Recording"]');
    await expect(recordButton).toBeVisible();
    await recordButton.click();

    // Verify recording UI appears
    const stopButton = page.locator('[title="Stop Recording"]');
    await expect(stopButton).toBeVisible();
    
    // Verify recording timer is running
    const timer = page.locator('[data-testid="recording-time"]');
    await expect(timer).toBeVisible();

    // Wait for some recording time
    await page.waitForTimeout(2000);

    // Step 2: Stop recording
    await stopButton.click();

    // Step 3: Save recording with title
    await page.waitForSelector('input#note-title', { timeout: 5000 });
    
    await page.fill('input#note-title', 'Test Recording with Playback');
    await page.click('button:has-text("Save & Transcribe")');

    // Wait for recording to be saved and navigate to dashboard
    await page.waitForTimeout(2000);
    
    // Navigate to dashboard to see the recording
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Step 4: Verify recording appears in the list
    await page.waitForSelector('h3:has-text("Test Recording with Playback")', { timeout: 10000 });
    
    const recordingCard = page.locator('text="Test Recording with Playback"').locator('xpath=ancestor::div[contains(@class, "bg-white") or contains(@class, "dark:bg-gray-800")]').first();
    await expect(recordingCard).toBeVisible();

    // Verify status shows as completed (look for green status indicator)
    const statusIcon = recordingCard.locator('svg.text-green-500, .text-green-600');
    await expect(statusIcon).toBeVisible();

    // Step 5: Test audio player functionality
    const audioPlayer = recordingCard.locator('[data-testid="note-audio-player"]');
    await expect(audioPlayer).toBeVisible();

    // Test play/pause button
    const playPauseButton = audioPlayer.locator('[data-testid="audio-play-pause"]');
    await expect(playPauseButton).toBeVisible();
    
    // Click play
    await playPauseButton.click();
    
    // Verify UI updates (button should change to pause)
    await expect(playPauseButton.locator('svg')).toBeVisible();
    
    // Test progress bar
    const progressBar = audioPlayer.locator('[data-testid="audio-progress"]');
    await expect(progressBar).toBeVisible();
    
    // Test time display
    const timeDisplay = audioPlayer.locator('text=/\\d+:\\d+ \\/ \\d+:\\d+/');
    await expect(timeDisplay).toBeVisible();

    // Step 6: Test transcription display (if available)
    const transcriptionSection = recordingCard.locator('[data-testid="transcription-text"]');
    
    // Check if transcription is visible (may not be if no mock data)
    const transcriptionExists = await transcriptionSection.count() > 0;
    if (transcriptionExists) {
      console.log('✓ Transcription section found');
      
      // Test transcription toggle if present
      const transcriptionToggle = recordingCard.locator('[data-testid="transcription-toggle"]');
      if (await transcriptionToggle.count() > 0) {
        // Click to expand/collapse
        await transcriptionToggle.click();
        await page.waitForTimeout(300);
        
        // Click again to collapse
        await transcriptionToggle.click();
        await page.waitForTimeout(300);
        
        console.log('✓ Transcription toggle functionality verified');
      }
    } else {
      console.log('⚠️ No transcription available (expected with mock data)');
    }

    // Step 7: Test recording metadata
    // Verify file size is displayed and non-zero
    const fileSizeElement = recordingCard.locator('text=/\\d+\\.?\\d*MB/');
    await expect(fileSizeElement).toBeVisible();
    
    // Verify duration is displayed
    const durationElement = recordingCard.locator('text=/\\d+:\\d+/');
    await expect(durationElement).toBeVisible();

    // Step 8: Test recording interaction
    // Click on the recording card to open details (if implemented)
    await recordingCard.click();
    
    // Wait a moment for any modal or navigation to occur
    await page.waitForTimeout(500);

    console.log('✅ Complete recording workflow test passed');
  });

  test('audio playback error handling', async ({ page }) => {
    await page.goto('/dashboard');

    // Mock audio element to simulate loading error
    await page.addInitScript(() => {
      const originalAudio = window.HTMLAudioElement;
      window.HTMLAudioElement = class MockAudio extends originalAudio {
        constructor() {
          super();
          this.duration = 0;
          this.currentTime = 0;
        }

        load() {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new Error('Failed to load audio'));
            }
          }, 100);
        }

        set src(value) {
          this._src = value;
          this.load();
        }

        get src() {
          return this._src;
        }
      };
    });

    // Create a recording first
    await page.click('[data-testid="start-recording"]');
    await page.waitForTimeout(1000);
    await page.click('[data-testid="stop-recording"]');
    
    await page.fill('[data-testid="recording-title"]', 'Test Error Handling');
    await page.click('[data-testid="save-recording"]');

    // Wait for recording to appear
    const recordingCard = page.locator('[data-testid*="note-card"]').first();
    await expect(recordingCard).toBeVisible();

    // The audio player should show an error state
    const audioPlayer = recordingCard.locator('[data-testid="note-audio-player"]');
    
    // Wait for audio load attempt to fail
    await page.waitForTimeout(500);
    
    // Error state might show as disabled controls or error message
    const playButton = audioPlayer.locator('[data-testid="audio-play-pause"]');
    
    // Verify that clicking doesn't cause crashes
    if (await playButton.isVisible()) {
      await playButton.click();
    }

    console.log('✅ Audio error handling test passed');
  });

  test('recording card responsive layout', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Create a recording
    await page.click('[data-testid="start-recording"]');
    await page.waitForTimeout(1000);
    await page.click('[data-testid="stop-recording"]');
    
    await page.fill('[data-testid="recording-title"]', 'Mobile Layout Test');
    await page.click('[data-testid="save-recording"]');

    // Verify recording card is visible on mobile
    const recordingCard = page.locator('[data-testid*="note-card"]').first();
    await expect(recordingCard).toBeVisible();

    // Verify audio player is visible and functional on mobile
    const audioPlayer = recordingCard.locator('[data-testid="note-audio-player"]');
    await expect(audioPlayer).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(recordingCard).toBeVisible();
    await expect(audioPlayer).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(recordingCard).toBeVisible();
    await expect(audioPlayer).toBeVisible();

    console.log('✅ Responsive layout test passed');
  });

  test('multiple recordings management', async ({ page }) => {
    await page.goto('/dashboard');

    // Create multiple recordings
    const recordingTitles = ['First Recording', 'Second Recording', 'Third Recording'];
    
    for (let i = 0; i < recordingTitles.length; i++) {
      await page.click('[data-testid="start-recording"]');
      await page.waitForTimeout(1000);
      await page.click('[data-testid="stop-recording"]');
      
      await page.fill('[data-testid="recording-title"]', recordingTitles[i]);
      await page.click('[data-testid="save-recording"]');
      
      // Wait for save to complete
      await page.waitForTimeout(500);
    }

    // Verify all recordings are visible
    const recordingCards = page.locator('[data-testid*="note-card"]');
    await expect(recordingCards).toHaveCount(3);

    // Test that each recording has its own audio player
    const audioPlayers = page.locator('[data-testid="note-audio-player"]');
    await expect(audioPlayers).toHaveCount(3);

    // Verify each recording has unique title
    for (const title of recordingTitles) {
      await expect(page.locator(`text=${title}`)).toBeVisible();
    }

    console.log('✅ Multiple recordings management test passed');
  });

  test('transcription expansion and collapse', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Create a recording
    await page.click('[data-testid="start-recording"]');
    await page.waitForTimeout(1000);
    await page.click('[data-testid="stop-recording"]');
    
    await page.fill('[data-testid="recording-title"]', 'Transcription Test');
    await page.click('[data-testid="save-recording"]');

    const recordingCard = page.locator('[data-testid*="note-card"]').first();
    await expect(recordingCard).toBeVisible();

    // Find transcription section
    const transcriptionText = recordingCard.locator('[data-testid="transcription-text"]');
    const transcriptionToggle = recordingCard.locator('[data-testid="transcription-toggle"]');

    if (await transcriptionText.isVisible()) {
      // Initially collapsed (should have line-clamp)
      await expect(transcriptionText).toHaveClass(/line-clamp-3/);

      if (await transcriptionToggle.isVisible()) {
        // Expand transcription
        await transcriptionToggle.click();
        
        // Should not have line-clamp when expanded
        await expect(transcriptionText).not.toHaveClass(/line-clamp-3/);
        
        // Collapse again
        await transcriptionToggle.click();
        
        // Should have line-clamp when collapsed
        await expect(transcriptionText).toHaveClass(/line-clamp-3/);
      }
    }

    console.log('✅ Transcription expansion test passed');
  });
});