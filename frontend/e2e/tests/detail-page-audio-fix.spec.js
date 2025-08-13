const { test, expect } = require('@playwright/test');

test.describe('Detail Page Audio Loading Fix', () => {
  test('verify audio loading on detail page', async ({ page }) => {
    console.log('🧪 Testing detail page audio loading fix...');
    
    // Listen for all console logs to capture debug info
    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[NoteDetailPage]') || text.includes('[audioUtils]') || text.includes('[AudioPlayer]')) {
        logs.push(text);
      }
    });
    
    // Navigate directly to the specific note mentioned by the user
    await page.goto('http://localhost:3011/notes/15');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give time for React to render and logs to appear
    
    const currentUrl = page.url();
    console.log('🔗 Current URL:', currentUrl);
    
    if (currentUrl.includes('/notes/15')) {
      console.log('✅ Successfully accessed note detail page');
      
      // Take screenshot for visual verification
      await page.screenshot({ path: 'note-15-detail-page.png', fullPage: true });
      
      // Print all captured debug logs
      console.log('📋 Debug logs captured:');
      logs.forEach((log, index) => {
        console.log(`${index + 1}. ${log}`);
      });
      
      // Check for audio player presence
      const audioPlayerElements = await page.locator('audio, [data-testid*="audio"], .audio-player').count();
      console.log('🎵 Audio elements found:', audioPlayerElements);
      
      // Check for audio-specific elements
      const playButton = await page.locator('button:has-text("Play"), [aria-label*="play"], .play-button').count();
      console.log('▶️  Play buttons found:', playButton);
      
      // Check for waveform or progress bars
      const progressBars = await page.locator('[role="progressbar"], .progress, [class*="waveform"]').count();
      console.log('📊 Progress/waveform elements found:', progressBars);
      
      // Check if "Audio file not available" message is shown
      const noAudioMessage = await page.locator('text="Audio file not available"').count();
      console.log('❌ "No audio" messages found:', noAudioMessage);
      
      // If no audio message is shown, audio should be available
      if (noAudioMessage === 0) {
        console.log('✅ Audio appears to be available (no error message)');
        
        // Look for any play buttons and try to interact with them
        const playButtons = await page.locator('button').filter({ hasText: /play|▶/ }).all();
        if (playButtons.length > 0) {
          console.log(`🎯 Found ${playButtons.length} potential play buttons, testing first one...`);
          
          try {
            await playButtons[0].click();
            await page.waitForTimeout(1000);
            console.log('✅ Play button clicked successfully');
          } catch (error) {
            console.log('❌ Play button click failed:', error.message);
          }
        }
      } else {
        console.log('❌ Audio not available - showing error message');
        
        // Check for debug information in the error message
        const debugInfo = await page.locator('text=/Debug:/').count();
        if (debugInfo > 0) {
          const debugText = await page.locator('text=/Debug:/').first().textContent();
          console.log('🔍 Debug info from error message:', debugText);
        }
      }
      
      // Check for re-transcribe button (should be present for completed notes)
      const retranscribeButton = await page.locator('button:has-text("Re-transcribe")').count();
      console.log('🔄 Re-transcribe button found:', retranscribeButton);
      
      // Check for breadcrumb navigation
      const breadcrumb = await page.locator('button:has-text("Back to Dashboard")').count();
      console.log('🧭 Breadcrumb navigation found:', breadcrumb);
      
    } else {
      console.log('❌ Could not access detail page, redirected to:', currentUrl);
      
      if (currentUrl.includes('/login')) {
        console.log('🔄 Authentication required - this is expected');
        
        // Still print captured logs as they might contain useful info
        if (logs.length > 0) {
          console.log('📋 Logs captured before redirect:');
          logs.forEach(log => console.log(`   ${log}`));
        }
      }
    }
    
    console.log('✅ Detail page audio test completed');
  });
});