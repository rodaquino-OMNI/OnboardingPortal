import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('should load login page within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    console.log(`Login page load time: ${loadTime}ms`);
    
    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
    
    // Check if main elements are visible
    await expect(page.locator('h1').filter({ hasText: 'Bem-vindo de volta!' })).toBeVisible();
    await expect(page.locator('input[id="login"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
  });

  test('should handle form interactions smoothly', async ({ page }) => {
    await page.goto('/login');
    
    const startTime = Date.now();
    
    // Fill form fields
    await page.fill('input[id="login"]', 'test@example.com');
    await page.fill('input[id="password"]', 'password123');
    
    // Click submit and measure response time
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000); // Give time for any immediate feedback
    
    const responseTime = Date.now() - startTime;
    console.log(`Form interaction time: ${responseTime}ms`);
    
    // Form should respond within 3 seconds
    expect(responseTime).toBeLessThan(3000);
  });

  test('should not have console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Interact with the form
    await page.fill('input[id="login"]', 'test@example.com');
    await page.fill('input[id="password"]', 'password123');
    
    console.log('Console errors found:', consoleErrors);
    
    // Filter out non-critical errors (like network errors for missing APIs)
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('fetch') && 
      !error.includes('404') && 
      !error.includes('Failed to load resource')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});