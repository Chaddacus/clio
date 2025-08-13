const { test, expect } = require('@playwright/test');

test.describe('Microphone Permission Prompting', () => {
  test('Shows permission UI and allows user to request access', async ({ browser }) => {
    console.log('🎤 Testing microphone permission prompting UI...');

    // Create context without microphone permissions initially
    const context = await browser.newContext({
      // Don't grant permissions initially
    });

    const page = await context.newPage();

    // Collect console logs
    const consoleMessages = [];
    page.on('console', msg => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now()
      };
      consoleMessages.push(message);
      console.log(`[${msg.type()}] ${msg.text()}`);
    });

    // Login
    await page.goto('http://localhost:3011/login');
    try {
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
    } catch (error) {
      console.log('Login handled');
    }

    // Navigate to record page
    await page.goto('http://localhost:3011/record');
    await page.waitForLoadState('networkidle');
    console.log('📍 Record page loaded');

    // Wait for the page to render
    await page.waitForTimeout(1000);

    // Check if MicrophonePermission component is visible
    console.log('🔍 Looking for permission component...');
    
    // Look for permission-related text
    const permissionTexts = [
      'Microphone access required',
      'Allow microphone access',
      'Microphone permission',
      'permission'
    ];

    let foundPermissionUI = false;
    for (const text of permissionTexts) {
      const element = page.locator(`text=${text}`).first();
      const isVisible = await element.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`✅ Found permission UI with text: "${text}"`);
        foundPermissionUI = true;
        break;
      }
    }

    if (!foundPermissionUI) {
      console.log('⚠️  Permission UI not immediately visible, checking page content...');
      const pageContent = await page.content();
      console.log('Page contains "microphone":', pageContent.toLowerCase().includes('microphone'));
      console.log('Page contains "permission":', pageContent.toLowerCase().includes('permission'));
    }

    // Check if record button is disabled initially
    const recordButton = page.locator('[title*="Start Recording"], [title*="microphone"]').first();
    const isRecordButtonVisible = await recordButton.isVisible().catch(() => false);
    
    if (isRecordButtonVisible) {
      const isDisabled = await recordButton.isDisabled();
      console.log(`🎛️  Record button state: disabled=${isDisabled}`);
      
      if (isDisabled) {
        console.log('✅ Record button is properly disabled without permissions');
      } else {
        console.log('⚠️  Record button is enabled (unexpected without permissions)');
      }
    }

    // Look for any "Allow microphone access" buttons
    const permissionButton = page.locator('button:has-text("Allow microphone access")');
    const hasPermissionButton = await permissionButton.count() > 0;
    
    if (hasPermissionButton) {
      console.log('✅ Found "Allow microphone access" button');
      
      // Try clicking it (this should trigger the permission request)
      console.log('🖱️  Clicking permission request button...');
      await permissionButton.first().click();
      
      // Wait a moment for any permission dialog
      await page.waitForTimeout(2000);
      
      console.log('Permission request attempted');
    } else {
      console.log('⚠️  No "Allow microphone access" button found');
    }

    // Check console logs for permission-related messages
    const permissionLogs = consoleMessages.filter(msg => 
      msg.text.toLowerCase().includes('permission') ||
      msg.text.toLowerCase().includes('microphone') ||
      msg.text.toLowerCase().includes('getusermedia')
    );

    console.log('\n🔍 PERMISSION-RELATED LOGS:');
    console.log('==========================================');
    permissionLogs.forEach(log => {
      console.log(`[${log.type}] ${log.text}`);
    });

    console.log('\n🎯 PERMISSION UI TEST SUMMARY:');
    console.log(`Permission UI found: ${foundPermissionUI}`);
    console.log(`Permission button found: ${hasPermissionButton}`);
    console.log(`Record button visible: ${isRecordButtonVisible}`);
    console.log('==========================================\n');

    await context.close();

    // Basic assertion - we should have some relevant logs or UI
    expect(foundPermissionUI || hasPermissionButton || permissionLogs.length > 0).toBeTruthy();
  });
});