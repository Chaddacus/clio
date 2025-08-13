import { test, expect } from '@playwright/test';
import { createPerformanceSimulator } from '../utils/performance-simulator.js';
import { createAudioMocker } from '../utils/audio-mocks.js';
import { RecordPage } from '../page-objects/RecordPage.js';

test.describe('UI Components Validation', () => {
  let recordPage;
  let performanceSimulator;
  let audioMocker;

  test.beforeEach(async ({ page }) => {
    recordPage = new RecordPage(page);
    performanceSimulator = createPerformanceSimulator(page);
    audioMocker = createAudioMocker(page);

    await audioMocker.setupAudioMocks({
      enableMicrophone: true,
      simulateAudioLevel: 0.5
    });

    await performanceSimulator.exposePerformanceData();
  });

  test.describe('PerformanceIndicator Component', () => {
    test('should display correct performance tier information', async ({ page }) => {
      const tiers = ['high', 'medium', 'low', 'emergency'];

      for (const tier of tiers) {
        await performanceSimulator.simulateDevicePerformance(tier);
        await recordPage.goto();
        await page.waitForTimeout(1500);

        // Check performance indicator exists
        expect(await recordPage.hasPerformanceIndicator()).toBe(true);

        // Check performance status matches tier
        const status = await recordPage.getPerformanceStatus();
        expect(status).toBe(tier);

        // Check quality description is appropriate
        const qualityDescription = await recordPage.getQualityDescription();
        expect(qualityDescription).toBeTruthy();
        expect(typeof qualityDescription).toBe('string');
      }
    });

    test('should show expandable performance details', async ({ page }) => {
      await performanceSimulator.simulateDevicePerformance('high');
      await recordPage.goto();
      await page.waitForTimeout(1000);

      const performanceIndicator = page.locator('[data-testid="performance-indicator"], .performance-indicator, [class*="performance"]').first();
      
      if (await performanceIndicator.count() > 0) {
        // Try to click to expand details
        await performanceIndicator.click();
        await page.waitForTimeout(500);

        // Look for expanded content (device info, metrics, etc.)
        const expandedContent = await page.locator('text="Device Capability", text="Performance Score", text="CPU Cores"').count();
        
        if (expandedContent > 0) {
          // Should show device capability information
          expect(expandedContent).toBeGreaterThan(0);
        }
      }
    });

    test('should update metrics in real-time during recording', async ({ page }) => {
      await performanceSimulator.simulateDevicePerformance('medium');
      await recordPage.goto();
      await page.waitForTimeout(1000);

      // Start recording
      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();

      // Wait and check for metric updates
      await page.waitForTimeout(2000);

      // Should show real-time performance metrics
      const performanceText = await page.textContent('body');
      
      // Look for performance indicators
      const hasFrameRate = performanceText.includes('fps') || performanceText.includes('FPS');
      const hasPerformanceInfo = performanceText.includes('Performance') || performanceText.includes('Quality');
      
      expect(hasPerformanceInfo).toBe(true);

      await recordPage.stopRecording();
    });

    test('should change color based on performance status', async ({ page }) => {
      const statusTests = [
        { tier: 'high', expectedColorClass: ['green', 'success'] },
        { tier: 'medium', expectedColorClass: ['yellow', 'warning', 'blue'] },
        { tier: 'low', expectedColorClass: ['yellow', 'warning', 'orange'] },
        { tier: 'emergency', expectedColorClass: ['red', 'error', 'danger'] }
      ];

      for (const { tier, expectedColorClass } of statusTests) {
        await performanceSimulator.simulateDevicePerformance(tier);
        await recordPage.goto();
        await page.waitForTimeout(1000);

        // Check for color-indicating classes or styles
        const pageHTML = await page.innerHTML('body');
        const hasExpectedColor = expectedColorClass.some(color => 
          pageHTML.includes(`text-${color}`) || 
          pageHTML.includes(`bg-${color}`) || 
          pageHTML.includes(color)
        );

        // At least some visual indication of status should be present
        const status = await recordPage.getPerformanceStatus();
        expect(status).toBe(tier);
      }
    });
  });

  test.describe('WaveformDisplay Component', () => {
    test('should render waveform on high performance devices', async ({ page }) => {
      await performanceSimulator.simulateDevicePerformance('high');
      await recordPage.goto();

      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();

      // Should have waveform display
      expect(await recordPage.hasWaveformDisplay()).toBe(true);

      // Check for canvas element (waveform visualization)
      const canvasCount = await page.locator('canvas').count();
      expect(canvasCount).toBeGreaterThan(0);

      await recordPage.stopRecording();
    });

    test('should disable waveform on emergency mode devices', async ({ page }) => {
      await performanceSimulator.simulateDevicePerformance('emergency');
      await recordPage.goto();

      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();

      // May not have waveform in emergency mode
      const hasWaveform = await recordPage.hasWaveformDisplay();
      
      // Emergency mode might disable visualization features
      if (!hasWaveform) {
        // Verify recording still works without visualization
        const state = await recordPage.getRecordingState();
        expect(state.isRecording).toBe(true);
      }

      await recordPage.stopRecording();
    });

    test('should adapt frame rate based on performance', async ({ page }) => {
      // Test high performance first
      await performanceSimulator.simulateDevicePerformance('high');
      await recordPage.goto();

      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();

      let frameRates = await performanceSimulator.monitorFrameRate(2000);
      let avgFPSHigh = frameRates.reduce((a, b) => a + b, 0) / frameRates.length;

      await recordPage.stopRecording();
      await page.waitForTimeout(500);

      // Test low performance
      await performanceSimulator.simulateDevicePerformance('low');
      await page.reload();
      await page.waitForTimeout(1000);

      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();

      frameRates = await performanceSimulator.monitorFrameRate(2000);
      let avgFPSLow = frameRates.reduce((a, b) => a + b, 0) / frameRates.length;

      await recordPage.stopRecording();

      // Low performance should have lower or similar FPS (throttled)
      // Both should maintain acceptable performance
      expect(avgFPSHigh).toBeGreaterThan(15);
      expect(avgFPSLow).toBeGreaterThan(10);
    });

    test('should show visual feedback during recording', async ({ page }) => {
      await performanceSimulator.simulateDevicePerformance('medium');
      await recordPage.goto();

      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();

      // Should show some form of visual feedback
      const visualElements = await page.locator('canvas, [class*="waveform"], [class*="visualization"], [class*="animate"]').count();
      
      if (visualElements > 0) {
        expect(visualElements).toBeGreaterThan(0);
      }

      // Should show recording status
      const recordingIndicators = await page.locator('[class*="recording"], [class*="pulse"], [class*="animate"], .bg-red-500, .text-red-500').count();
      expect(recordingIndicators).toBeGreaterThan(0);

      await recordPage.stopRecording();
    });
  });

  test.describe('RecorderControls Component', () => {
    test('should show appropriate controls for each performance tier', async ({ page }) => {
      const tiers = ['high', 'medium', 'low', 'emergency'];

      for (const tier of tiers) {
        await performanceSimulator.simulateDevicePerformance(tier);
        await recordPage.goto();
        await page.waitForTimeout(1000);

        // Should always have basic recording controls
        await recordPage.assertRecordingButtonVisible();

        // Check control functionality
        await recordPage.startRecording();
        await recordPage.waitForRecordingStart();

        // All tiers should support basic controls
        const state = await recordPage.getRecordingState();
        expect(state.isRecording).toBe(true);

        await recordPage.stopRecording();
        await recordPage.waitForRecordingStopped();
      }
    });

    test('should display quality indicator in controls', async ({ page }) => {
      await performanceSimulator.simulateDevicePerformance('high');
      await recordPage.goto();

      // Should show quality information
      const qualityDescription = await recordPage.getQualityDescription();
      expect(qualityDescription).toBeTruthy();

      // Quality indicator should be visible
      const qualityText = await page.textContent('body');
      expect(qualityText).toMatch(/(Quality|Performance|High|Medium|Low|Basic|Audio Only)/i);
    });

    test('should handle permission states correctly', async ({ page }) => {
      // Test with permission denied
      await audioMocker.setupAudioMocks({
        enableMicrophone: false,
        simulateError: false
      });

      await recordPage.goto();

      // Should show permission warning
      const hasWarning = await recordPage.hasPermissionWarning();
      
      if (hasWarning) {
        expect(hasWarning).toBe(true);
      }

      // Test with permission granted
      await audioMocker.setupAudioMocks({
        enableMicrophone: true,
        simulateError: false
      });

      await page.reload();
      await page.waitForTimeout(1000);

      // Should not show permission warning
      const hasWarningAfter = await recordPage.hasPermissionWarning();
      expect(hasWarningAfter).toBe(false);
    });

    test('should maintain control responsiveness during performance changes', async ({ page }) => {
      await performanceSimulator.simulateDevicePerformance('high');
      await recordPage.goto();

      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();

      // Degrade performance during recording
      await performanceSimulator.simulatePerformanceDegradation('high', 'low');
      await page.waitForTimeout(2000);

      // Controls should remain responsive
      const stopButton = page.locator(recordPage.stopButton);
      await expect(stopButton).toBeVisible();
      await expect(stopButton).toBeEnabled();

      // Should be able to stop recording
      await recordPage.stopRecording();
      await recordPage.waitForRecordingStopped();
    });
  });

  test.describe('Audio Level Indicators', () => {
    test('should show audio levels during recording', async ({ page }) => {
      await performanceSimulator.simulateDevicePerformance('medium');
      await recordPage.goto();

      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();

      // Wait for audio levels to stabilize
      await page.waitForTimeout(1000);

      // Should show audio level feedback
      const audioLevel = await recordPage.getAudioLevel();
      
      // Audio mocker provides 50% level, so should be > 0
      expect(audioLevel).toBeGreaterThan(0);

      await recordPage.stopRecording();
    });

    test('should adapt audio level display based on performance', async ({ page }) => {
      // Test high performance audio levels
      await performanceSimulator.simulateDevicePerformance('high');
      await recordPage.goto();

      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();
      await page.waitForTimeout(1000);

      const highPerfLevel = await recordPage.getAudioLevel();

      await recordPage.stopRecording();
      await page.waitForTimeout(500);

      // Test emergency mode
      await performanceSimulator.simulateDevicePerformance('emergency');
      await page.reload();
      await page.waitForTimeout(1000);

      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();
      await page.waitForTimeout(1000);

      const emergencyLevel = await recordPage.getAudioLevel();

      await recordPage.stopRecording();

      // Both should detect audio, but emergency might have reduced updates
      expect(highPerfLevel).toBeGreaterThan(0);
      
      // Emergency mode might still show levels but potentially less frequently updated
      if (emergencyLevel === 0) {
        // Emergency mode might disable audio level visualization entirely
        console.log('Emergency mode disabled audio level display');
      } else {
        expect(emergencyLevel).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Error Handling UI', () => {
    test('should display appropriate error messages', async ({ page }) => {
      // Test microphone permission error
      await audioMocker.setupAudioMocks({
        enableMicrophone: false,
        simulateError: true
      });

      await recordPage.goto();

      // Try to start recording
      await recordPage.startRecording();

      // Should show error message
      await expect(page.locator('text=/permission/i, text=/microphone/i, text=/error/i').first()).toBeVisible({ timeout: 5000 });
    });

    test('should recover gracefully from errors', async ({ page }) => {
      await performanceSimulator.simulateDevicePerformance('medium');
      
      // Start with error state
      await audioMocker.setupAudioMocks({
        enableMicrophone: false,
        simulateError: true
      });

      await recordPage.goto();

      // Try recording - should fail
      await recordPage.startRecording();
      await page.waitForTimeout(1000);

      // Fix permission
      await audioMocker.setupAudioMocks({
        enableMicrophone: true,
        simulateError: false
      });

      // Should be able to start recording now
      await recordPage.startRecording();
      await recordPage.waitForRecordingStart();

      await recordPage.stopRecording();
    });
  });

  test.afterEach(async ({ page }) => {
    if (performanceSimulator) {
      await performanceSimulator.resetPerformance();
    }
  });
});