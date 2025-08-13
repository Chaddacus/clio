const { test, expect } = require('@playwright/test');

test.describe('Specific Card Click Test', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for all console logs from the page
    page.on('console', msg => {
      console.log('🌐 PAGE LOG:', msg.text());
    });
    
    await page.goto('http://localhost:3011/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });

  test('find and click specific recording card', async ({ page }) => {
    console.log('🎯 Looking for specific recording cards...');
    
    // Get page source to understand the structure
    const pageSource = await page.content();
    
    // Look for cards using the exact class structure from NotesGrid
    const cardSelector = '.bg-white.dark\\:bg-gray-800.rounded-lg.shadow-sm.hover\\:shadow-md.cursor-pointer';
    const cards = await page.locator(cardSelector).all();
    console.log(`Found ${cards.length} cards with exact selector`);
    
    if (cards.length === 0) {
      // Try alternative selectors
      const altCards1 = await page.locator('[class*="cursor-pointer"][class*="bg-white"][class*="rounded-lg"]').all();
      console.log(`Found ${altCards1.length} cards with alternative selector 1`);
      
      const altCards2 = await page.locator('div:has(h3):has-text("MB")').all();
      console.log(`Found ${altCards2.length} cards with alternative selector 2 (has MB)`);
      
      // Try to find any clickable element with note content
      const noteElements = await page.locator('div:has-text("Created"):has-text("MB")').all();
      console.log(`Found ${noteElements.length} elements with Created and MB text`);
      
      if (noteElements.length > 0) {
        const firstElement = noteElements[0];
        console.log('🖱️  Attempting to click first note element...');
        
        const urlBefore = page.url();
        await firstElement.click({ force: true }); // Force click to bypass any overlays
        await page.waitForTimeout(2000);
        const urlAfter = page.url();
        
        console.log('🔗 Navigation check:', { urlBefore, urlAfter });
        
        if (urlAfter !== urlBefore) {
          console.log('✅ Navigation worked with force click!');
        } else {
          console.log('❌ Still no navigation');
        }
      }
    } else {
      console.log('🖱️  Clicking first card...');
      const firstCard = cards[0];
      
      const urlBefore = page.url();
      await firstCard.click();
      await page.waitForTimeout(2000);
      const urlAfter = page.url();
      
      console.log('🔗 Navigation result:', { urlBefore, urlAfter });
    }
    
    console.log('✅ Specific card test completed');
  });

  test('check if cards are actually rendered', async ({ page }) => {
    console.log('🔍 Checking card rendering...');
    
    // Check if the NotesGrid component is rendered
    const notesGridExists = await page.locator('div:has(div[class*="grid-cols"])').count();
    console.log('📊 Grid containers found:', notesGridExists);
    
    // Check for any div with recording-related content
    const recordingDivs = await page.locator('div:has-text("Created"), div:has-text("MB"), div:has-text("Recording")').all();
    console.log('📝 Recording content divs:', recordingDivs.length);
    
    for (let i = 0; i < Math.min(3, recordingDivs.length); i++) {
      const div = recordingDivs[i];
      const text = await div.textContent();
      const classes = await div.getAttribute('class');
      console.log(`📋 Div ${i}: classes="${classes}", text="${text?.substring(0, 50)}..."`);
    }
    
    console.log('✅ Card rendering check completed');
  });
});