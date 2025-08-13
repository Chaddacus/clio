const { test, expect } = require('@playwright/test');

test.describe('Authenticated Detail Page Audio Loading', () => {
  test('login and verify audio loading on detail page', async ({ page }) => {
    console.log('🧪 Testing authenticated detail page audio loading...');
    
    // Step 1: Navigate to login page and authenticate
    console.log('🔐 Logging in...');
    await page.goto('http://localhost:3011/login');
    
    // Fill in login credentials (using common test credentials)
    await page.fill('[data-testid="username"], [name="username"], input[type="text"]', 'testuser');
    await page.fill('[data-testid="password"], [name="password"], input[type="password"]', 'testpassword123');
    
    // Submit login form
    await page.click('button[type="submit"], input[type="submit"], .login-button, button:has-text("Login"), button:has-text("Sign in")');
    
    // Wait for navigation after login
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give time for redirect
    
    const currentUrl = page.url();
    console.log('🔗 After login URL:', currentUrl);
    
    if (currentUrl.includes('/login')) {
      console.log('❌ Login failed - still on login page');
      
      // Try alternative login approach - look for any form and try different selectors
      const forms = await page.locator('form').count();
      console.log('📝 Forms found:', forms);
      
      const inputs = await page.locator('input').count();
      console.log('📝 Inputs found:', inputs);
      
      const buttons = await page.locator('button').count();
      console.log('📝 Buttons found:', buttons);
      
      // Take screenshot for debugging
      await page.screenshot({ path: 'login-failed.png' });
      
      console.log('⚠️  Skipping to direct navigation test...');
    } else {
      console.log('✅ Login successful, redirected to:', currentUrl);
    }
    
    // Step 2: Navigate to dashboard first
    console.log('🏠 Navigating to dashboard...');
    await page.goto('http://localhost:3011/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const dashboardUrl = page.url();
    console.log('🏠 Dashboard URL:', dashboardUrl);
    
    if (dashboardUrl.includes('/dashboard')) {
      console.log('✅ Successfully accessed dashboard');
      
      // Look for recording cards
      const cards = await page.locator('.card, [data-testid*="card"], .note-card, .recording-card').count();
      console.log('🎵 Recording cards found:', cards);
      
      // Look for any clickable notes/recordings
      const noteLinks = await page.locator('a[href*="/notes/"], .clickable-note, [data-testid*="note"]').count();
      console.log('🔗 Note links found:', noteLinks);
      
      if (cards > 0 || noteLinks > 0) {
        // Try to find the specific note 15 or any available note
        const specificNote = await page.locator('a[href="/notes/15"], [href*="/notes/15"]').count();
        if (specificNote > 0) {
          console.log('🎯 Found specific note 15, clicking...');
          await page.click('a[href="/notes/15"], [href*="/notes/15"]');
        } else {
          // Find any available note to test with
          const firstNote = await page.locator('a[href*="/notes/"], .clickable-note').first();
          const firstNoteExists = await firstNote.count() > 0;
          
          if (firstNoteExists) {
            const href = await firstNote.getAttribute('href');
            console.log('🎯 Clicking first available note:', href);
            await firstNote.click();
          }
        }
        
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
      }
    }
    
    // Step 3: Try direct navigation to note 15 detail page
    console.log('🎯 Direct navigation to note 15...');
    await page.goto('http://localhost:3011/notes/15');
    await page.waitForLoadState('networkidle');
    
    // Listen for console logs to capture debug info
    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[NoteDetailPage]') || text.includes('[audioUtils]') || text.includes('[AudioPlayer]')) {
        logs.push(text);
      }
    });
    
    await page.waitForTimeout(3000); // Give time for React to render and logs to appear
    
    const finalUrl = page.url();
    console.log('🔗 Final URL:', finalUrl);
    
    if (finalUrl.includes('/notes/')) {
      console.log('✅ Successfully accessed note detail page');
      
      // Take screenshot for visual verification
      await page.screenshot({ path: 'note-detail-page.png', fullPage: true });
      
      // Print all captured debug logs
      console.log('📋 Debug logs captured:');
      logs.forEach((log, index) => {
        console.log(`${index + 1}. ${log}`);
      });
      
      // Check for audio player presence
      const audioElements = await page.locator('audio, [data-testid*="audio"], .audio-player').count();
      console.log('🎵 Audio elements found:', audioElements);
      
      // Check for play buttons
      const playButtons = await page.locator('button:has-text("Play"), [aria-label*="play"], .play-button, [data-testid*="play"]').count();
      console.log('▶️  Play buttons found:', playButtons);
      
      // Check for "Audio file not available" message
      const noAudioMessage = await page.locator('text="Audio file not available"').count();
      console.log('❌ "No audio" messages found:', noAudioMessage);
      
      // Check for debug information in error messages
      if (noAudioMessage > 0) {
        console.log('❌ Audio not available - checking debug info...');
        const debugInfo = await page.locator('text=/Debug:/')
        const debugExists = await debugInfo.count() > 0;
        if (debugExists) {
          const debugText = await debugInfo.first().textContent();
          console.log('🔍 Debug info from error message:', debugText);
        }
      } else {
        console.log('✅ No audio error message - audio should be available');
        
        // Try to interact with play button if found
        const playButtonElements = await page.locator('button').filter({ hasText: /play|▶/i }).all();
        if (playButtonElements.length > 0) {
          console.log(`🎯 Found ${playButtonElements.length} play button(s), testing first one...`);
          
          try {
            await playButtonElements[0].click();
            await page.waitForTimeout(1000);
            console.log('✅ Play button clicked successfully');
          } catch (error) {
            console.log('❌ Play button click failed:', error.message);
          }
        }
      }
      
      // Check page content structure
      const breadcrumb = await page.locator('button:has-text("Back to Dashboard")').count();
      console.log('🧭 Breadcrumb navigation found:', breadcrumb);
      
      const retranscribeButton = await page.locator('button:has-text("Re-transcribe")').count();
      console.log('🔄 Re-transcribe button found:', retranscribeButton);
      
      const transcriptionSection = await page.locator('h2:has-text("Transcription")').count();
      console.log('📝 Transcription section found:', transcriptionSection);
      
    } else {
      console.log('❌ Could not access detail page, final URL:', finalUrl);
      
      if (finalUrl.includes('/login')) {
        console.log('🔄 Still requires authentication');
      }
      
      // Take screenshot for debugging
      await page.screenshot({ path: 'final-state.png' });
    }
    
    console.log('✅ Authenticated detail page audio test completed');
  });
});