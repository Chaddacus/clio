const { test, expect } = require('@playwright/test');

test.describe('Main Record Button Debug', () => {
  test('Test main RecorderControls button vs debugger', async ({ page, context }) => {
    console.log('🔍 Testing main record button...');

    // Mock getUserMedia
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: async (constraints) => {
            console.log('[MOCK] getUserMedia called with:', constraints);
            
            // Create a proper mock MediaStream
            const canvas = document.createElement('canvas');
            const stream = canvas.captureStream();
            
            // Add mock audio track
            const mockAudioTrack = {
              stop: () => console.log('[MOCK] Audio track stopped'),
              kind: 'audio',
              enabled: true,
              readyState: 'live',
              id: 'mock-audio-track',
              label: 'Mock Audio Track'
            };
            
            // Override getAudioTracks to return our mock
            stream.getAudioTracks = () => [mockAudioTrack];
            
            console.log('[MOCK] Returning mock MediaStream');
            return stream;
          }
        }
      });

      // Mock permissions
      Object.defineProperty(navigator, 'permissions', {
        value: {
          query: async ({ name }) => ({
            state: 'granted',
            addEventListener: () => {},
            removeEventListener: () => {}
          })
        }
      });
    });

    // Login
    await page.goto('/login');
    try {
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
    } catch (error) {
      console.log('Login handled');
    }

    // Go to record page
    await page.goto('/record');
    await page.waitForLoadState('networkidle');
    
    // Capture console messages
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    console.log('🎯 Looking for main record button...');
    
    // Find the main record button (not the debugger one)
    // The main one should be in the RecorderControls component
    const recordButtons = await page.locator('button').allTextContents();
    console.log('Available buttons:', recordButtons);
    
    // Look for the button with microphone icon or "Start Recording" text
    const mainRecordButton = page.locator('[title="Start Recording"], button:has-text("Start Recording")').last();
    
    const buttonCount = await mainRecordButton.count();
    console.log('Main record button count:', buttonCount);
    
    if (buttonCount > 0) {
      const isVisible = await mainRecordButton.isVisible();
      const isEnabled = await mainRecordButton.isEnabled();
      console.log('Button state:', { visible: isVisible, enabled: isEnabled });
      
      if (isVisible && isEnabled) {
        console.log('🖱️ Clicking main record button...');
        await mainRecordButton.click();
        
        // Wait for processing
        await page.waitForTimeout(3000);
        
        // Check console logs
        const recorderLogs = consoleMessages.filter(msg => 
          msg.text.includes('[RecorderControls]') || 
          msg.text.includes('[useAudioRecorder]') ||
          msg.text.includes('[MOCK]')
        );
        
        console.log('📋 Relevant Console Logs:');
        recorderLogs.forEach(log => {
          console.log(`[${log.type}] ${log.text}`);
        });
        
        // Check if recording started
        const recordingState = await page.evaluate(() => {
          // Look for any recording indicators
          const buttons = Array.from(document.querySelectorAll('button'));
          const recordingButton = buttons.find(b => 
            b.textContent?.includes('Recording') || 
            b.textContent?.includes('Stop') ||
            b.disabled
          );
          return recordingButton ? {
            text: recordingButton.textContent,
            disabled: recordingButton.disabled,
            className: recordingButton.className
          } : null;
        });
        
        console.log('Recording state after click:', recordingState);
        
        // Look for any error messages
        const errorMessages = consoleMessages.filter(msg => msg.type === 'error');
        if (errorMessages.length > 0) {
          console.log('❌ Errors found:');
          errorMessages.forEach(err => console.log(`  ${err.text}`));
        }
        
      } else {
        console.log('❌ Button not clickable:', { visible: isVisible, enabled: isEnabled });
      }
    } else {
      console.log('❌ Main record button not found');
    }
    
    console.log('✅ Main record button test completed');
  });
});