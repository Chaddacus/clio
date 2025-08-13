const { test, expect } = require('@playwright/test');

test.describe('Debug Card Clicks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3011/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });

  test('debug what happens when we click different parts of cards', async ({ page }) => {
    console.log('🔍 Debugging card click behavior...');
    
    // Listen for console logs from the page
    page.on('console', msg => {
      if (msg.text().includes('Note clicked')) {
        console.log('📢 PAGE LOG:', msg.text());
      }
    });
    
    // Find cards and test clicking different areas
    const cards = await page.locator('[class*="cursor-pointer"][class*="bg-white"]').all();
    console.log(`Found ${cards.length} cards with cursor-pointer`);
    
    if (cards.length > 0) {
      const firstCard = cards[0];
      
      console.log('🎯 Testing click on card title area...');
      const titleElement = firstCard.locator('h3');
      if (await titleElement.count() > 0) {
        await titleElement.click();
        await page.waitForTimeout(1000);
        console.log('🔗 URL after title click:', page.url());
      }
      
      console.log('🎯 Testing click on card body (non-interactive area)...');
      const statusElement = firstCard.locator('text=/Created/').first();
      if (await statusElement.count() > 0) {
        await statusElement.click();
        await page.waitForTimeout(1000);
        console.log('🔗 URL after status area click:', page.url());
      }
      
      console.log('🎯 Testing click on entire card...');
      await firstCard.click();
      await page.waitForTimeout(1000);
      console.log('🔗 URL after full card click:', page.url());
      
      // Check if card has proper onclick handler
      const hasClickHandler = await firstCard.evaluate(el => {
        return el.onclick !== null || el.getAttribute('onclick') !== null;
      });
      console.log('🔧 Card has click handler:', hasClickHandler);
      
      // Check card's actual event listeners
      const eventListeners = await firstCard.evaluate(el => {
        return Object.getOwnPropertyNames(el).filter(prop => prop.startsWith('on'));
      });
      console.log('🎪 Card event properties:', eventListeners);
    }
    
    console.log('✅ Debug test completed');
  });
});