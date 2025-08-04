import { test, expect } from '@playwright/test';

test('test home page after login', async ({ page }) => {
  console.log('🏠 Testing Home Page After Login');
  
  // Monitor console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('🚨 Console Error:', msg.text());
    }
  });
  
  // First login
  await page.goto('/login');
  await page.fill('input[name="login"]', 'demo@example.com');
  await page.fill('input[name="password"]', 'DemoPass123!');
  await page.click('button[type="submit"]');
  
  // Wait for login to complete
  await page.waitForTimeout(3000);
  
  // Try to navigate to home directly
  console.log('🔄 Navigating to /home directly');
  await page.goto('/home');
  
  // Wait for page to load
  await page.waitForTimeout(2000);
  
  // Check where we are
  const currentUrl = page.url();
  console.log('📍 Current URL:', currentUrl);
  
  // Take screenshot
  await page.screenshot({ path: 'home-page-state.png' });
  
  // Check if we're authenticated by looking for user info
  const pageContent = await page.content();
  console.log('Page contains "João":', pageContent.includes('João'));
  console.log('Page contains "demo@example.com":', pageContent.includes('demo@example.com'));
  console.log('Page contains "2850":', pageContent.includes('2850')); // points
  
  // Try to access telemedicine directly
  console.log('\n🔄 Navigating to /telemedicine-schedule directly');
  await page.goto('/telemedicine-schedule');
  await page.waitForTimeout(2000);
  
  const telemedicineUrl = page.url();
  console.log('📍 Telemedicine URL:', telemedicineUrl);
  
  // Take screenshot
  await page.screenshot({ path: 'telemedicine-page-direct.png' });
});