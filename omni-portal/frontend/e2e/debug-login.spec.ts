import { test, expect } from '@playwright/test';

test('debug login with network monitoring', async ({ page }) => {
  console.log('🔍 Debug Login Test with Network Monitoring');
  
  // Enable request/response logging
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      console.log('➡️  Request:', request.method(), request.url());
      console.log('   Headers:', request.headers());
      if (request.postData()) {
        console.log('   Body:', request.postData());
      }
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log('⬅️  Response:', response.status(), response.url());
      response.text().then(text => {
        console.log('   Body:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
      }).catch(() => {});
    }
  });
  
  // Go to login page
  await page.goto('/login');
  console.log('✅ Login page loaded');
  
  // Fill credentials
  await page.fill('input[name="login"]', 'demo@example.com');
  await page.fill('input[name="password"]', 'DemoPass123!');
  console.log('✅ Credentials filled');
  
  // Click submit and wait for network
  const responsePromise = page.waitForResponse(resp => resp.url().includes('/auth/login'), { timeout: 10000 });
  await page.click('button[type="submit"]');
  console.log('✅ Login button clicked');
  
  try {
    const response = await responsePromise;
    console.log('📥 Login API Response Status:', response.status());
    const responseBody = await response.json();
    console.log('📥 Login API Response:', JSON.stringify(responseBody, null, 2));
  } catch (error) {
    console.log('❌ No login API response received:', error);
  }
  
  // Wait a bit for any redirects
  await page.waitForTimeout(3000);
  
  // Check final state
  const currentUrl = page.url();
  console.log('📍 Final URL:', currentUrl);
  
  // Check for any console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('🚨 Console Error:', msg.text());
    }
  });
  
  // Check localStorage
  const localStorage = await page.evaluate(() => {
    return Object.keys(window.localStorage).reduce((acc, key) => {
      acc[key] = window.localStorage.getItem(key);
      return acc;
    }, {} as Record<string, string | null>);
  });
  console.log('💾 localStorage:', localStorage);
  
  // Check cookies
  const cookies = await page.context().cookies();
  console.log('🍪 Cookies:', cookies.map(c => ({ name: c.name, value: c.value.substring(0, 20) + '...' })));
});