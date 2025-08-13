const { test, expect } = require('@playwright/test');

test.describe('Permission Debug Tests', () => {
  test('Test with mock getUserMedia', async ({ page, context }) => {
    console.log('🔍 Permission debug test starting...');

    // Mock getUserMedia before navigation
    await page.addInitScript(() => {
      console.log('[MOCK] Setting up getUserMedia mock...');
      
      // Store original if it exists
      const originalGetUserMedia = navigator.mediaDevices?.getUserMedia;
      
      // Mock getUserMedia to simulate permission grant
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: async (constraints) => {
            console.log('[MOCK] getUserMedia called with:', constraints);
            
            // Simulate a small delay
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Create a mock stream
            const mockTrack = {
              stop: () => console.log('[MOCK] Track stopped'),
              kind: 'audio',
              enabled: true,
              readyState: 'live',
              id: 'mock-audio-track'
            };
            
            const mockStream = {
              getTracks: () => [mockTrack],
              getAudioTracks: () => [mockTrack],
              id: 'mock-stream',
              active: true
            };
            
            console.log('[MOCK] Returning mock stream');
            return mockStream;
          }
        }
      });
      
      // Mock permissions API
      Object.defineProperty(navigator, 'permissions', {
        value: {
          query: async ({ name }) => {
            console.log('[MOCK] Permission query for:', name);
            return {
              state: 'granted',
              addEventListener: () => {},
              removeEventListener: () => {}
            };
          }
        }
      });
      
      console.log('[MOCK] Setup complete');
    });

    // Login quickly
    await page.goto('/login');
    try {
      await page.fill('input[name="username"], input[type="email"]', 'testuser');
      await page.fill('input[name="password"], input[type="password"]', 'testpassword123');
      await page.click('button[type="submit"], button:has-text("Login")');
      await page.waitForTimeout(2000);
    } catch (error) {
      console.log('Login handled');
    }

    // Go to record page
    await page.goto('/record');
    await page.waitForLoadState('networkidle');
    
    console.log('🎯 Page loaded, looking for debugger...');

    // Capture console messages
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Find and click start button
    const startButton = page.locator('button:has-text("Start Recording")').first();
    await expect(startButton).toBeVisible();
    
    console.log('🖱️ Clicking start recording...');
    await startButton.click();
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    // Capture logs from UI
    const logContainer = page.locator('.bg-black.text-green-400');
    if (await logContainer.count() > 0) {
      const logText = await logContainer.textContent();
      console.log('📋 UI Debug Logs:');
      console.log(logText);
    }
    
    // Check button state
    const buttonText = await startButton.textContent();
    const isDisabled = await startButton.isDisabled();
    console.log('📊 Button state:', { text: buttonText, disabled: isDisabled });
    
    // Stop recording if it started
    if (buttonText?.includes('Recording') || isDisabled) {
      console.log('🛑 Attempting to stop recording...');
      const stopButton = page.locator('button:has-text("Stop Recording")').first();
      if (await stopButton.isEnabled()) {
        await stopButton.click();
        await page.waitForTimeout(1000);
      }
    }
    
    // Final state check
    await page.waitForTimeout(1000);
    const finalLogText = await logContainer.textContent();
    console.log('📋 Final Debug Logs:');
    console.log(finalLogText);
    
    // Check for any audio elements created
    const audioElements = await page.locator('audio[controls]').count();
    console.log('🎵 Audio elements created:', audioElements);
    
    // Analyze console messages
    const mockMessages = consoleMessages.filter(msg => msg.text.includes('[MOCK]'));
    const errorMessages = consoleMessages.filter(msg => msg.type === 'error');
    
    console.log('🔧 Mock messages:', mockMessages.length);
    console.log('❌ Error messages:', errorMessages.length);
    
    if (mockMessages.length > 0) {
      console.log('Mock calls:');
      mockMessages.forEach(msg => console.log(`  ${msg.text}`));
    }
    
    if (errorMessages.length > 0) {
      console.log('Errors:');
      errorMessages.forEach(msg => console.log(`  ${msg.text}`));
    }
    
    console.log('✅ Permission debug test completed');
  });
});