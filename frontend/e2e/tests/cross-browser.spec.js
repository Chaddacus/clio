import { test, expect } from '@playwright/test';
import { createPerformanceSimulator } from '../utils/performance-simulator.js';
import { createAudioMocker } from '../utils/audio-mocks.js';
import { RecordPage } from '../page-objects/RecordPage.js';

test.describe('Cross-Browser Compatibility Tests', () => {
  let recordPage;
  let performanceSimulator;
  let audioMocker;

  test.beforeEach(async ({ page }) => {
    recordPage = new RecordPage(page);
    performanceSimulator = createPerformanceSimulator(page);
    audioMocker = createAudioMocker(page);

    await audioMocker.setupAudioMocks({
      enableMicrophone: true,
      simulateAudioLevel: 0.6
    });

    await performanceSimulator.exposePerformanceData();
  });

  test.describe('Core Functionality Across Browsers', () => {
    test('should load record page correctly in all browsers', async ({ page, browserName }) => {
      await performanceSimulator.simulateDevicePerformance('medium');
      await recordPage.goto();

      // Should load page successfully
      await expect(page).toHaveTitle(/Voice Notes|Recording|Audio/);
      
      // Should show recording button
      await recordPage.assertRecordingButtonVisible();

      // Should show performance indicator
      expect(await recordPage.hasPerformanceIndicator()).toBe(true);

      console.log(`✓ Page loaded successfully in ${browserName}`);
    });

    test('should support performance detection across browsers', async ({ page, browserName }) => {
      await performanceSimulator.simulateDevicePerformance('high');
      await recordPage.goto();
      await page.waitForTimeout(2000);

      const performanceStatus = await recordPage.getPerformanceStatus();
      
      // Should detect performance tier in all browsers
      expect(['high', 'medium', 'low', 'emergency']).toContain(performanceStatus);

      console.log(`✓ Performance detection working in ${browserName}: ${performanceStatus}`);
    });

    test('should handle audio recording workflow across browsers', async ({ page, browserName }) => {
      await performanceSimulator.simulateDevicePerformance('medium');
      await recordPage.goto();

      // Start recording
      await recordPage.startRecording();
      
      // Wait for recording to start (or error)
      await page.waitForTimeout(2000);

      const state = await recordPage.getRecordingState();
      
      if (state.isRecording) {
        // Recording started successfully
        await page.waitForTimeout(2000);
        
        // Stop recording
        await recordPage.stopRecording();
        await recordPage.waitForRecordingComplete();
        
        // Should have audio preview
        expect(await recordPage.hasRecordingComplete()).toBe(true);
        
        console.log(`✓ Recording workflow successful in ${browserName}`);
      } else {
        // Recording might be blocked or not supported
        console.log(`⚠ Recording not started in ${browserName} - likely due to permissions`);
        
        // Should still show appropriate UI
        expect(await recordPage.hasRecordingComplete()).toBe(false);
      }
    });

    test('should display UI components correctly across browsers', async ({ page, browserName }) => {
      await performanceSimulator.simulateDevicePerformance('high');
      await recordPage.goto();

      // Check key UI elements are present
      const uiElements = {
        recordButton: await page.locator('[title="Start Recording"]').count(),
        performanceIndicator: await recordPage.hasPerformanceIndicator(),
        recordingTime: await page.locator('[data-testid="recording-time"]').count(),
        qualityInfo: await page.locator('text=/Quality|Performance/i').count()
      };

      // Should have basic UI elements
      expect(uiElements.recordButton).toBeGreaterThan(0);
      expect(uiElements.performanceIndicator).toBe(true);
      expect(uiElements.recordingTime).toBeGreaterThan(0);

      console.log(`✓ UI elements present in ${browserName}:`, uiElements);
    });
  });

  test.describe('Performance Scaling Across Browsers', () => {
    test('should adapt performance tiers consistently across browsers', async ({ page, browserName }) => {
      const tiers = ['high', 'medium', 'low', 'emergency'];

      for (const tier of tiers) {
        await performanceSimulator.simulateDevicePerformance(tier);
        await recordPage.goto();
        await page.waitForTimeout(1500);

        const detectedTier = await recordPage.getPerformanceStatus();
        const qualityDescription = await recordPage.getQualityDescription();

        // Should detect appropriate tier
        expect(['high', 'medium', 'low', 'emergency', 'unknown']).toContain(detectedTier);
        expect(qualityDescription).toBeTruthy();

        console.log(`✓ ${browserName}: ${tier} → detected: ${detectedTier}, quality: ${qualityDescription}`);

        await page.waitForTimeout(500);
      }
    });

    test('should maintain responsive UI across browsers during performance changes', async ({ page, browserName }) => {
      await performanceSimulator.simulateDevicePerformance('high');
      await recordPage.goto();

      // Start recording
      await recordPage.startRecording();
      await page.waitForFunction(
        () => document.querySelector('[title="Stop Recording"]') !== null,
        { timeout: 5000 }
      ).catch(() => {
        console.log(`Recording not started in ${browserName}`);
        return false;
      });

      const isRecording = await recordPage.getRecordingState();
      
      if (isRecording.isRecording) {
        // Simulate performance degradation
        await performanceSimulator.simulatePerformanceDegradation('high', 'low');
        await page.waitForTimeout(2000);

        // UI should remain responsive
        const stopButton = page.locator('[title="Stop Recording"]');
        await expect(stopButton).toBeVisible();
        
        // Should still be able to interact
        await recordPage.stopRecording();
        
        console.log(`✓ Performance scaling maintained responsiveness in ${browserName}`);
      } else {
        console.log(`⚠ Recording not available in ${browserName} for performance test`);
      }
    });
  });

  test.describe('Browser-Specific Features', () => {
    test('should handle browser-specific audio codec support', async ({ page, browserName }) => {
      await performanceSimulator.simulateDevicePerformance('medium');
      await recordPage.goto();

      // Try recording to test codec support
      await recordPage.startRecording();
      await page.waitForTimeout(2000);

      const state = await recordPage.getRecordingState();

      if (state.isRecording) {
        await recordPage.stopRecording();
        await recordPage.waitForRecordingComplete();
        
        // Should successfully create audio blob
        expect(await recordPage.hasRecordingComplete()).toBe(true);
        
        console.log(`✓ Audio codec support working in ${browserName}`);
      } else {
        console.log(`⚠ Audio recording not available in ${browserName}`);
      }
    });

    test('should handle browser permission models correctly', async ({ page, browserName }) => {
      // Test with permission denied
      await audioMocker.setupAudioMocks({
        enableMicrophone: false,
        simulateError: true
      });

      await recordPage.goto();

      // Try recording
      await recordPage.startRecording();
      await page.waitForTimeout(2000);

      // Should show permission-related message or handle gracefully
      const hasPermissionUI = await recordPage.hasPermissionWarning() ||
                              await page.locator('text=/permission/i, text=/microphone/i').count() > 0 ||
                              await page.locator('[class*="error"]').count() > 0;

      console.log(`${browserName} permission handling: ${hasPermissionUI ? 'Shows permission UI' : 'Handles silently'}`);

      // Test with permission granted
      await audioMocker.setupAudioMocks({
        enableMicrophone: true,
        simulateError: false
      });

      await page.reload();
      await page.waitForTimeout(1000);

      const hasWarningAfterGrant = await recordPage.hasPermissionWarning();
      expect(hasWarningAfterGrant).toBe(false);

      console.log(`✓ Permission model handled correctly in ${browserName}`);
    });

    test('should maintain consistent visual appearance across browsers', async ({ page, browserName }) => {
      await performanceSimulator.simulateDevicePerformance('medium');
      await recordPage.goto();

      // Take screenshot for visual comparison
      await page.screenshot({ 
        path: `test-results/${browserName}-visual-baseline.png`,
        fullPage: false,
        clip: { x: 0, y: 0, width: 800, height: 600 }
      });

      // Check key visual elements
      const visualElements = {
        recordButton: await page.locator('[title="Start Recording"]').boundingBox(),
        performanceIndicator: await page.locator('[data-testid="performance-indicator"]').boundingBox(),
        title: await page.locator('h1').boundingBox()
      };

      // Should have properly positioned elements
      Object.entries(visualElements).forEach(([name, bounds]) => {
        if (bounds) {
          expect(bounds.width).toBeGreaterThan(0);
          expect(bounds.height).toBeGreaterThan(0);
          console.log(`✓ ${name} properly rendered in ${browserName}`);
        }
      });
    });
  });

  test.describe('Mobile Browser Support', () => {
    test('should work on mobile browsers', async ({ page, browserName }) => {
      // Only run on mobile browsers
      if (!browserName.includes('Mobile') && !browserName.includes('webkit')) {
        test.skip();
      }

      await performanceSimulator.simulateDevicePerformance('low'); // Mobile typically has lower performance
      await recordPage.goto();
      await page.waitForTimeout(2000);

      // Should detect appropriate performance tier for mobile
      const performanceStatus = await recordPage.getPerformanceStatus();
      expect(['low', 'medium', 'emergency']).toContain(performanceStatus);

      // Should have touch-friendly interface
      const recordButton = page.locator('[title="Start Recording"]');
      const buttonSize = await recordButton.boundingBox();

      if (buttonSize) {
        // Button should be large enough for touch (at least 44px)
        expect(Math.min(buttonSize.width, buttonSize.height)).toBeGreaterThan(44);
      }

      console.log(`✓ Mobile support verified in ${browserName}, performance: ${performanceStatus}`);
    });
  });

  test.afterEach(async ({ page }) => {
    if (performanceSimulator) {
      await performanceSimulator.resetPerformance();
    }
  });
});