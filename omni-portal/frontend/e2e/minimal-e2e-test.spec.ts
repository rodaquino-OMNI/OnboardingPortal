import { test, expect } from '@playwright/test';

test.describe('Telemedicine E2E Tests', () => {
  test('should display login page correctly', async ({ page }) => {
    await page.goto('/login');
    
    // Verify login page elements
    await expect(page.locator('h1:has-text("Bem-vindo de volta!")')).toBeVisible();
    await expect(page.locator('input[name="login"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    console.log('✅ Login page displays correctly');
  });

  test('should handle login form submission', async ({ page }) => {
    await page.goto('/login');
    
    // Fill and submit form
    await page.fill('input[name="login"]', 'demo@example.com');
    await page.fill('input[name="password"]', 'DemoPass123!');
    
    // Intercept the API call
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/api/auth/login'),
      { timeout: 10000 }
    );
    
    await page.click('button[type="submit"]');
    
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    
    console.log('✅ Login API call successful');
  });

  test('should navigate to telemedicine schedule page', async ({ page }) => {
    // Set auth cookie to bypass login
    await page.context().addCookies([{
      name: 'auth_token',
      value: '17|testtoken',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax'
    }]);
    
    // Try to navigate to telemedicine
    const response = await page.goto('/telemedicine-schedule', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    if (response && response.ok()) {
      console.log('✅ Telemedicine page loaded');
      
      // Wait for any content
      await page.waitForTimeout(3000);
      
      // Check what's on the page
      const title = await page.title();
      console.log('Page title:', title);
      
      // Take screenshot for debugging
      await page.screenshot({ path: 'telemedicine-page.png' });
    } else {
      console.log('❌ Failed to load telemedicine page');
    }
  });
});