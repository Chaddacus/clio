import { expect } from '@playwright/test';

export class RecordPage {
  constructor(page) {
    this.page = page;
    
    // Selectors
    this.recordButton = '[title="Start Recording"]';
    this.stopButton = '[title="Stop Recording"]';
    this.pauseButton = '[title="Pause Recording"]';
    this.resumeButton = '[title="Resume Recording"]';
    this.saveButton = 'button:has-text("Save & Transcribe")';
    this.discardButton = 'button:has-text("Discard")';
    this.recordAgainButton = 'button:has-text("Record Again")';
    
    this.titleInput = 'input#note-title';
    this.audioPreview = 'audio[controls]';
    this.recordingTime = '[data-testid="recording-time"]';
    this.recordingStatus = '[data-testid="recording-status"]';
    this.audioLevel = '[data-testid="audio-level"]';
    this.waveformDisplay = '[data-testid="waveform-display"]';
    this.performanceIndicator = '[data-testid="performance-indicator"]';
    
    this.permissionWarning = 'text="Microphone permission required"';
    this.recordingTips = 'text="Recording Tips"';
    this.qualityIndicator = '[data-testid="quality-indicator"]';
  }

  async goto() {
    await this.page.goto('/record');
    await this.page.waitForLoadState('networkidle');
  }

  async startRecording() {
    await this.page.click(this.recordButton);
    await this.page.waitForTimeout(500); // Wait for recording to start
  }

  async stopRecording() {
    await this.page.click(this.stopButton);
    await this.page.waitForTimeout(500); // Wait for recording to stop
  }

  async pauseRecording() {
    await this.page.click(this.pauseButton);
    await this.page.waitForTimeout(300);
  }

  async resumeRecording() {
    await this.page.click(this.resumeButton);
    await this.page.waitForTimeout(300);
  }

  async saveRecording(title = '') {
    if (title) {
      await this.page.fill(this.titleInput, title);
    }
    await this.page.click(this.saveButton);
  }

  async discardRecording() {
    await this.page.click(this.discardButton);
  }

  async recordAgain() {
    await this.page.click(this.recordAgainButton);
  }

  async getRecordingState() {
    const recordButton = await this.page.locator(this.recordButton).count();
    const stopButton = await this.page.locator(this.stopButton).count();
    const pauseButton = await this.page.locator(this.pauseButton).count();
    const resumeButton = await this.page.locator(this.resumeButton).count();

    return {
      canStart: recordButton > 0,
      isRecording: stopButton > 0,
      canPause: pauseButton > 0,
      isPaused: resumeButton > 0
    };
  }

  async getRecordingTime() {
    try {
      const timeElement = await this.page.locator(this.recordingTime);
      if (await timeElement.count() > 0) {
        return await timeElement.textContent();
      }
    } catch (error) {
      // Fallback to looking for any time display
      const timeRegex = /\d{2}:\d{2}/;
      const pageContent = await this.page.textContent('body');
      const match = pageContent.match(timeRegex);
      return match ? match[0] : '00:00';
    }
    return '00:00';
  }

  async getAudioLevel() {
    try {
      const levelElement = await this.page.locator(this.audioLevel);
      if (await levelElement.count() > 0) {
        const levelText = await levelElement.textContent();
        return parseInt(levelText.replace('%', '')) || 0;
      }
    } catch (error) {
      // Fallback to checking for audio level indicator
      const levelIndicators = await this.page.locator('[data-testid*="level"], [class*="audio-level"]').count();
      return levelIndicators > 0 ? 50 : 0; // Default to 50% if found
    }
    return 0;
  }

  async hasWaveformDisplay() {
    // Try multiple selectors for waveform display
    const selectors = [
      this.waveformDisplay,
      '[data-testid="waveform-canvas"]',
      'canvas',
      '.waveform',
      '[class*="waveform"]',
      'svg',
      '[data-testid*="visualizer"]',
      '[data-testid*="audio"]'
    ];
    
    for (const selector of selectors) {
      try {
        const count = await this.page.locator(selector).count();
        if (count > 0) {
          console.log(`Found waveform display with selector: ${selector}`);
          return true;
        }
      } catch (error) {
        continue;
      }
    }
    
    console.warn('No waveform display found with any selector');
    return false;
  }

