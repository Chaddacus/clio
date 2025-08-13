const { test, expect } = require('@playwright/test');

test.describe('Test Navigation Fix', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3011/login');
    await page.waitForLoadState('networkidle');
    
    try {
      await page.fill('input[name="username"], input[type="email"], input[id="username"], input[id="email"]', 'testuser');
      await page.fill('input[name="password"], input[type="password"], input[id="password"]', 'testpassword123');
      await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(async () => {
        await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 5000 });
      });
    } catch (error) {
      await page.goto('http://localhost:3011/dashboard');
    }
  });

  test('test fixed card navigation', async ({ page }) => {
    console.log('🧪 Testing fixed card navigation...');
    
    await page.waitForTimeout(3000);
    
    // Look for actual recording cards (not header elements)
    const recordingCards = await page.locator('[class*="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md"]:has-text("MB"), [class*="card"]:has-text("MB")').all();
    console.log(`Found ${recordingCards.length} recording cards with size info`);
    
    if (recordingCards.length === 0) {
      // Try a more general approach
      const allCards = await page.locator('.bg-white.dark\\:bg-gray-800.rounded-lg, [data-testid*="note-card"], .cursor-pointer:has-text("Created")').all();
      console.log(`Found ${allCards.length} potential cards with creation date`);
      
      if (allCards.length > 0) {
        console.log('📋 Testing first card with creation info...');
        
        const firstCard = allCards[0];
        
        // Get URL before click
        const urlBefore = page.url();
        console.log('🔗 URL before:', urlBefore);
        
        // Click the card
        await firstCard.click();
        await page.waitForTimeout(2000);
        
        const urlAfter = page.url();
        console.log('🔗 URL after:', urlAfter);
        
        if (urlAfter.includes('/notes/')) {
          console.log('✅ SUCCESS! Card now navigates to detail page');
          await page.screenshot({ path: 'navigation-fix-success.png' });
        } else {
          console.log('❌ Navigation still not working correctly');
          await page.screenshot({ path: 'navigation-fix-failed.png' });
        }
      }
    } else {
      console.log('📋 Testing first recording card...');
      
      const firstCard = recordingCards[0];
      const urlBefore = page.url();
      
      await firstCard.click();
      await page.waitForTimeout(2000);
      
      const urlAfter = page.url();
      console.log('🔗 Navigation result:', { urlBefore, urlAfter });
      
      if (urlAfter.includes('/notes/')) {
        console.log('✅ Card navigation is working!');
      } else {
        console.log('❌ Card navigation still needs work');
      }
    }
    
    console.log('✅ Navigation test completed');
  });
});