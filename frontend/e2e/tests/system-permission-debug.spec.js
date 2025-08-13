const { test, expect } = require('@playwright/test');

test.describe('System-Level Permission Debugging', () => {
  test('Debug system permission vs browser permission conflict', async ({ browser }) => {
    console.log('🔍 Debugging system vs browser permission conflict...');

    // Create context and grant browser permissions
    const context = await browser.newContext({
      permissions: ['microphone'],
    });

    const page = await context.newPage();

    // Collect console logs
    const consoleMessages = [];
    page.on('console', msg => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now()
      };
      consoleMessages.push(message);
      console.log(`[${msg.type()}] ${msg.text()}`);
    });

    // Navigate directly to record page
    await page.goto('http://localhost:3011/record');
    await page.waitForLoadState('networkidle');
    console.log('📍 Record page loaded');

    // Test different microphone access scenarios
    console.log('\n🧪 TESTING MICROPHONE ACCESS SCENARIOS');
    console.log('==========================================');

    // Test 1: Check if mediaDevices is available
    const hasMediaDevices = await page.evaluate(() => {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    });
    console.log(`✅ navigator.mediaDevices available: ${hasMediaDevices}`);

    // Test 2: Check permission state via Permissions API
    const permissionState = await page.evaluate(async () => {
      try {
        if (navigator.permissions) {
          const result = await navigator.permissions.query({ name: 'microphone' });
          return {
            state: result.state,
            available: true
          };
        }
        return { state: 'unavailable', available: false };
      } catch (error) {
        return { state: 'error', available: false, error: error.message };
      }
    });
    console.log(`✅ Permissions API state: ${JSON.stringify(permissionState)}`);

    // Test 3: Try basic getUserMedia with minimal constraints
    console.log('\n🎤 TESTING getUserMedia WITH DIFFERENT CONSTRAINTS:');
    
    const constraints = [
      // Test 1: Minimal constraints
      { audio: true },
      // Test 2: Basic constraints
      { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } },
      // Test 3: Very basic - no advanced features
      { audio: { echoCancellation: true } },
      // Test 4: Empty audio object
      { audio: {} }
    ];

    for (let i = 0; i < constraints.length; i++) {
      const constraint = constraints[i];
      console.log(`\nTest ${i + 1}: ${JSON.stringify(constraint)}`);
      
      const result = await page.evaluate(async (testConstraint) => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(testConstraint);
          
          // Check stream properties
          const streamInfo = {
            id: stream.id,
            active: stream.active,
            tracks: stream.getTracks().length,
            audioTracks: stream.getAudioTracks().length,
            firstTrack: stream.getAudioTracks()[0] ? {
              kind: stream.getAudioTracks()[0].kind,
              label: stream.getAudioTracks()[0].label,
              enabled: stream.getAudioTracks()[0].enabled,
              readyState: stream.getAudioTracks()[0].readyState
            } : null
          };
          
          // Clean up immediately
          stream.getTracks().forEach(track => track.stop());
          
          return {
            success: true,
            streamInfo,
            error: null
          };
        } catch (error) {
          return {
            success: false,
            streamInfo: null,
            error: {
              name: error.name,
              message: error.message,
              constructor: error.constructor.name
            }
          };
        }
      }, constraint);

      if (result.success) {
        console.log(`   ✅ SUCCESS: ${JSON.stringify(result.streamInfo)}`);
        break; // If one works, we found a working constraint
      } else {
        console.log(`   ❌ FAILED: ${result.error.name} - ${result.error.message}`);
      }
    }

    // Test 4: Check available audio input devices
    console.log('\n🎧 CHECKING AVAILABLE AUDIO DEVICES:');
    const devices = await page.evaluate(async () => {
      try {
        if (navigator.mediaDevices.enumerateDevices) {
          const deviceList = await navigator.mediaDevices.enumerateDevices();
          return deviceList
            .filter(device => device.kind === 'audioinput')
            .map(device => ({
              deviceId: device.deviceId,
              label: device.label,
              kind: device.kind
            }));
        }
        return [];
      } catch (error) {
        return { error: error.message };
      }
    });
    
    if (devices.error) {
      console.log(`❌ Device enumeration failed: ${devices.error}`);
    } else if (devices.length === 0) {
      console.log('❌ No audio input devices found');
    } else {
      console.log(`✅ Found ${devices.length} audio input devices:`);
      devices.forEach((device, index) => {
        console.log(`   ${index + 1}. ${device.label || 'Unknown'} (${device.deviceId.substring(0, 10)}...)`);
      });
    }

    // Test 5: Check MediaRecorder support
    console.log('\n📹 CHECKING MEDIARECORDER SUPPORT:');
    const mediaRecorderSupport = await page.evaluate(() => {
      const support = {
        available: typeof MediaRecorder !== 'undefined',
        supportedTypes: []
      };
      
      if (support.available) {
        const typesToTest = [
          'audio/webm',
          'audio/webm;codecs=opus',
          'audio/mp4',
          'audio/mpeg',
          'audio/ogg'
        ];
        
        support.supportedTypes = typesToTest.filter(type => MediaRecorder.isTypeSupported(type));
      }
      
      return support;
    });
    
    console.log(`✅ MediaRecorder available: ${mediaRecorderSupport.available}`);
    if (mediaRecorderSupport.available) {
      console.log(`✅ Supported types: ${mediaRecorderSupport.supportedTypes.join(', ')}`);
    }

    // Test 6: Browser and system info
    console.log('\n🌐 BROWSER AND SYSTEM INFO:');
    const browserInfo = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine
    }));
    
    console.log(`Browser: ${browserInfo.userAgent}`);
    console.log(`Platform: ${browserInfo.platform}`);
    console.log(`Language: ${browserInfo.language}`);

    await context.close();

    console.log('\n==========================================');
    console.log('🔬 SYSTEM PERMISSION DEBUG COMPLETED');
    console.log('==========================================\n');

    // Basic assertion
    expect(hasMediaDevices).toBe(true);
  });
});