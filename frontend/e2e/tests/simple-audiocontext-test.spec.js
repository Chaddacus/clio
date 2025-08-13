const { test, expect } = require('@playwright/test');

test.describe('Simple AudioContext Test - Console Log Analysis', () => {
  test('Capture console logs from recording page to analyze AudioContext behavior', async ({ page, context }) => {
    console.log('Starting simple AudioContext console log capture test...');
    
    // Grant microphone permissions
    await context.grantPermissions(['microphone']);
    
    // Enhanced console logging to capture all events
    const consoleMessages = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({
        type: msg.type(),
        text: text,
        timestamp: Date.now()
      });
      console.log(`[BROWSER ${msg.type().toUpperCase()}] ${text}`);
    });

    // Capture any page errors
    const pageErrors = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    // Navigate to recording page
    console.log('Navigating to recording page...');
    await page.goto('http://localhost:3011/record');
    
    // Wait for page to load completely and let it initialize
    await page.waitForLoadState('networkidle');
    console.log('Page loaded, waiting 5 seconds to capture initial logs...');
    
    // Wait long enough to see initialization logs
    await page.waitForTimeout(5000);
    
    // Try to take a screenshot to see what's on the page
    await page.screenshot({ path: 'debug-recording-page.png', fullPage: true });
    console.log('Screenshot saved as debug-recording-page.png');
    
    // Get page content to see what elements are available
    const pageContent = await page.content();
    console.log('Page HTML length:', pageContent.length);
    
    // Look for any buttons on the page
    const buttons = await page.locator('button').count();
    console.log(`Found ${buttons} buttons on the page`);
    
    // Get button details if any exist
    if (buttons > 0) {
      for (let i = 0; i < Math.min(buttons, 5); i++) {
        const button = page.locator('button').nth(i);
        const buttonText = await button.textContent();
        const buttonClass = await button.getAttribute('class');
        const buttonTitle = await button.getAttribute('title');
        console.log(`Button ${i}: text="${buttonText}", class="${buttonClass}", title="${buttonTitle}"`);
      }
    }
    
    // Analyze console messages for AudioContext and MediaRecorder events
    console.log('\n=== CONSOLE LOG ANALYSIS ===');
    
    // Filter for AudioContext related messages
    const audioContextMessages = consoleMessages.filter(msg => 
      msg.text.toLowerCase().includes('audiocontext') ||
      msg.text.includes('DISABLED') || 
      msg.text.includes('Skipping AudioContext') ||
      msg.text.includes('testing without AudioContext') ||
      msg.text.includes('AudioContext visualization') ||
      msg.text.includes('AudioContext setup')
    );
    
    console.log(`\nAudioContext related messages: ${audioContextMessages.length}`);
    audioContextMessages.forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.type}] ${msg.text}`);
    });
    
    // Filter for MediaRecorder related messages
    const mediaRecorderMessages = consoleMessages.filter(msg => 
      msg.text.includes('MediaRecorder') || 
      msg.text.includes('useAudioRecorder') ||
      msg.text.includes('ONSTART') ||
      msg.text.includes('ONSTOP') ||
      msg.text.includes('ondataavailable')
    );
    
    console.log(`\nMediaRecorder related messages: ${mediaRecorderMessages.length}`);
    mediaRecorderMessages.forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.type}] ${msg.text}`);
    });
    
    // Look for hook initialization messages
    const hookMessages = consoleMessages.filter(msg => 
      msg.text.includes('useAudioRecorder') ||
      msg.text.includes('RecorderControls') ||
      msg.text.includes('AudioDebugPanel')
    );
    
    console.log(`\nHook initialization messages: ${hookMessages.length}`);
    hookMessages.forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.type}] ${msg.text}`);
    });
    
    // Final assessment
    console.log('\n=== INITIAL ASSESSMENT ===');
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Page errors: ${pageErrors.length}`);
    console.log(`Buttons found: ${buttons}`);
    
    // Check if AudioContext messages indicate it's properly disabled
    const hasDisabledMessages = audioContextMessages.some(msg => 
      msg.text.includes('DISABLED') || msg.text.includes('Skipping')
    );
    
    if (hasDisabledMessages) {
      console.log('✅ AudioContext appears to be properly disabled for testing');
    } else {
      console.log('⚠️ No clear AudioContext disabled messages found');
    }
    
    if (pageErrors.length === 0) {
      console.log('✅ No page errors detected');
    } else {
      console.log('❌ Page errors detected');
      pageErrors.forEach(error => console.log(`  - ${error}`));
    }
    
    // Log all messages for complete debugging
    console.log('\n=== ALL CONSOLE MESSAGES ===');
    consoleMessages.forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.type}] ${msg.text}`);
    });
    
    // Basic assertions
    expect(pageErrors.length).toBe(0);
    expect(buttons).toBeGreaterThan(0); // Should have at least some buttons
  });
});