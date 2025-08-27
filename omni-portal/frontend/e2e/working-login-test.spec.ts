import { test, expect } from '@playwright/test';

test.describe('Working Login Tests', () => {
  test('should display login page correctly', async ({ page }) => {
    await page.goto('/login');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check heading using text content (not exact selector)
    await expect(page.getByText('Bem-vindo de volta!')).toBeVisible();
    
    // Check form elements are present
    await expect(page.locator('#login')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Take screenshot for verification
    await page.screenshot({ path: 'test-results/login-page-loaded.png' });
  });

  test('should handle form interaction', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Fill the form
    await page.fill('#login', 'demo@example.com');
    await page.fill('#password', 'DemoPass123!');
    
    // Verify fields are filled
    await expect(page.locator('#login')).toHaveValue('demo@example.com');
    await expect(page.locator('#password')).toHaveValue('DemoPass123!');
    
    // Take screenshot before submit
    await page.screenshot({ path: 'test-results/form-filled.png' });
    
    // Click submit button
    await page.click('button[type="submit"]');
    
    // Wait a moment for any response
    await page.waitForTimeout(2000);
    
    // Take screenshot after submit
    await page.screenshot({ path: 'test-results/after-submit.png' });
    
    // Just verify we didn't crash
    const hasError = await page.locator('text=Error').isVisible();
    expect(hasError).toBe(false);
  });

  test('should show page metadata correctly', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Check page title
    const title = await page.title();
    expect(title).toContain('Login');
    
    // Check meta description
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toContain('login');
  });
});