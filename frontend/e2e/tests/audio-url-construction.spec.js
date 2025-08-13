const { test, expect } = require('@playwright/test');

test.describe('Audio URL Construction Debug', () => {
  test('capture audio URL construction logs', async ({ page }) => {
    console.log('🔍 Testing audio URL construction logic...');
    
    // Capture all console logs, especially those from our audio utilities
    const logs = [];
    const errors = [];
    
    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);
      
      // Focus on our specific debug logs
      if (text.includes('[audioUtils]') || text.includes('[NoteDetailPage]') || text.includes('[AudioPlayer]')) {
        console.log(`🔍 ${text}`);
      }
    });
    
    page.on('pageerror', err => {
      console.log('❌ Page error:', err.message);
      errors.push(err.message);
    });
    
    // Navigate directly to the note detail page
    console.log('🔗 Navigating to http://localhost:3011/notes/15');
    await page.goto('http://localhost:3011/notes/15');
    
    // Wait a bit for any redirects or loading
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log('📍 Current URL:', currentUrl);
    
    // Check if we're on the detail page or got redirected
    if (currentUrl.includes('/notes/')) {
      console.log('✅ On detail page - checking for audio elements...');
      
      // Look for our debug logs in the console
      const audioUtilsLogs = logs.filter(log => log.includes('[audioUtils]'));
      const detailPageLogs = logs.filter(log => log.includes('[NoteDetailPage]'));
      
      console.log(`📊 Found ${audioUtilsLogs.length} audioUtils logs and ${detailPageLogs.length} NoteDetailPage logs`);
      
      if (audioUtilsLogs.length > 0) {
        console.log('🔍 AudioUtils logs:');
        audioUtilsLogs.forEach(log => console.log(`   ${log}`));
      }
      
      if (detailPageLogs.length > 0) {
        console.log('🔍 NoteDetailPage logs:');
        detailPageLogs.forEach(log => console.log(`   ${log}`));
      }
      
      // Check for audio elements
      const audioElements = await page.locator('audio').count();
      const audioPlayers = await page.locator('[data-testid*="audio"], .audio-player').count();
      console.log(`🎵 Found ${audioElements} <audio> elements and ${audioPlayers} audio player components`);
      
      // Check for error messages
      const noAudioMsg = await page.locator('text="Audio file not available"').count();
      console.log(`${noAudioMsg > 0 ? '❌' : '✅'} Audio availability: ${noAudioMsg === 0 ? 'Available' : 'Not Available'}`);
      
      if (noAudioMsg > 0) {
        // Look for debug information
        const debugElements = await page.locator('text=/Debug:/');
        const debugCount = await debugElements.count();
        
        if (debugCount > 0) {
          for (let i = 0; i < debugCount; i++) {
            const debugText = await debugElements.nth(i).textContent();
            console.log(`🔍 Debug info ${i + 1}: ${debugText}`);
          }
        }
      }
      
    } else if (currentUrl.includes('/login')) {
      console.log('🔐 Redirected to login page - authentication required');
      
      // Even on login redirect, our JavaScript might have run briefly
      const relevantLogs = logs.filter(log => 
        log.includes('[audioUtils]') || 
        log.includes('[NoteDetailPage]') || 
        log.includes('[AudioPlayer]')
      );
      
      if (relevantLogs.length > 0) {
        console.log('📊 Captured some logs before redirect:');
        relevantLogs.forEach(log => console.log(`   ${log}`));
      } else {
        console.log('📊 No relevant logs captured before redirect');
      }
    } else {
      console.log('🤔 Unexpected redirect to:', currentUrl);
    }
    
    // Check for any JavaScript errors
    if (errors.length > 0) {
      console.log('❌ JavaScript errors encountered:');
      errors.forEach(error => console.log(`   ${error}`));
    } else {
      console.log('✅ No JavaScript errors detected');
    }
    
    // Take a screenshot for visual verification
    await page.screenshot({ path: 'audio-url-debug.png', fullPage: true });
    
    console.log('📋 All console logs (filtered for relevance):');
    const importantLogs = logs.filter(log => {
      const lower = log.toLowerCase();
      return (
        lower.includes('audio') || 
        lower.includes('url') || 
        lower.includes('error') || 
        lower.includes('failed') ||
        lower.includes('construction') ||
        lower.includes('debug') ||
        lower.includes('[note') ||
        lower.includes('react')
      );
    });
    
    importantLogs.slice(0, 20).forEach((log, index) => {
      console.log(`${index + 1}. ${log}`);
    });
    
    if (importantLogs.length > 20) {
      console.log(`... and ${importantLogs.length - 20} more logs`);
    }
    
    console.log('🏁 Audio URL construction test completed');
  });
});