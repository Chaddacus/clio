const { test, expect } = require('@playwright/test');

test.describe('Dashboard Recording Card Navigation Test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3011/login');
    await page.waitForLoadState('networkidle');
    
    // Login to the application
    try {
      await page.fill('input[name="username"], input[type="email"], input[id="username"], input[id="email"]', 'testuser');
      await page.fill('input[name="password"], input[type="password"], input[id="password"]', 'testpassword123');
      await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      // Wait for dashboard to load
      await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(async () => {
        await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 5000 });
      });
      
      console.log('✅ Successfully logged in and reached dashboard');
    } catch (error) {
      console.warn('Login may have failed:', error.message);
      // Try to navigate directly to dashboard
      await page.goto('http://localhost:3011/dashboard');
    }
  });

  test('examine current dashboard card behavior', async ({ page }) => {
    console.log('🔍 Examining current dashboard state...');
    
    // Wait for the dashboard to fully load
    await page.waitForTimeout(3000);
    
    // Take a screenshot of the current dashboard
    await page.screenshot({ path: 'dashboard-current-state.png', fullPage: true });
    console.log('📸 Screenshot saved: dashboard-current-state.png');
    
    // Check for existing recording cards
    const recordingCards = await page.locator('.bg-white.dark\\:bg-gray-800, [class*="card"], [data-testid*="note"]').all();
    console.log(`Found ${recordingCards.length} potential recording cards`);
    
    if (recordingCards.length > 0) {
      console.log('📋 Testing first recording card...');
      
      const firstCard = recordingCards[0];
      
      // Get card details before clicking
      const cardText = await firstCard.textContent();
      console.log('📝 Card content preview:', cardText?.substring(0, 100) + '...');
      
      // Check if card is clickable
      const isClickable = await firstCard.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.cursor === 'pointer' || el.getAttribute('onclick') !== null;
      });
      console.log('🖱️  Card is clickable:', isClickable);
      
      // Get current URL before clicking
      const urlBefore = page.url();
      console.log('🔗 URL before click:', urlBefore);
      
      // Click on the card
      console.log('🖱️  Clicking on first recording card...');
      await firstCard.click();
      
      // Wait for potential navigation
      await page.waitForTimeout(2000);
      
      // Get URL after clicking
      const urlAfter = page.url();
      console.log('🔗 URL after click:', urlAfter);
      
      if (urlAfter !== urlBefore) {
        console.log('✅ Navigation occurred!');
        
        // Check if we're on a detail page
        if (urlAfter.includes('/notes/')) {
          console.log('✅ Navigated to note detail page');
          
          // Take screenshot of detail page
          await page.screenshot({ path: 'note-detail-current.png', fullPage: true });
          console.log('📸 Detail page screenshot saved: note-detail-current.png');
          
          // Check for audio player on detail page
          const audioPlayer = await page.locator('[data-testid="audio-play-pause"], audio, .audio-player').count();
          console.log('🎵 Audio players found on detail page:', audioPlayer);
          
          // Check for transcription section
          const transcriptionSection = await page.locator('text=/transcription/i, [data-testid*="transcript"]').count();
          console.log('📝 Transcription sections found:', transcriptionSection);
          
          // Check for re-transcribe button
          const retranscribeButton = await page.locator('button:has-text("Re-transcribe"), button:has-text("Retranscribe"), button:has-text("Transcribe Again")').count();
          console.log('🔄 Re-transcribe buttons found:', retranscribeButton);
          
        } else {
          console.log('⚠️  Navigation occurred but not to detail page. URL:', urlAfter);
        }
      } else {
        console.log('❌ No navigation occurred - card click may not be working');
      }
      
    } else {
      console.log('⚠️  No recording cards found on dashboard');
      
      // Check for empty state
      const emptyState = await page.locator('text=/no voice notes/i, text=/no recordings/i, text=/start recording/i').count();
      console.log('📭 Empty state messages found:', emptyState);
    }
    
    console.log('✅ Dashboard examination completed');
  });

  test('test manual navigation to note detail page', async ({ page }) => {
    console.log('🧭 Testing manual navigation to note detail page...');
    
    // Try to navigate directly to a note detail page
    await page.goto('http://localhost:3011/notes/1');
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    console.log('🔗 Current URL after manual navigation:', currentUrl);
    
    if (currentUrl.includes('/notes/')) {
      console.log('✅ Manual navigation to detail page successful');
      
      // Take screenshot
      await page.screenshot({ path: 'manual-detail-navigation.png', fullPage: true });
      
      // Check page content
      const pageContent = await page.textContent('body');
      const hasNoteContent = pageContent?.includes('Note') || pageContent?.includes('Transcription') || pageContent?.includes('Audio');
      console.log('📄 Page has note-related content:', hasNoteContent);
      
      // Check for audio player
      const audioElements = await page.locator('audio, [data-testid*="audio"], .audio-player').count();
      console.log('🎵 Audio elements found:', audioElements);
      
      // Check for transcription
      const transcriptionElements = await page.locator('text=/transcription/i').count();
      console.log('📝 Transcription elements found:', transcriptionElements);
      
    } else {
      console.log('❌ Manual navigation failed or redirected');
      
      // Check if redirected to login
      if (currentUrl.includes('/login')) {
        console.log('🔄 Redirected to login - authentication may be required');
      }
    }
    
    console.log('✅ Manual navigation test completed');
  });
});