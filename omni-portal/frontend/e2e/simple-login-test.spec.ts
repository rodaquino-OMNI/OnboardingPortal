import { test, expect } from '@playwright/test';

test('simple login test', async ({ page }) => {
  // Go to login page
  await page.goto('/login');
  
  // Check if we're on the login page
  await expect(page.locator('h1:has-text("Bem-vindo de volta!")')).toBeVisible();
  
  // Fill in the form
  await page.fill('input[name="login"]', 'demo@example.com');
  await page.fill('input[name="password"]', 'DemoPass123!');
  
  // Click login button
  await page.click('button[type="submit"]');
  
  // Wait for any response - let's see what happens
  await page.waitForTimeout(3000);
  
  // Check current URL
  const currentUrl = page.url();
  console.log('Current URL after login:', currentUrl);
  
  // Take a screenshot for debugging
  await page.screenshot({ path: 'login-result.png' });
  
  // Try to find any success or error message
  const pageContent = await page.content();
  console.log('Page contains "error":', pageContent.toLowerCase().includes('error'));
  console.log('Page contains "bem-vindo":', pageContent.toLowerCase().includes('bem-vindo'));
});