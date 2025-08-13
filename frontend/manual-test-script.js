const { chromium } = require('@playwright/test');

(async () => {
  console.log('Starting manual AudioContext test...');
  
  const browser = await chromium.launch({ 
    headless: false,  // Keep browser open for manual testing
    args: [
      '--use-fake-ui-for-media-stream',  // Auto-grant microphone permissions
      '--use-fake-device-for-media-stream',  // Use fake microphone
    ]
  });
  
  const context = await browser.newContext({
    permissions: ['microphone']
  });
  
  const page = await context.newPage();
  
  // Enhanced console logging to capture all MediaRecorder events
  const consoleMessages = [];
  page.on('console', (msg) => {
    const text = msg.text();
    const timestamp = Date.now();
    consoleMessages.push({
      type: msg.type(),
      text: text,
      timestamp: timestamp
    });
    
    // Filter for relevant messages
    if (text.includes('MediaRecorder') || 
        text.includes('useAudioRecorder') ||
        text.includes('AudioContext') ||
        text.includes('ONSTART') ||
        text.includes('ONSTOP') ||
        text.includes('ondataavailable') ||
        text.includes('DISABLED') ||
        text.includes('Skipping AudioContext')) {
      console.log(`[${new Date(timestamp).toISOString()}] [BROWSER ${msg.type().toUpperCase()}] ${text}`);
    }
  });

  // Capture any page errors
  page.on('pageerror', (error) => {
    console.log(`[PAGE ERROR] ${error.message}`);
  });

  console.log('Navigating to localhost:3011...');
  await page.goto('http://localhost:3011');
  
  // Wait a bit for the page to load
  await page.waitForTimeout(3000);
  
  console.log('\n=== MANUAL TEST INSTRUCTIONS ===');
  console.log('1. The browser should be open now');
  console.log('2. Log in with testuser/testpassword123 or any valid credentials');
  console.log('3. Navigate to the Record page');
  console.log('4. Click the record button and record for a few seconds');
  console.log('5. Stop recording');
  console.log('6. Watch the console output above for MediaRecorder events');
  console.log('7. Look specifically for:');
  console.log('   - AudioContext DISABLED messages');
  console.log('   - ONSTART and ONSTOP events');
  console.log('   - Recording duration between start and stop');
  console.log('8. Press Ctrl+C in this terminal when done testing');
  
  // Keep the script running and monitoring console
  setInterval(() => {
    // Just to keep the process alive
  }, 1000);
  
  // Handle exit gracefully
  process.on('SIGINT', async () => {
    console.log('\n\n=== FINAL ANALYSIS ===');
    
    // Analyze captured messages
    const mediaRecorderMessages = consoleMessages.filter(msg => 
      msg.text.includes('MediaRecorder') || 
      msg.text.includes('useAudioRecorder') ||
      msg.text.includes('AudioContext') ||
      msg.text.includes('ONSTART') ||
      msg.text.includes('ONSTOP') ||
      msg.text.includes('ondataavailable')
    );
    
    const audioContextMessages = consoleMessages.filter(msg => 
      msg.text.toLowerCase().includes('audiocontext') ||
      msg.text.includes('DISABLED') || 
      msg.text.includes('Skipping AudioContext')
    );
    
    const startEvents = consoleMessages.filter(msg => msg.text.includes('ONSTART'));
    const stopEvents = consoleMessages.filter(msg => msg.text.includes('ONSTOP'));
    
    console.log(`Total MediaRecorder messages captured: ${mediaRecorderMessages.length}`);
    console.log(`AudioContext messages: ${audioContextMessages.length}`);
    console.log(`Start events: ${startEvents.length}`);
    console.log(`Stop events: ${stopEvents.length}`);
    
    if (startEvents.length > 0 && stopEvents.length > 0) {
      const duration = stopEvents[0].timestamp - startEvents[0].timestamp;
      console.log(`MediaRecorder duration: ${duration}ms`);
      
      if (duration < 1000) {
        console.log('🚨 ISSUE DETECTED: Recording stopped prematurely');
      } else {
        console.log('✅ SUCCESS: Recording duration appears normal');
      }
    }
    
    const hasDisabledMessages = audioContextMessages.some(msg => 
      msg.text.includes('DISABLED') || msg.text.includes('Skipping')
    );
    
    if (hasDisabledMessages) {
      console.log('✅ AudioContext appears to be properly disabled');
    } else {
      console.log('⚠️ No AudioContext disabled messages found');
    }
    
    await browser.close();
    process.exit(0);
  });
  
})().catch(error => {
  console.error('Script error:', error);
  process.exit(1);
});