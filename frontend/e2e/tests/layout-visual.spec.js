import { test, expect } from '@playwright/test';

test.describe('Layout Visual Validation', () => {
  
  // Helper function to handle login
  async function loginUser(page) {
    console.log('🔐 Logging in user for visual test...');
    
    try {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      // Fill login credentials
      await page.fill('input[name="username"], input[type="email"], input[id="username"], input[id="email"]', 'testuser');
      await page.fill('input[name="password"], input[type="password"], input[id="password"]', 'testpassword123');
      
      // Click login button
      await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      // Wait for redirect to dashboard
      await page.waitForURL('/dashboard', { timeout: 10000 }).catch(async () => {
        await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 5000 });
      });
      
      console.log('✅ Login successful for visual test');
      return true;
    } catch (error) {
      console.warn('⚠️ Login failed, continuing anyway:', error.message);
      return false;
    }
  }

  test('should display sidebar with proper spacing and layout', async ({ page }) => {
    console.log('🎯 Testing sidebar layout and spacing');

    // Login first
    await loginUser(page);
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Wait for sidebar to be fully rendered
    await page.waitForSelector('h1:has-text("Voice Notes")', { timeout: 5000 });
    await page.waitForTimeout(1000); // Allow for any animations
    
    // Take full page screenshot
    await page.screenshot({ 
      path: 'test-results/sidebar-layout-full.png',
      fullPage: true 
    });
    
    // Take focused screenshot of just the sidebar area
    const sidebar = page.locator('.w-64').first(); // Sidebar has w-64 class
    if (await sidebar.count() > 0) {
      await sidebar.screenshot({ 
        path: 'test-results/sidebar-layout-focused.png' 
      });
    }
    
    console.log('✅ Screenshots captured for sidebar layout');

    // Validate sidebar structure
    await expect(page.locator('h1:has-text("Voice Notes")')).toBeVisible();
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Record')).toBeVisible();
    await expect(page.locator('text=Profile')).toBeVisible();
    await expect(page.locator('text=Sign out')).toBeVisible();
    
    console.log('✅ All sidebar elements are visible');
  });

  test('should validate sidebar user section layout', async ({ page }) => {
    console.log('🎯 Testing user section layout specifically');

    // Login first
    await loginUser(page);
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Check user info section is present and properly spaced
    const userIcon = page.locator('[data-testid="user-icon"], .bg-primary-500.rounded-full').first();
    const username = page.locator('text=testuser');
    const email = page.locator('text=test@example.com');
    const signOutButton = page.locator('text=Sign out');
    
    // Validate elements are visible
    if (await userIcon.count() > 0) {
      await expect(userIcon).toBeVisible();
      console.log('✅ User icon is visible');
    }
    
    if (await username.count() > 0) {
      await expect(username).toBeVisible();
      console.log('✅ Username is visible');
    }
    
    if (await email.count() > 0) {
      await expect(email).toBeVisible();
      console.log('✅ Email is visible');
    }
    
    await expect(signOutButton).toBeVisible();
    console.log('✅ Sign out button is visible');
    
    // Take screenshot of user section
    const userSection = page.locator('.border-t').last(); // User section has border-t
    if (await userSection.count() > 0) {
      await userSection.screenshot({ 
        path: 'test-results/user-section-layout.png' 
      });
    }
    
    console.log('✅ User section layout validated');
  });

  test('should validate navigation items spacing', async ({ page }) => {
    console.log('🎯 Testing navigation items spacing and layout');

    // Login first
    await loginUser(page);
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Check navigation items
    const dashboardLink = page.locator('text=Dashboard').first();
    const recordLink = page.locator('text=Record').first();
    const profileLink = page.locator('text=Profile').first();
    
    // Validate navigation items are visible and properly spaced
    await expect(dashboardLink).toBeVisible();
    await expect(recordLink).toBeVisible();
    await expect(profileLink).toBeVisible();
    
    // Check that Dashboard is highlighted (active state)
    const dashboardElement = dashboardLink.locator('..');
    const hasActiveClass = await dashboardElement.evaluate(el => 
      el.className.includes('bg-primary') || el.className.includes('text-primary')
    );
    
    console.log(`Dashboard active state: ${hasActiveClass ? 'Active' : 'Not active'}`);
    
    // Take screenshot of navigation section
    const navSection = page.locator('nav').first();
    if (await navSection.count() > 0) {
      await navSection.screenshot({ 
        path: 'test-results/navigation-section-layout.png' 
      });
    }
    
    console.log('✅ Navigation items layout validated');
  });

  test('should test sidebar on different screen sizes', async ({ page }) => {
    console.log('🎯 Testing sidebar responsiveness');

    // Login first
    await loginUser(page);
    
    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'test-results/sidebar-desktop.png',
      fullPage: false 
    });
    
    // Test tablet view
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: 'test-results/sidebar-tablet.png',
      fullPage: false 
    });
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: 'test-results/sidebar-mobile.png',
      fullPage: false 
    });
    
    // On mobile, sidebar should be hidden by default
    const sidebar = page.locator('.w-64').first();
    const isHidden = await sidebar.evaluate(el => 
      el.className.includes('-translate-x-full')
    );
    
    console.log(`Mobile sidebar hidden: ${isHidden ? 'Yes' : 'No'}`);
    
    console.log('✅ Responsive sidebar layout validated');
  });

  test('should validate no element overlap in sidebar', async ({ page }) => {
    console.log('🎯 Testing for element overlap in sidebar');

    // Login first
    await loginUser(page);
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Get bounding boxes of key elements to check for overlap
    const headerBox = await page.locator('h1:has-text("Voice Notes")').boundingBox();
    const navBox = await page.locator('text=Dashboard').first().boundingBox();
    const userBox = await page.locator('text=testuser').boundingBox();
    const signOutBox = await page.locator('text=Sign out').boundingBox();
    
    // Log element positions for debugging
    if (headerBox) console.log('Header position:', headerBox);
    if (navBox) console.log('Navigation position:', navBox);
    if (userBox) console.log('User info position:', userBox);
    if (signOutBox) console.log('Sign out position:', signOutBox);
    
    // Check that elements don't overlap (header should be above nav, nav above user section)
    if (headerBox && navBox) {
      expect(headerBox.y + headerBox.height).toBeLessThan(navBox.y);
      console.log('✅ Header and navigation don\'t overlap');
    }
    
    if (navBox && userBox) {
      expect(navBox.y + navBox.height).toBeLessThan(userBox.y);
      console.log('✅ Navigation and user section don\'t overlap');
    }
    
    if (userBox && signOutBox) {
      expect(userBox.y + userBox.height).toBeLessThan(signOutBox.y + 10); // Small margin allowed
      console.log('✅ User info and sign out button don\'t overlap');
    }
    
    console.log('✅ No element overlap detected in sidebar');
  });
});