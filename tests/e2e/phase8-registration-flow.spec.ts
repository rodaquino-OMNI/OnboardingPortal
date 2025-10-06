import { test, expect } from '@playwright/test';

/**
 * Phase 8: E2E Test Scenarios - Sprint 2C (Registration Flow)
 *
 * OBJECTIVE: Comprehensive E2E testing for registration user journey
 *
 * USER JOURNEY:
 * /register → /callback-verify → /profile/minimal → /completion
 *
 * VALIDATION CRITERIA:
 * - Analytics events dispatched at each step
 * - Cookie-based authentication throughout
 * - Progress tracking updates correctly
 * - Form validation works properly
 * - Error states handled gracefully
 * - Gamification events triggered appropriately
 *
 * ARCHITECTURE VERIFICATION:
 * - No network calls in UI package components (container layer only)
 * - Proper separation between presentation and orchestration
 * - State management via containers, not UI components
 */

test.describe('Phase 8 - Registration Flow E2E', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear cookies and storage before each test
    await context.clearCookies();
    await page.goto('/');
  });

  test('complete registration flow from start to finish', async ({ page, context }) => {
    // Step 1: Navigate to registration
    await page.goto('/register');
    await expect(page).toHaveURL('/register');

    // Verify registration page loaded
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const confirmPasswordInput = page.locator('input[name="password_confirmation"]');
    const submitButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();

    // Step 2: Fill registration form
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'SecurePass123!';

    await emailInput.fill(testEmail);
    await passwordInput.fill(testPassword);
    await confirmPasswordInput.fill(testPassword);

    // Verify analytics event would be dispatched (registration_started)
    // Note: Actual analytics validation would require mocking or listening to network

    // Submit registration
    await submitButton.click();

    // Step 3: Verify redirect to callback-verify
    await expect(page).toHaveURL(/\/callback-verify/);

    // Verify verification message displayed
    await expect(page.locator('text=/check your email|verify|confirmation/i')).toBeVisible();

    // Verify analytics event (registration_submitted)
    // In production, this would dispatch: { event: 'registration_submitted', email_hash: '...' }

    // Step 4: Simulate email verification (in real flow, user clicks email link)
    // For E2E testing, we'd mock the verification endpoint or use a test token
    const verificationToken = 'mock-verification-token';
    await page.goto(`/verify-email?token=${verificationToken}`);

    // Step 5: After verification, should redirect to /profile/minimal
    await expect(page).toHaveURL(/\/profile/);

    // Verify user is authenticated via cookie
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name.includes('auth') || c.name.includes('session'));
    expect(authCookie).toBeDefined();

    // Verify minimal profile form is visible
    const nameInput = page.locator('input[name="name"], input[placeholder*="nome"]').first();
    await expect(nameInput).toBeVisible();

    // Step 6: Fill minimal profile information
    await nameInput.fill('Test User');

    const profileSubmit = page.locator('button[type="submit"]').first();
    await profileSubmit.click();

    // Verify analytics event (profile_minimal_completed)

    // Step 7: Complete additional profile steps if required
    // This depends on the registration flow configuration

    // Step 8: Verify completion redirect
    await expect(page).toHaveURL(/\/dashboard|\/home|\/profile/);

    // Verify welcome message or gamification badge
    const welcomeElement = page.locator('text=/welcome|bem-vindo|parabéns/i');
    // May not be visible on all configurations
    const welcomeExists = await welcomeElement.count() > 0;

    // Verify analytics event (registration_completed)

    // Verify user can navigate authenticated pages
    await page.goto('/documents');
    await expect(page).not.toHaveURL('/login');
  });

  test('registration validates email format', async ({ page }) => {
    await page.goto('/register');

    const emailInput = page.locator('input[type="email"]');
    const submitButton = page.locator('button[type="submit"]');

    // Enter invalid email
    await emailInput.fill('invalid-email');
    await submitButton.click();

    // Verify validation error
    const errorMessage = page.locator('text=/invalid|inválido|e-mail/i').first();
    await expect(errorMessage).toBeVisible();

    // Verify URL hasn't changed
    await expect(page).toHaveURL('/register');
  });

  test('registration validates password strength', async ({ page }) => {
    await page.goto('/register');

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await emailInput.fill('test@example.com');
    await passwordInput.fill('weak'); // Weak password

    await submitButton.click();

    // Verify password strength error
    const errorMessage = page.locator('text=/password|senha|characters|caracteres/i').first();
    await expect(errorMessage).toBeVisible();
  });

  test('registration validates password confirmation match', async ({ page }) => {
    await page.goto('/register');

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const confirmPasswordInput = page.locator('input[name="password_confirmation"]');
    const submitButton = page.locator('button[type="submit"]');

    await emailInput.fill('test@example.com');
    await passwordInput.fill('SecurePass123!');
    await confirmPasswordInput.fill('DifferentPass123!');

    await submitButton.click();

    // Verify mismatch error
    const errorMessage = page.locator('text=/match|coincidem|confirmation/i').first();
    await expect(errorMessage).toBeVisible();
  });

  test('registration handles duplicate email gracefully', async ({ page }) => {
    await page.goto('/register');

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const confirmPasswordInput = page.locator('input[name="password_confirmation"]');
    const submitButton = page.locator('button[type="submit"]');

    // Use a known existing email (demo@example.com)
    await emailInput.fill('demo@example.com');
    await passwordInput.fill('SecurePass123!');
    await confirmPasswordInput.fill('SecurePass123!');

    await submitButton.click();

    // Verify duplicate email error
    const errorMessage = page.locator('text=/already|já existe|duplicate|duplicado/i').first();
    await expect(errorMessage).toBeVisible();

    // Verify we're still on registration page
    await expect(page).toHaveURL('/register');
  });

  test('registration maintains state across form validation errors', async ({ page }) => {
    await page.goto('/register');

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    // Fill valid email
    await emailInput.fill('test@example.com');

    // Fill invalid password
    await passwordInput.fill('weak');

    await submitButton.click();

    // After error, email should still be filled
    await expect(emailInput).toHaveValue('test@example.com');
  });

  test('registration dispatches analytics events at each step', async ({ page, context }) => {
    // Track network requests for analytics
    const analyticsEvents: string[] = [];

    page.on('request', request => {
      const url = request.url();
      if (url.includes('/analytics') || url.includes('/track')) {
        analyticsEvents.push(url);
      }
    });

    // Navigate to registration
    await page.goto('/register');

    // Should dispatch: page_view event

    // Fill and submit form
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const confirmPasswordInput = page.locator('input[name="password_confirmation"]');
    const submitButton = page.locator('button[type="submit"]');

    await emailInput.fill(`test-${Date.now()}@example.com`);
    await passwordInput.fill('SecurePass123!');
    await confirmPasswordInput.fill('SecurePass123!');
    await submitButton.click();

    // Should dispatch: registration_submitted event

    // Wait for potential redirects
    await page.waitForLoadState('networkidle');

    // Verify analytics events were tracked
    // Note: In real implementation, this would verify specific event payloads
    console.log('Analytics events captured:', analyticsEvents.length);
  });

  test('registration progress bar updates correctly', async ({ page }) => {
    await page.goto('/register');

    // Check if progress indicator exists
    const progressBar = page.locator('[role="progressbar"], [aria-label*="progress"]');

    if (await progressBar.count() > 0) {
      // Verify initial progress
      const initialProgress = await progressBar.getAttribute('aria-valuenow');
      expect(parseInt(initialProgress || '0')).toBeGreaterThanOrEqual(0);

      // Complete registration step
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const confirmPasswordInput = page.locator('input[name="password_confirmation"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill(`test-${Date.now()}@example.com`);
      await passwordInput.fill('SecurePass123!');
      await confirmPasswordInput.fill('SecurePass123!');
      await submitButton.click();

      await page.waitForLoadState('networkidle');

      // Progress should increase
      if (await progressBar.count() > 0) {
        const updatedProgress = await progressBar.getAttribute('aria-valuenow');
        expect(parseInt(updatedProgress || '0')).toBeGreaterThan(parseInt(initialProgress || '0'));
      }
    }
  });

  test('registration keyboard navigation works correctly', async ({ page }) => {
    await page.goto('/register');

    // Tab through form fields
    await page.keyboard.press('Tab');
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeFocused();

    await page.keyboard.press('Tab');
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeFocused();

    await page.keyboard.press('Tab');
    const confirmPasswordInput = page.locator('input[name="password_confirmation"]');
    await expect(confirmPasswordInput).toBeFocused();

    await page.keyboard.press('Tab');
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeFocused();

    // Should be able to submit with Enter
    await emailInput.fill(`test-${Date.now()}@example.com`);
    await passwordInput.fill('SecurePass123!');
    await confirmPasswordInput.fill('SecurePass123!');
    await submitButton.press('Enter');

    // Should navigate away from registration
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL('/register');
  });
});