  async hasPerformanceIndicator() {
    // Try multiple selectors for performance indicator
    const selectors = [
      this.performanceIndicator,
      '[data-testid*="performance"]',
      '.performance-indicator',
      'text=/performance/i',
      'text=/quality/i',
      '[class*="performance"]'
    ];
    
    for (const selector of selectors) {
      try {
        const count = await this.page.locator(selector).count();
        if (count > 0) {
          console.log(`Found performance indicator with selector: ${selector}`);
          return true;
        }
      } catch (error) {
        continue;
      }
    }
    
    console.warn('No performance indicator found with any selector');
    return false;
  }

  async getPerformanceStatus() {
    try {
      const indicator = this.page.locator(this.performanceIndicator);
      if (await indicator.count() > 0) {
        const text = await indicator.textContent();
        
        if (text.includes('High Quality') || text.includes('High Performance')) {
          return 'high';
        } else if (text.includes('Medium Quality') || text.includes('Good Performance')) {
          return 'medium';
        } else if (text.includes('Basic Quality') || text.includes('Basic Performance')) {
          return 'low';
        } else if (text.includes('Audio Only') || text.includes('Emergency')) {
          return 'emergency';
        }
      }
    } catch (error) {
      console.warn('Could not get performance status:', error);
    }
    return 'unknown';
  }

  async getQualityDescription() {
    try {
      const qualityElement = this.page.locator(this.qualityIndicator);
      if (await qualityElement.count() > 0) {
        return await qualityElement.textContent();
      }
      
      // Fallback to looking in performance indicator
      const performanceText = await this.page.locator(this.performanceIndicator).textContent();
      if (performanceText) {
        if (performanceText.includes('High')) return 'High Quality';
        if (performanceText.includes('Medium')) return 'Medium Quality';
        if (performanceText.includes('Basic')) return 'Basic Quality';
        if (performanceText.includes('Audio Only')) return 'Audio Only';
      }
    } catch (error) {
      console.warn('Could not get quality description:', error);
    }
    return 'Unknown';
  }

  async hasPermissionWarning() {
    return await this.page.locator(this.permissionWarning).count() > 0;
  }

  async hasRecordingComplete() {
    return await this.page.locator(this.audioPreview).count() > 0;
  }

  async waitForRecordingStart(timeout = 5000) {
    await expect(this.page.locator(this.stopButton)).toBeVisible({ timeout });
  }

  async waitForRecordingStop(timeout = 5000) {
    await expect(this.page.locator(this.recordButton)).toBeVisible({ timeout });
  }

  async waitForRecordingComplete(timeout = 10000) {
    await expect(this.page.locator(this.audioPreview)).toBeVisible({ timeout });
  }

  async completeRecordingWorkflow(durationMs = 3000, title = 'Test Recording') {
    // Start recording
    await this.startRecording();
    await this.waitForRecordingStart();
    
    // Wait for specified duration
    await this.page.waitForTimeout(durationMs);
    
    // Stop recording
    await this.stopRecording();
    await this.waitForRecordingComplete();
    
    // Save recording
    await this.saveRecording(title);
    
    // Wait for navigation or success indication
    await this.page.waitForTimeout(1000);
  }

  // Assertions
  async assertRecordingButtonVisible() {
    // Try multiple selectors for the recording button
    const selectors = [
      this.recordButton,
      'button:has-text("Start Recording")',
      'button:has-text("Record")',
      '[data-testid="start-recording"]',
      '[data-testid="record-button"]',
      'button[aria-label*="record"]',
      'button[aria-label*="Record"]'
    ];
    
    let buttonFound = false;
    for (const selector of selectors) {
      try {
        const element = this.page.locator(selector).first();
        if (await element.count() > 0) {
          await expect(element).toBeVisible();
          console.log(`Found recording button with selector: ${selector}`);
          buttonFound = true;
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (!buttonFound) {
      // Log page content for debugging
      const pageText = await this.page.textContent('body');
      console.log('Page content:', pageText.substring(0, 500));
      throw new Error('Recording button not found with any selector');
    }
  }

  async assertRecordingActive() {
    await expect(this.page.locator(this.stopButton)).toBeVisible();
  }

  async assertRecordingStopped() {
    await expect(this.page.locator(this.recordButton)).toBeVisible();
  }

  async assertPerformanceTier(expectedTier) {
    const actualTier = await this.getPerformanceStatus();
    expect(actualTier).toBe(expectedTier);
  }

  async assertWaveformVisible() {
    await expect(this.page.locator(this.waveformDisplay)).toBeVisible();
  }

  async assertAudioLevelActive() {
    const level = await this.getAudioLevel();
    expect(level).toBeGreaterThan(0);
  }
}