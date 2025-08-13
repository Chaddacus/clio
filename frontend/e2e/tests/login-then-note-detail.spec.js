const { test, expect } = require('@playwright/test');

test.describe('Login then Note Detail Audio Test', () => {
  test('login first then test note detail audio', async ({ page }) => {
    console.log('🧪 Testing audio loading with proper authentication flow...');
    
    // Capture console logs for our audio debugging
    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);
      if (text.includes('[audioUtils]') || text.includes('[NoteDetailPage]') || text.includes('[AudioPlayer]')) {
        console.log(`🔍 ${text}`);
      }
    });
    
    // Step 1: Navigate to login page
    console.log('🔐 Step 1: Navigating to login page...');
    await page.goto('http://localhost:3011/login');
    await page.waitForLoadState('networkidle');
    
    // Wait for the page to fully load
    await page.waitForTimeout(2000);
    
    // Check if we're on the login page
    const currentUrl = page.url();
    console.log('📍 Current URL:', currentUrl);
    
    if (!currentUrl.includes('/login')) {
      console.log('❌ Not on login page, current URL:', currentUrl);
      return;
    }
    
    // Take screenshot of login page
    await page.screenshot({ path: 'login-page.png' });
    
    // Look for login form elements more broadly
    await page.waitForTimeout(1000);
    
    // Check what elements are available
    const inputs = await page.locator('input').count();
    const buttons = await page.locator('button').count();
    const forms = await page.locator('form').count();
    
    console.log(`📝 Found ${inputs} inputs, ${buttons} buttons, ${forms} forms`);
    
    if (inputs === 0) {
      console.log('❌ No input elements found - page may still be loading');
      await page.waitForTimeout(3000);
      
      const inputsAfterWait = await page.locator('input').count();
      console.log(`📝 After waiting: ${inputsAfterWait} inputs found`);
    }
    
    // Try different selectors for username/email field
    const usernameSelectors = [
      'input[name="username"]',
      'input[name="email"]', 
      'input[type="text"]',
      'input[placeholder*="username" i]',
      'input[placeholder*="email" i]',
      '#username',
      '#email',
      '.username-input',
      '.email-input'
    ];
    
    let usernameField = null;
    for (const selector of usernameSelectors) {
      const field = page.locator(selector).first();
      const count = await field.count();
      if (count > 0) {
        usernameField = field;
        console.log(`✅ Found username field using selector: ${selector}`);
        break;
      }
    }
    
    if (!usernameField) {
      console.log('❌ Could not find username field - checking all input types:');
      const allInputs = await page.locator('input').all();
      for (let i = 0; i < allInputs.length; i++) {
        const inputType = await allInputs[i].getAttribute('type') || 'text';
        const inputName = await allInputs[i].getAttribute('name') || 'unnamed';
        const inputPlaceholder = await allInputs[i].getAttribute('placeholder') || 'no placeholder';
        console.log(`  Input ${i}: type="${inputType}", name="${inputName}", placeholder="${inputPlaceholder}"`);
      }
      
      // Use the first text input if available
      if (allInputs.length > 0) {
        usernameField = allInputs[0];
        console.log('📝 Using first available input as username field');
      }
    }
    
    // Try different selectors for password field
    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      '#password',
      '.password-input'
    ];
    
    let passwordField = null;
    for (const selector of passwordSelectors) {
      const field = page.locator(selector).first();
      const count = await field.count();
      if (count > 0) {
        passwordField = field;
        console.log(`✅ Found password field using selector: ${selector}`);
        break;
      }
    }
    
    if (usernameField && passwordField) {
      console.log('🔑 Filling in login credentials...');
      
      // Fill in the form
      await usernameField.fill('testuser');
      await passwordField.fill('testpassword123');
      
      // Look for submit button
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Login")',
        'button:has-text("Sign in")',
        'button:has-text("Log in")',
        '.login-button',
        '.submit-button',
        'form button'
      ];
      
      let submitButton = null;
      for (const selector of submitSelectors) {
        const button = page.locator(selector).first();
        const count = await button.count();
        if (count > 0) {
          submitButton = button;
          console.log(`✅ Found submit button using selector: ${selector}`);
          break;
        }
      }
      
      if (submitButton) {
        console.log('🚀 Submitting login form...');
        await submitButton.click();
        
        // Wait for navigation after login
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
        
        const afterLoginUrl = page.url();
        console.log('📍 After login URL:', afterLoginUrl);
        
        if (afterLoginUrl.includes('/login')) {
          console.log('❌ Still on login page - login may have failed');
          await page.screenshot({ path: 'login-failed.png' });
        } else {
          console.log('✅ Login successful, redirected to:', afterLoginUrl);
        }
      } else {
        console.log('❌ Could not find submit button');
        const allButtons = await page.locator('button').all();
        console.log(`📝 All buttons found: ${allButtons.length}`);
        for (let i = 0; i < allButtons.length; i++) {
          const buttonText = await allButtons[i].textContent() || '';
          const buttonType = await allButtons[i].getAttribute('type') || 'button';
          console.log(`  Button ${i}: "${buttonText.trim()}" (type: ${buttonType})`);
        }
      }
    } else {
      console.log('❌ Could not find required form fields');
      console.log(`   Username field found: ${!!usernameField}`);
      console.log(`   Password field found: ${!!passwordField}`);
    }
    
    // Step 2: Navigate to the specific note detail page
    console.log('🎯 Step 2: Navigating to note detail page...');
    await page.goto('http://localhost:3011/notes/15');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    const finalUrl = page.url();
    console.log('📍 Final URL:', finalUrl);
    
    if (finalUrl.includes('/notes/15')) {
      console.log('✅ Successfully accessed note 15 detail page');
      
      // Take screenshot
      await page.screenshot({ path: 'note-15-detail-authenticated.png', fullPage: true });
      
      // Check for our debug logs
      const audioUtilsLogs = logs.filter(log => log.includes('[audioUtils]'));
      const detailPageLogs = logs.filter(log => log.includes('[NoteDetailPage]'));
      
      console.log(`📊 Audio debug logs: ${audioUtilsLogs.length} audioUtils + ${detailPageLogs.length} NoteDetailPage`);
      
      // Check for audio elements
      const audioElements = await page.locator('audio').count();
      const noAudioMessage = await page.locator('text="Audio file not available"').count();
      
      console.log(`🎵 Audio elements found: ${audioElements}`);
      console.log(`${noAudioMessage === 0 ? '✅' : '❌'} Audio status: ${noAudioMessage === 0 ? 'Available' : 'Not Available'}`);
      
      if (noAudioMessage > 0) {
        // Look for debug info
        const debugText = await page.locator('text=/Debug:.*audio_url=.*audio_file=/').textContent().catch(() => null);
        if (debugText) {
          console.log('🔍 Debug info:', debugText);
        }
      }
      
      // Look for play buttons
      const playButtons = await page.locator('button:has-text("Play"), [data-testid*="play"]').count();
      console.log(`▶️  Play buttons found: ${playButtons}`);
      
    } else if (finalUrl.includes('/login')) {
      console.log('❌ Redirected back to login - authentication failed');
    } else {
      console.log('🤔 Unexpected final URL:', finalUrl);
    }
    
    console.log('🏁 Login then note detail test completed');
  });
});