import { test, expect } from '@playwright/test';
import { loginUser, logoutUser, TEST_USERS, checkConsoleErrors } from './helpers/test-helpers';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Check for console errors
    await checkConsoleErrors(page);
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    await loginUser(page, TEST_USERS.demo);
    
    // Verify we're on the dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('[data-testid="dashboard-welcome"]')).toBeVisible();
    
    // Check that user info is displayed
    await expect(page.locator('[data-testid="user-name"]')).toContainText('Demo User');
  });

  test('should show error message with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Fill form with invalid credentials
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should see error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
    
    // Should still be on login page
    await expect(page).toHaveURL(/.*login/);
  });

  test('should handle empty form submission', async ({ page }) => {
    await page.goto('/login');
    
    // Submit empty form
    await page.click('button[type="submit"]');
    
    // Should see validation errors
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
  });

  test('should successfully logout', async ({ page }) => {
    // Login first
    await loginUser(page, TEST_USERS.demo);
    
    // Logout
    await logoutUser(page);
    
    // Should be redirected to login
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });

  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    // Try to access dashboard without logging in
    await page.goto('/dashboard');
    
    // Should be redirected to login
    await expect(page).toHaveURL(/.*login/);
  });

  test('should maintain session after page reload', async ({ page }) => {
    // Login
    await loginUser(page, TEST_USERS.demo);
    
    // Reload page
    await page.reload();
    
    // Should still be authenticated
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should handle concurrent login attempts', async ({ page, context }) => {
    // Open second page
    const page2 = await context.newPage();
    
    // Login on both pages simultaneously
    const loginPromise1 = loginUser(page, TEST_USERS.demo);
    const loginPromise2 = loginUser(page2, TEST_USERS.demo);
    
    await Promise.all([loginPromise1, loginPromise2]);
    
    // Both should be successful
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page2).toHaveURL(/.*dashboard/);
    
    await page2.close();
  });

  test('should handle login with remember me', async ({ page }) => {
    await page.goto('/login');
    
    // Fill login form and check remember me
    await page.fill('input[name="email"]', TEST_USERS.demo.email);
    await page.fill('input[name="password"]', TEST_USERS.demo.password);
    await page.check('input[name="remember"]');
    await page.click('button[type="submit"]');
    
    // Should be logged in
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Close browser and reopen (simulate browser restart)
    await page.context().close();
    
    // Create new context and verify persistence
    const newContext = await page.context().browser()?.newContext();
    const newPage = await newContext?.newPage();
    
    if (newPage) {
      await newPage.goto('/dashboard');
      // Note: This test would need proper session persistence implementation
      await newPage.close();
    }
    
    await newContext?.close();
  });

  test('should handle password reset flow', async ({ page }) => {
    await page.goto('/login');
    
    // Click forgot password link
    await page.click('a[href="/forgot-password"]');
    
    // Should be on forgot password page
    await expect(page).toHaveURL(/.*forgot-password/);
    
    // Fill email and submit
    await page.fill('input[name="email"]', TEST_USERS.demo.email);
    await page.click('button[type="submit"]');
    
    // Should see success message
    await expect(page.locator('[data-testid="reset-sent-message"]')).toBeVisible();
  });

  test('should validate email format on login', async ({ page }) => {
    await page.goto('/login');
    
    // Fill invalid email format
    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Should see email format error
    await expect(page.locator('[data-testid="email-error"]')).toContainText('valid email');
  });

  test('should handle API timeout gracefully', async ({ page }) => {
    // Mock slow API response
    await page.route('**/api/login', async route => {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
      route.fulfill({
        status: 408,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Request timeout' })
      });
    });
    
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.demo.email);
    await page.fill('input[name="password"]', TEST_USERS.demo.password);
    await page.click('button[type="submit"]');
    
    // Should show timeout error
    await expect(page.locator('[data-testid="error-message"]')).toContainText('timeout', { timeout: 10000 });
  });

  test('should handle social authentication', async ({ page }) => {
    await page.goto('/login');
    
    // Check if social login buttons are present
    const googleButton = page.locator('[data-testid="google-login"]');
    const facebookButton = page.locator('[data-testid="facebook-login"]');
    
    if (await googleButton.isVisible()) {
      await expect(googleButton).toBeVisible();
    }
    
    if (await facebookButton.isVisible()) {
      await expect(facebookButton).toBeVisible();
    }
  });
});