import { test, expect } from '@playwright/test';

test('verify demo user login', async ({ page }) => {
  console.log('🔐 Testing demo user login');
  
  // Go to login page
  await page.goto('/login');
  
  // Take screenshot of login page
  await page.screenshot({ path: 'login-page.png' });
  
  // Fill in credentials
  await page.fill('input[name="login"]', 'demo@example.com');
  await page.fill('input[name="password"]', 'DemoPass123!');
  
  // Take screenshot before submit
  await page.screenshot({ path: 'login-filled.png' });
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait a bit for any response
  await page.waitForTimeout(5000);
  
  // Check where we are
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);
  
  // Take screenshot of result
  await page.screenshot({ path: 'login-result-final.png' });
  
  // Check for any error messages
  const errorMessages = await page.locator('.text-red-600, .bg-red-50, [class*="error"]').allTextContents();
  if (errorMessages.length > 0) {
    console.log('Error messages found:', errorMessages);
  }
  
  // Check page title or any content
  const pageTitle = await page.title();
  console.log('Page title:', pageTitle);
  
  // If we're still on login page, there might be an error
  if (currentUrl.includes('/login')) {
    console.log('❌ Still on login page - login failed');
    
    // Try to find what went wrong
    const pageContent = await page.content();
    if (pageContent.includes('credentials')) {
      console.log('Invalid credentials error');
    }
    if (pageContent.includes('server')) {
      console.log('Server error');
    }
  } else if (currentUrl.includes('/home')) {
    console.log('✅ Successfully redirected to home page');
  } else {
    console.log('🤔 Redirected to:', currentUrl);
  }
});