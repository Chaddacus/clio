const { test, expect } = require('@playwright/test');

test.describe('Complete Dashboard to Detail Page Flow', () => {
  // Skip authentication for now and test directly accessing detail page
  test('test direct detail page access and re-transcribe functionality', async ({ page }) => {
    console.log('🧪 Testing complete detail page functionality...');
    
    // Directly navigate to a note detail page
    await page.goto('http://localhost:3011/notes/1');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log('🔗 Current URL:', currentUrl);
    
    if (currentUrl.includes('/notes/')) {
      console.log('✅ Successfully accessed detail page');
      
      // Take screenshot of detail page
      await page.screenshot({ path: 'detail-page-full.png', fullPage: true });
      
      // Check for breadcrumb navigation
      const breadcrumb = await page.locator('button:has-text("Back to Dashboard")').count();
      console.log('🧭 Breadcrumb navigation found:', breadcrumb);
      
      // Check for page title
      const pageTitle = await page.locator('h1').first();
      const titleText = await pageTitle.textContent();
      console.log('📰 Page title:', titleText);
      
      // Check for transcription section
      const transcriptionSection = await page.locator('h2:has-text("Transcription")').count();
      console.log('📝 Transcription section found:', transcriptionSection);
      
      // Check for re-transcribe button (should only show for completed notes)
      const retranscribeButton = await page.locator('button:has-text("Re-transcribe")').count();
      console.log('🔄 Re-transcribe button found:', retranscribeButton);
      
      if (retranscribeButton > 0) {
        console.log('🎯 Testing re-transcribe functionality...');
        
        // Click the re-transcribe button
        await page.click('button:has-text("Re-transcribe")');
        await page.waitForTimeout(500);
        
        // Check if dialog appears
        const dialog = await page.locator('text="Re-transcribe Audio"').count();
        console.log('📋 Re-transcribe dialog opened:', dialog > 0);
        
        if (dialog > 0) {
          // Take screenshot of dialog
          await page.screenshot({ path: 'retranscribe-dialog.png' });
          
          // Check for language selector
          const languageSelect = await page.locator('select#language-select').count();
          console.log('🌍 Language selector found:', languageSelect);
          
          // Check for dialog buttons
          const cancelButton = await page.locator('button:has-text("Cancel")').count();
          const confirmButton = await page.locator('button:has-text("Re-transcribe")').count();
          console.log('🔘 Dialog buttons found:', { cancelButton, confirmButton });
          
          // Test changing language
          if (languageSelect > 0) {
            await page.selectOption('select#language-select', 'en');
            console.log('✅ Language selection works');
          }
          
          // Test cancel functionality
          await page.click('button:has-text("Cancel")');
          await page.waitForTimeout(500);
          
          // Check if dialog closed
          const dialogClosed = await page.locator('text="Re-transcribe Audio"').count();
          console.log('❌ Dialog closed after cancel:', dialogClosed === 0);
        }
      } else {
        console.log('ℹ️  Re-transcribe button not shown (note may not be completed)');
      }
      
      // Test breadcrumb navigation
      if (breadcrumb > 0) {
        console.log('🧭 Testing breadcrumb navigation...');
        
        await page.click('button:has-text("Back to Dashboard")');
        await page.waitForTimeout(2000);
        
        const newUrl = page.url();
        console.log('🔗 URL after breadcrumb click:', newUrl);
        
        if (newUrl.includes('/dashboard')) {
          console.log('✅ Breadcrumb navigation works');
        } else {
          console.log('❌ Breadcrumb navigation failed');
        }
      }
      
      console.log('✅ Detail page functionality test completed');
      
    } else {
      console.log('❌ Could not access detail page - likely authentication issue');
      
      // Check if we're on login page
      if (currentUrl.includes('/login')) {
        console.log('🔄 Redirected to login page');
        
        // Try to find login form elements
        const loginForm = await page.locator('input[name="username"], input[type="email"]').count();
        console.log('📝 Login form elements found:', loginForm);
        
        if (loginForm > 0) {
          console.log('📋 Login form is present - authentication required for detail pages');
        }
      }
    }
    
    console.log('✅ Complete functionality test finished');
  });
  
  test('test dashboard card structure and expected elements', async ({ page }) => {
    console.log('🏠 Testing dashboard structure...');
    
    await page.goto('http://localhost:3011/dashboard');
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log('🔗 Dashboard URL:', currentUrl);
    
    // Check for dashboard elements regardless of authentication
    const dashboardTitle = await page.locator('h1:has-text("Dashboard"), text="Dashboard"').count();
    console.log('🏠 Dashboard title found:', dashboardTitle);
    
    // Look for any card-like structures
    const potentialCards = await page.locator('[class*="bg-white"], [class*="card"], [class*="rounded"]').count();
    console.log('📋 Potential card elements found:', potentialCards);
    
    // Check for grid layout
    const gridLayout = await page.locator('[class*="grid"]').count();
    console.log('📊 Grid layout elements found:', gridLayout);
    
    // Take screenshot for visual reference
    await page.screenshot({ path: 'dashboard-structure.png', fullPage: true });
    
    console.log('✅ Dashboard structure test completed');
  });
});