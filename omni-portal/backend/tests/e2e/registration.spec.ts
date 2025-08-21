import { test, expect } from '@playwright/test';
import { registerUser, checkConsoleErrors, takeTimestampedScreenshot } from './helpers/test-helpers';

test.describe('Multi-Step Registration Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Check for console errors
    await checkConsoleErrors(page);
  });

  test('should complete full registration flow successfully', async ({ page }) => {
    const timestamp = Date.now();
    const userData = {
      name: `Test User ${timestamp}`,
      email: `test${timestamp}@example.com`,
      password: 'SecurePassword123!',
      cpf: '12345678901',
      company: 'Test Company'
    };

    await registerUser(page, userData);
    
    // Verify successful registration
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-name"]')).toContainText(userData.name);
  });

  test('should validate step 1 - basic information', async ({ page }) => {
    await page.goto('/register');
    
    // Try to proceed without filling required fields
    await page.click('button[data-testid="next-step"]');
    
    // Should see validation errors
    await expect(page.locator('[data-testid="name-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="cpf-error"]')).toBeVisible();
  });

  test('should validate email format in step 1', async ({ page }) => {
    await page.goto('/register');
    
    // Fill invalid email
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="cpf"]', '12345678901');
    await page.click('button[data-testid="next-step"]');
    
    // Should see email format error
    await expect(page.locator('[data-testid="email-error"]')).toContainText('valid email');
  });

  test('should validate CPF format in step 1', async ({ page }) => {
    await page.goto('/register');
    
    // Fill invalid CPF
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="cpf"]', '123'); // Too short
    await page.click('button[data-testid="next-step"]');
    
    // Should see CPF format error
    await expect(page.locator('[data-testid="cpf-error"]')).toContainText('valid CPF');
  });

  test('should check for duplicate email in step 1', async ({ page }) => {
    await page.goto('/register');
    
    // Fill with existing user email
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'demo@example.com'); // Existing user
    await page.fill('input[name="cpf"]', '12345678901');
    await page.click('button[data-testid="next-step"]');
    
    // Should see duplicate email error
    await expect(page.locator('[data-testid="email-error"]')).toContainText('already registered');
  });

  test('should validate step 2 - password requirements', async ({ page }) => {
    await page.goto('/register');
    
    // Complete step 1
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', `test${Date.now()}@example.com`);
    await page.fill('input[name="cpf"]', '12345678901');
    await page.click('button[data-testid="next-step"]');
    
    // Wait for step 2
    await page.waitForSelector('[data-testid="register-step-2"]');
    
    // Try weak password
    await page.fill('input[name="password"]', '123');
    await page.fill('input[name="password_confirmation"]', '123');
    await page.click('button[data-testid="next-step"]');
    
    // Should see password strength error
    await expect(page.locator('[data-testid="password-error"]')).toContainText('8 characters');
  });

  test('should validate password confirmation match', async ({ page }) => {
    await page.goto('/register');
    
    // Complete step 1
    const timestamp = Date.now();
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', `test${timestamp}@example.com`);
    await page.fill('input[name="cpf"]', '12345678901');
    await page.click('button[data-testid="next-step"]');
    
    // Wait for step 2
    await page.waitForSelector('[data-testid="register-step-2"]');
    
    // Fill mismatched passwords
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.fill('input[name="password_confirmation"]', 'DifferentPassword123!');
    await page.click('button[data-testid="next-step"]');
    
    // Should see password mismatch error
    await expect(page.locator('[data-testid="password-confirmation-error"]')).toContainText('match');
  });

  test('should allow going back to previous steps', async ({ page }) => {
    await page.goto('/register');
    
    // Complete step 1
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', `test${Date.now()}@example.com`);
    await page.fill('input[name="cpf"]', '12345678901');
    await page.click('button[data-testid="next-step"]');
    
    // Go to step 2
    await page.waitForSelector('[data-testid="register-step-2"]');
    
    // Go back to step 1
    await page.click('button[data-testid="previous-step"]');
    
    // Should be back on step 1 with preserved data
    await expect(page.locator('[data-testid="register-step-1"]')).toBeVisible();
    await expect(page.locator('input[name="name"]')).toHaveValue('Test User');
  });

  test('should handle step 3 - company information (optional)', async ({ page }) => {
    const timestamp = Date.now();
    
    await page.goto('/register');
    
    // Complete step 1
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', `test${timestamp}@example.com`);
    await page.fill('input[name="cpf"]', '12345678901');
    await page.click('button[data-testid="next-step"]');
    
    // Complete step 2
    await page.waitForSelector('[data-testid="register-step-2"]');
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.fill('input[name="password_confirmation"]', 'SecurePassword123!');
    await page.click('button[data-testid="next-step"]');
    
    // Step 3 should be visible
    await page.waitForSelector('[data-testid="register-step-3"]');
    
    // Company field should be optional
    await page.click('button[data-testid="complete-registration"]');
    
    // Should complete successfully even without company
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });
  });

  test('should show progress indicator during registration', async ({ page }) => {
    await page.goto('/register');
    
    // Should show step 1 as active
    await expect(page.locator('[data-testid="step-indicator-1"]')).toHaveClass(/active/);
    await expect(page.locator('[data-testid="step-indicator-2"]')).not.toHaveClass(/active/);
    await expect(page.locator('[data-testid="step-indicator-3"]')).not.toHaveClass(/active/);
    
    // Complete step 1
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', `test${Date.now()}@example.com`);
    await page.fill('input[name="cpf"]', '12345678901');
    await page.click('button[data-testid="next-step"]');
    
    // Should show step 2 as active
    await expect(page.locator('[data-testid="step-indicator-1"]')).toHaveClass(/completed/);
    await expect(page.locator('[data-testid="step-indicator-2"]')).toHaveClass(/active/);
  });

  test('should handle registration API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/register', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal server error' })
      });
    });
    
    const timestamp = Date.now();
    const userData = {
      name: `Test User ${timestamp}`,
      email: `test${timestamp}@example.com`,
      password: 'SecurePassword123!',
      cpf: '12345678901'
    };

    await page.goto('/register');
    
    // Complete all steps
    await page.fill('input[name="name"]', userData.name);
    await page.fill('input[name="email"]', userData.email);
    await page.fill('input[name="cpf"]', userData.cpf);
    await page.click('button[data-testid="next-step"]');
    
    await page.waitForSelector('[data-testid="register-step-2"]');
    await page.fill('input[name="password"]', userData.password);
    await page.fill('input[name="password_confirmation"]', userData.password);
    await page.click('button[data-testid="next-step"]');
    
    await page.waitForSelector('[data-testid="register-step-3"]');
    await page.click('button[data-testid="complete-registration"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('server error');
  });

  test('should validate form data persistence across steps', async ({ page }) => {
    const userData = {
      name: 'Test User Persistence',
      email: `persistence${Date.now()}@example.com`,
      cpf: '12345678901',
      password: 'SecurePassword123!'
    };

    await page.goto('/register');
    
    // Fill step 1
    await page.fill('input[name="name"]', userData.name);
    await page.fill('input[name="email"]', userData.email);
    await page.fill('input[name="cpf"]', userData.cpf);
    await page.click('button[data-testid="next-step"]');
    
    // Fill step 2
    await page.waitForSelector('[data-testid="register-step-2"]');
    await page.fill('input[name="password"]', userData.password);
    await page.fill('input[name="password_confirmation"]', userData.password);
    
    // Go back to step 1
    await page.click('button[data-testid="previous-step"]');
    
    // Verify data is preserved
    await expect(page.locator('input[name="name"]')).toHaveValue(userData.name);
    await expect(page.locator('input[name="email"]')).toHaveValue(userData.email);
    await expect(page.locator('input[name="cpf"]')).toHaveValue(userData.cpf);
    
    // Go forward again
    await page.click('button[data-testid="next-step"]');
    
    // Password fields should be cleared for security
    await expect(page.locator('input[name="password"]')).toHaveValue('');
    await expect(page.locator('input[name="password_confirmation"]')).toHaveValue('');
  });

  test('should handle mobile registration flow', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip(); // Only run on mobile devices
    }

    await takeTimestampedScreenshot(page, 'mobile-registration-start');
    
    const timestamp = Date.now();
    const userData = {
      name: `Mobile User ${timestamp}`,
      email: `mobile${timestamp}@example.com`,
      password: 'SecurePassword123!',
      cpf: '12345678901'
    };

    await registerUser(page, userData);
    
    await takeTimestampedScreenshot(page, 'mobile-registration-complete');
    
    // Verify mobile-specific elements
    await expect(page.locator('[data-testid="mobile-progress-bar"]')).toBeVisible();
  });
});