import { test, expect } from '@playwright/test';
import { createPerformanceSimulator, DEVICE_PROFILES } from '../utils/performance-simulator.js';
import { createAudioMocker } from '../utils/audio-mocks.js';
import { RecordPage } from '../page-objects/RecordPage.js';

test.describe('Performance Scaling Tests', () => {
  let recordPage;
  let performanceSimulator;
  let audioMocker;

  test.beforeEach(async ({ page }) => {
    recordPage = new RecordPage(page);
    performanceSimulator = createPerformanceSimulator(page);
    audioMocker = createAudioMocker(page);

    // Setup audio mocks for all tests
    await audioMocker.setupAudioMocks({
      enableMicrophone: true,
      simulateAudioLevel: 0.6,
      recordingDuration: 0 // Don't auto-stop
    });

    // Expose performance data for testing
    await performanceSimulator.exposePerformanceData();
  });

  test.describe('Device Performance Tier Detection', () => {
    test('should detect high performance device', async ({ page }) => {
      // Simulate high performance device
      await performanceSimulator.simulateDevicePerformance('high');
      
      // Navigate to record page
      await recordPage.goto();
      
      // Wait for performance detection
      await page.waitForTimeout(2000);
      
      // Check performance tier
      const performanceStatus = await recordPage.getPerformanceStatus();
      expect(performanceStatus).toBe('high');
      
      // Verify high quality features are enabled
      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();
      
      // Should have waveform visualization
      expect(await recordPage.hasWaveformDisplay()).toBe(true);
      
      // Should have active audio levels
      await recordPage.assertAudioLevelActive();
      
      await recordPage.stopRecording();
    });

    test('should detect medium performance device', async ({ page }) => {
      // Simulate medium performance device
      await performanceSimulator.simulateDevicePerformance('medium');
      
      await recordPage.goto();
      await page.waitForTimeout(2000);
      
      const performanceStatus = await recordPage.getPerformanceStatus();
      expect(performanceStatus).toBe('medium');
      
      // Should still have visualization but with reduced quality
      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();
      
      expect(await recordPage.hasWaveformDisplay()).toBe(true);
      
      await recordPage.stopRecording();
    });

    test('should detect low performance device', async ({ page }) => {
      // Simulate low performance device
      await performanceSimulator.simulateDevicePerformance('low');
      
      await recordPage.goto();
      await page.waitForTimeout(2000);
      
      const performanceStatus = await recordPage.getPerformanceStatus();
      expect(performanceStatus).toBe('low');
      
      // Should have basic visualization only
      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();
      
      // Basic waveform should still be present
      expect(await recordPage.hasWaveformDisplay()).toBe(true);
      
      await recordPage.stopRecording();
    });

    test('should detect emergency mode device', async ({ page }) => {
      // Simulate very low performance device
      await performanceSimulator.simulateDevicePerformance('emergency');
      
      await recordPage.goto();
      await page.waitForTimeout(2000);
      
      const performanceStatus = await recordPage.getPerformanceStatus();
      expect(performanceStatus).toBe('emergency');
      
      // Should disable visualization features
      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();
      
      // Recording should still work but with minimal features
      const state = await recordPage.getRecordingState();
      expect(state.isRecording).toBe(true);
      
      await recordPage.stopRecording();
    });
  });

  test.describe('Dynamic Performance Scaling', () => {
    test('should degrade quality when performance drops', async ({ page }) => {
      // Start with high performance
      await performanceSimulator.simulateDevicePerformance('high');
      await recordPage.goto();
      await page.waitForTimeout(1000);
      
      // Start recording
      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();
      
      // Verify high quality initially
      expect(await recordPage.hasWaveformDisplay()).toBe(true);
      
      // Simulate performance degradation
      await performanceSimulator.simulatePerformanceDegradation('high', 'low', true);
      
      // Wait for performance manager to detect changes
      await page.waitForTimeout(3000);
      
      // Should still be recording but with degraded quality
      const state = await recordPage.getRecordingState();
      expect(state.isRecording).toBe(true);
      
      // Performance status should have changed
      await page.waitForTimeout(2000);
      const newStatus = await recordPage.getPerformanceStatus();
      expect(['low', 'emergency']).toContain(newStatus);
      
      await recordPage.stopRecording();
    });

    test('should upgrade quality when performance improves', async ({ page }) => {
      // Start with low performance
      await performanceSimulator.simulateDevicePerformance('low');
      await recordPage.goto();
      await page.waitForTimeout(1000);
      
      const initialStatus = await recordPage.getPerformanceStatus();
      expect(initialStatus).toBe('low');
      
      // Start recording
      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();
      
      // Simulate performance improvement
      await performanceSimulator.simulatePerformanceDegradation('low', 'high', true);
      
      // Wait for performance manager to detect improvements
      await page.waitForTimeout(4000);
      
      // Performance should have improved
      const newStatus = await recordPage.getPerformanceStatus();
      expect(['medium', 'high']).toContain(newStatus);
      
      await recordPage.stopRecording();
    });

    test('should handle memory pressure gracefully', async ({ page }) => {
      // Start with medium performance
      await performanceSimulator.simulateDevicePerformance('medium');
      await recordPage.goto();
      await page.waitForTimeout(1000);
      
      // Start recording
      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();
      
      // Simulate memory pressure
      await performanceSimulator.simulateMemoryPressure(true);
      await page.waitForTimeout(2000);
      
      // Should still be recording
      const state = await recordPage.getRecordingState();
      expect(state.isRecording).toBe(true);
      
      // May have degraded quality but should not crash
      const performanceStatus = await recordPage.getPerformanceStatus();
      expect(['low', 'medium', 'emergency']).toContain(performanceStatus);
      
      await recordPage.stopRecording();
    });
  });

  test.describe('Frame Rate and Responsiveness', () => {
    test('should maintain responsive UI during high performance recording', async ({ page }) => {
      await performanceSimulator.simulateDevicePerformance('high');
      await recordPage.goto();
      
      // Start recording
      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();
      
      // Monitor frame rate for 3 seconds
      const frameRates = await performanceSimulator.monitorFrameRate(3000);
      
      // High performance should maintain good frame rates
      const avgFrameRate = frameRates.reduce((a, b) => a + b, 0) / frameRates.length;
      expect(avgFrameRate).toBeGreaterThan(25); // Should maintain at least 25fps
      
      // UI should remain responsive
      await expect(recordPage.page.locator(recordPage.stopButton)).toBeVisible();
      
      await recordPage.stopRecording();
    });

    test('should throttle animations on low performance devices', async ({ page }) => {
      await performanceSimulator.simulateDevicePerformance('low');
      await recordPage.goto();
      
      // Start recording
      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();
      
      // Monitor frame rate
      const frameRates = await performanceSimulator.monitorFrameRate(3000);
      
      // Low performance should have throttled animations
      const avgFrameRate = frameRates.reduce((a, b) => a + b, 0) / frameRates.length;
      
      // Should still maintain basic responsiveness
      expect(avgFrameRate).toBeGreaterThan(10);
      
      // UI should remain functional
      const state = await recordPage.getRecordingState();
      expect(state.isRecording).toBe(true);
      
      await recordPage.stopRecording();
    });

    test('should prevent page freezing during performance stress', async ({ page }) => {
      await performanceSimulator.simulateDevicePerformance('medium');
      await recordPage.goto();
      
      // Start recording
      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();
      
      // Simulate extreme performance degradation
      await performanceSimulator.simulatePerformanceDegradation('medium', 'emergency', false);
      
      // Wait for system to adapt
      await page.waitForTimeout(2000);
      
      // Page should still be responsive
      const isResponsive = await page.evaluate(() => {
        return new Promise((resolve) => {
          let resolved = false;
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              resolve(false); // Page is frozen
            }
          }, 2000);
          
          // Test if we can interact with the page
          requestAnimationFrame(() => {
            if (!resolved) {
              resolved = true;
              resolve(true); // Page is responsive
            }
          });
        });
      });
      
      expect(isResponsive).toBe(true);
      
      // Recording should continue
      const state = await recordPage.getRecordingState();
      expect(state.isRecording).toBe(true);
      
      await recordPage.stopRecording();
    });
  });

  test.describe('Quality Settings Validation', () => {
    test('should use appropriate audio settings for each performance tier', async ({ page }) => {
      const tierTests = [
        { tier: 'high', expectedSampleRate: 48000 },
        { tier: 'medium', expectedSampleRate: 44100 },
        { tier: 'low', expectedSampleRate: 22050 },
        { tier: 'emergency', expectedSampleRate: 16000 }
      ];

      for (const { tier, expectedSampleRate } of tierTests) {
        await performanceSimulator.simulateDevicePerformance(tier);
        await recordPage.goto();
        await page.waitForTimeout(1000);
        
        // Start recording to trigger audio setup
        await recordPage.startRecording();
        await recordPage.waitForRecordingStart();
        
        // Check that appropriate quality settings are used
        const qualityDescription = await recordPage.getQualityDescription();
        
        switch (tier) {
          case 'high':
            expect(qualityDescription).toContain('High');
            break;
          case 'medium':
            expect(qualityDescription).toContain('Medium');
            break;
          case 'low':
            expect(qualityDescription).toContain('Basic');
            break;
          case 'emergency':
            expect(qualityDescription).toContain('Audio Only');
            break;
        }
        
        await recordPage.stopRecording();
        await page.waitForTimeout(500);
      }
    });

    test('should preserve recording quality through performance changes', async ({ page }) => {
      await performanceSimulator.simulateDevicePerformance('high');
      await recordPage.goto();
      
      // Start recording
      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();
      
      // Record for a bit
      await page.waitForTimeout(1000);
      
      // Degrade performance during recording
      await performanceSimulator.simulatePerformanceDegradation('high', 'low');
      await page.waitForTimeout(2000);
      
      // Recording should continue
      const state = await recordPage.getRecordingState();
      expect(state.isRecording).toBe(true);
      
      // Complete recording
      await recordPage.stopRecording();
      await recordPage.waitForRecordingComplete();
      
      // Should have audio preview available
      expect(await recordPage.hasRecordingComplete()).toBe(true);
    });
  });

  test.describe('Performance Recovery', () => {
    test('should restore features when performance improves', async ({ page }) => {
      // Start with emergency mode
      await performanceSimulator.simulateDevicePerformance('emergency');
      await recordPage.goto();
      await page.waitForTimeout(1000);
      
      let initialStatus = await recordPage.getPerformanceStatus();
      expect(initialStatus).toBe('emergency');
      
      // Improve performance significantly
      await performanceSimulator.simulateDevicePerformance('high');
      await page.waitForTimeout(3000); // Wait for detection
      
      // Performance should improve
      let newStatus = await recordPage.getPerformanceStatus();
      expect(['medium', 'high']).toContain(newStatus);
      
      // Start recording to test restored features
      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();
      
      // Should have visualization restored
      if (newStatus === 'high') {
        expect(await recordPage.hasWaveformDisplay()).toBe(true);
      }
      
      await recordPage.stopRecording();
    });

    test('should reset performance monitoring correctly', async ({ page }) => {
      await performanceSimulator.simulateDevicePerformance('medium');
      await recordPage.goto();
      
      // Navigate away and back
      await page.goto('/dashboard');
      await page.waitForTimeout(500);
      await recordPage.goto();
      await page.waitForTimeout(1000);
      
      // Performance detection should work correctly
      const status = await recordPage.getPerformanceStatus();
      expect(['medium', 'high', 'low']).toContain(status);
      
      // Recording should work
      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();
      await recordPage.stopRecording();
    });
  });

  test.afterEach(async ({ page }) => {
    // Reset performance to normal
    if (performanceSimulator) {
      await performanceSimulator.resetPerformance();
    }
  });
});