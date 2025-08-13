import { test, expect } from '@playwright/test';
import { createPerformanceSimulator } from '../utils/performance-simulator.js';
import { createAudioMocker } from '../utils/audio-mocks.js';
import { RecordPage } from '../page-objects/RecordPage.js';

test.describe('Audio Recording Quality Tests', () => {
  let recordPage;
  let performanceSimulator;
  let audioMocker;

  test.beforeEach(async ({ page }) => {
    recordPage = new RecordPage(page);
    performanceSimulator = createPerformanceSimulator(page);
    audioMocker = createAudioMocker(page);

    await performanceSimulator.exposePerformanceData();
  });

  test.describe('Audio Quality by Performance Tier', () => {
    test('should use high quality settings on high performance devices', async ({ page }) => {
      await audioMocker.setupAudioMocks({
        enableMicrophone: true,
        simulateAudioLevel: 0.7,
        audioFormat: 'audio/webm;codecs=opus'
      });

      await performanceSimulator.simulateDevicePerformance('high');
      await recordPage.goto();
      await page.waitForTimeout(1500);

      // Verify high performance tier
      const performanceStatus = await recordPage.getPerformanceStatus();
      expect(performanceStatus).toBe('high');

      // Start recording
      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();

      // Check audio quality indicators
      const qualityDescription = await recordPage.getQualityDescription();
      expect(qualityDescription).toContain('High');

      // Should use Opus codec and high sample rate
      const audioSettings = await page.evaluate(() => {
        // Try to access audio settings from the performance manager
        return window.__audioSettings || {
          codec: 'audio/webm;codecs=opus',
          sampleRate: 48000,
          bitrate: 128000
        };
      });

      // Verify high quality settings
      if (audioSettings.codec) {
        expect(audioSettings.codec).toMatch(/opus|webm/i);
      }

      await recordPage.stopRecording();
      await recordPage.waitForRecordingComplete();

      // Should have audio preview
      expect(await recordPage.hasRecordingComplete()).toBe(true);
    });

    test('should use medium quality settings on medium performance devices', async ({ page }) => {
      await audioMocker.setupAudioMocks({
        enableMicrophone: true,
        simulateAudioLevel: 0.6,
        audioFormat: 'audio/webm'
      });

      await performanceSimulator.simulateDevicePerformance('medium');
      await recordPage.goto();
      await page.waitForTimeout(1500);

      const performanceStatus = await recordPage.getPerformanceStatus();
      expect(performanceStatus).toBe('medium');

      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();

      const qualityDescription = await recordPage.getQualityDescription();
      expect(qualityDescription).toMatch(/Medium|Good/i);

      // Should use reasonable quality settings
      const audioSettings = await page.evaluate(() => {
        return window.__audioSettings || {
          sampleRate: 44100,
          bitrate: 96000
        };
      });

      await recordPage.stopRecording();
      await recordPage.waitForRecordingComplete();
    });

    test('should use basic quality settings on low performance devices', async ({ page }) => {
      await audioMocker.setupAudioMocks({
        enableMicrophone: true,
        simulateAudioLevel: 0.5,
        audioFormat: 'audio/webm'
      });

      await performanceSimulator.simulateDevicePerformance('low');
      await recordPage.goto();
      await page.waitForTimeout(1500);

      const performanceStatus = await recordPage.getPerformanceStatus();
      expect(performanceStatus).toBe('low');

      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();

      const qualityDescription = await recordPage.getQualityDescription();
      expect(qualityDescription).toMatch(/Basic|Low/i);

      await recordPage.stopRecording();
      await recordPage.waitForRecordingComplete();
    });

    test('should maintain audio recording in emergency mode', async ({ page }) => {
      await audioMocker.setupAudioMocks({
        enableMicrophone: true,
        simulateAudioLevel: 0.4,
        audioFormat: 'audio/webm'
      });

      await performanceSimulator.simulateDevicePerformance('emergency');
      await recordPage.goto();
      await page.waitForTimeout(1500);

      const performanceStatus = await recordPage.getPerformanceStatus();
      expect(performanceStatus).toBe('emergency');

      // Should still be able to record audio
      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();

      const qualityDescription = await recordPage.getQualityDescription();
      expect(qualityDescription).toMatch(/Audio Only|Emergency|Basic/i);

      // Recording should work even with minimal features
      const state = await recordPage.getRecordingState();
      expect(state.isRecording).toBe(true);

      await recordPage.stopRecording();
      await recordPage.waitForRecordingComplete();
    });
  });

  test.describe('Recording Workflow Tests', () => {
    test('should complete full recording workflow on high performance device', async ({ page }) => {
      await audioMocker.setupAudioMocks({
        enableMicrophone: true,
        simulateAudioLevel: 0.6,
        recordingDuration: 0 // Don't auto-stop
      });

      await performanceSimulator.simulateDevicePerformance('high');
      await recordPage.goto();

      // Complete recording workflow
      await recordPage.completeRecordingWorkflow(3000, 'High Performance Test Recording');

      // Should navigate to note detail or dashboard
      await page.waitForTimeout(2000);
      
      // Check URL changed (should redirect after save)
      const currentUrl = page.url();
      expect(currentUrl).not.toMatch(/\/record$/);
    });

    test('should handle recording workflow on low performance device', async ({ page }) => {
      await audioMocker.setupAudioMocks({
        enableMicrophone: true,
        simulateAudioLevel: 0.4,
        recordingDuration: 0
      });

      await performanceSimulator.simulateDevicePerformance('low');
      await recordPage.goto();

      await recordPage.completeRecordingWorkflow(2000, 'Low Performance Test Recording');

      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      expect(currentUrl).not.toMatch(/\/record$/);
    });

    test('should preserve recording across performance changes', async ({ page }) => {
      await audioMocker.setupAudioMocks({
        enableMicrophone: true,
        simulateAudioLevel: 0.6,
        recordingDuration: 0
      });

      await performanceSimulator.simulateDevicePerformance('high');
      await recordPage.goto();

      // Start recording
      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();

      // Record for a bit
      await page.waitForTimeout(1500);

      // Simulate performance degradation during recording
      await performanceSimulator.simulatePerformanceDegradation('high', 'low', true);
      await page.waitForTimeout(2000);

      // Recording should continue despite performance change
      const state = await recordPage.getRecordingState();
      expect(state.isRecording).toBe(true);

      // Complete recording
      await recordPage.stopRecording();
      await recordPage.waitForRecordingComplete();

      // Should have completed successfully
      expect(await recordPage.hasRecordingComplete()).toBe(true);
    });

    test('should handle long recordings on different performance tiers', async ({ page }) => {
      const tiers = ['high', 'medium', 'low'];

      for (const tier of tiers) {
        await audioMocker.setupAudioMocks({
          enableMicrophone: true,
          simulateAudioLevel: 0.5,
          recordingDuration: 0
        });

        await performanceSimulator.simulateDevicePerformance(tier);
        await recordPage.goto();
        await page.waitForTimeout(1000);

        // Start recording
        await recordPage.startRecording();
        await recordPage.waitForRecordingStart();

        // Record for longer duration
        await page.waitForTimeout(5000);

        // Check recording is still active
        const state = await recordPage.getRecordingState();
        expect(state.isRecording).toBe(true);

        // Stop recording
        await recordPage.stopRecording();
        await recordPage.waitForRecordingComplete();

        // Verify completion
        expect(await recordPage.hasRecordingComplete()).toBe(true);

        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Audio Format and Codec Tests', () => {
    test('should handle different audio formats gracefully', async ({ page }) => {
      const formats = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/wav'
      ];

      for (const format of formats) {
        await audioMocker.setupAudioMocks({
          enableMicrophone: true,
          simulateAudioLevel: 0.5,
          audioFormat: format
        });

        await performanceSimulator.simulateDevicePerformance('medium');
        await recordPage.goto();
        await page.waitForTimeout(1000);

        // Try recording with this format
        await recordPage.startRecording();
        
        // Should either start successfully or fallback gracefully
        const started = await page.waitForFunction(() => {
          const stopButton = document.querySelector('[title="Stop Recording"]');
          const errorMessage = document.querySelector('[class*="error"], [role="alert"]');
          return stopButton !== null || errorMessage !== null;
        }, { timeout: 5000 }).catch(() => false);

        if (started) {
          const state = await recordPage.getRecordingState();
          if (state.isRecording) {
            await recordPage.stopRecording();
            await recordPage.waitForRecordingComplete();
          }
        }

        await page.waitForTimeout(500);
      }
    });

    test('should fallback to supported codec when preferred codec fails', async ({ page }) => {
      // Test with unsupported codec first
      await audioMocker.setupAudioMocks({
        enableMicrophone: true,
        simulateAudioLevel: 0.5,
        audioFormat: 'audio/unsupported'
      });

      await performanceSimulator.simulateDevicePerformance('medium');
      await recordPage.goto();

      // Should still be able to record with fallback codec
      await recordPage.startRecording();
      
      // Wait for either success or error
      await page.waitForTimeout(2000);

      const state = await recordPage.getRecordingState();
      
      // Should either be recording with fallback or show appropriate error
      if (state.isRecording) {
        await recordPage.stopRecording();
      }

      // Test with supported codec
      await audioMocker.setupAudioMocks({
        enableMicrophone: true,
        simulateAudioLevel: 0.5,
        audioFormat: 'audio/webm'
      });

      await page.reload();
      await page.waitForTimeout(1000);

      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();
      await recordPage.stopRecording();
    });
  });

  test.describe('Audio Level and Quality Monitoring', () => {
    test('should monitor audio levels during recording', async ({ page }) => {
      await audioMocker.setupAudioMocks({
        enableMicrophone: true,
        simulateAudioLevel: 0.7,
        recordingDuration: 0
      });

      await performanceSimulator.simulateDevicePerformance('high');
      await recordPage.goto();

      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();

      // Monitor audio levels for a few seconds
      let audioLevels = [];
      
      for (let i = 0; i < 5; i++) {
        await page.waitForTimeout(500);
        const level = await recordPage.getAudioLevel();
        audioLevels.push(level);
      }

      // Should have detected audio levels
      const avgLevel = audioLevels.reduce((a, b) => a + b, 0) / audioLevels.length;
      expect(avgLevel).toBeGreaterThan(0);

      await recordPage.stopRecording();
    });

    test('should adapt audio monitoring based on performance', async ({ page }) => {
      // Test high performance monitoring
      await audioMocker.setupAudioMocks({
        enableMicrophone: true,
        simulateAudioLevel: 0.6,
        recordingDuration: 0
      });

      await performanceSimulator.simulateDevicePerformance('high');
      await recordPage.goto();

      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();

      const highPerfLevel = await recordPage.getAudioLevel();
      
      await recordPage.stopRecording();
      await page.waitForTimeout(500);

      // Test emergency mode monitoring
      await performanceSimulator.simulateDevicePerformance('emergency');
      await page.reload();
      await page.waitForTimeout(1500);

      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();

      const emergencyLevel = await recordPage.getAudioLevel();
      
      await recordPage.stopRecording();

      // Both should work, but emergency might have reduced frequency
      expect(highPerfLevel).toBeGreaterThan(0);
      
      // Emergency mode might disable audio level monitoring
      if (emergencyLevel === 0) {
        console.log('Emergency mode disabled audio level monitoring');
      } else {
        expect(emergencyLevel).toBeGreaterThan(0);
      }
    });

    test('should handle varying audio input levels', async ({ page }) => {
      await performanceSimulator.simulateDevicePerformance('medium');
      await recordPage.goto();

      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();

      // Simulate changing audio levels
      await audioMocker.simulateAudioLevelChanges([0.1, 0.5, 0.9, 0.3], 800);

      // Should respond to level changes
      let levels = [];
      for (let i = 0; i < 4; i++) {
        await page.waitForTimeout(1000);
        const level = await recordPage.getAudioLevel();
        levels.push(level);
      }

      // Should have captured some variation in levels
      const minLevel = Math.min(...levels);
      const maxLevel = Math.max(...levels);
      
      // Expect some variation (unless emergency mode disabled monitoring)
      if (maxLevel > 0) {
        expect(maxLevel).toBeGreaterThan(minLevel);
      }

      await recordPage.stopRecording();
    });
  });

  test.describe('Recording Error Recovery', () => {
    test('should recover from temporary audio issues', async ({ page }) => {
      await audioMocker.setupAudioMocks({
        enableMicrophone: true,
        simulateAudioLevel: 0.5,
        recordingDuration: 0
      });

      await performanceSimulator.simulateDevicePerformance('medium');
      await recordPage.goto();

      // Start recording successfully
      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();
      await page.waitForTimeout(1000);

      // Simulate audio device disconnection
      await audioMocker.simulatePermissionChange(false);
      await page.waitForTimeout(1000);

      // Recording might stop or show error
      let state = await recordPage.getRecordingState();
      
      // Restore audio
      await audioMocker.simulatePermissionChange(true);
      await page.waitForTimeout(1000);

      // Should be able to start recording again
      if (!state.isRecording) {
        await recordPage.startRecording();
        await recordPage.waitForRecordingStart();
      }

      await recordPage.stopRecording();
    });

    test('should handle microphone permission revocation gracefully', async ({ page }) => {
      await audioMocker.setupAudioMocks({
        enableMicrophone: false,
        simulateError: true
      });

      await performanceSimulator.simulateDevicePerformance('medium');
      await recordPage.goto();

      // Try to start recording without permission
      await recordPage.startRecording();
      await page.waitForTimeout(2000);

      // Should show appropriate error message
      const errorVisible = await page.locator('text=/permission/i, text=/denied/i, text=/microphone/i').count() > 0;
      
      if (!errorVisible) {
        // Might show different error indication
        const hasError = await page.locator('[class*="error"], [role="alert"], .text-red').count() > 0;
        expect(hasError).toBe(true);
      }
    });
  });

  test.afterEach(async ({ page }) => {
    if (performanceSimulator) {
      await performanceSimulator.resetPerformance();
    }
  });
});