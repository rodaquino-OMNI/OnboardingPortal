import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y, getViolations } from 'axe-playwright';

/**
 * Accessibility Tests - WCAG 2.1 AA Compliance
 *
 * Tests critical user journeys for accessibility issues:
 * - Keyboard navigation
 * - Screen reader support
 * - Color contrast
 * - ARIA attributes
 * - Focus management
 */

test.describe('Accessibility - WCAG 2.1 AA Compliance', () => {
  test.beforeEach(async ({ page }) => {
    // Inject axe-core accessibility testing library
    await injectAxe(page);
  });

  test('registration page meets WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/register');

    // Run axe accessibility checks
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
      rules: {
        // Enforce critical rules
        'color-contrast': { enabled: true },
        'label': { enabled: true },
        'button-name': { enabled: true },
        'link-name': { enabled: true },
      },
    });

    // Verify specific accessibility features
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('aria-label');
    await expect(emailInput).toHaveAttribute('aria-required', 'true');

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toHaveAttribute('aria-label');
    await expect(passwordInput).toHaveAttribute('aria-required', 'true');
  });

  test('progress header meets WCAG 2.1 AA', async ({ page }) => {
    // Login first to see progress header
    await page.goto('/login');
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/profile');

    // Check progress header accessibility
    await checkA11y(page.locator('header'), null, {
      rules: {
        'color-contrast': { enabled: true },
        'aria-required-attr': { enabled: true },
        'landmark-one-main': { enabled: true },
      },
    });

    // Verify ARIA landmarks
    const header = page.locator('[role="banner"]');
    await expect(header).toBeVisible();

    const main = page.locator('[role="main"]');
    await expect(main).toBeVisible();
  });

  test('keyboard navigation works for registration form', async ({ page }) => {
    await page.goto('/register');

    // Tab through form elements
    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="email"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="password"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('input[name="password_confirmation"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('button[type="submit"]')).toBeFocused();

    // Test form submission with Enter key
    await page.fill('input[type="email"]', 'keyboard@example.com');
    await page.fill('input[type="password"]', 'SecurePass123!');
    await page.fill('input[name="password_confirmation"]', 'SecurePass123!');

    await page.keyboard.press('Enter');

    // Should show success message
    await expect(page.locator('text=Check your email')).toBeVisible();
  });

  test('screen reader landmarks present on all pages', async ({ page }) => {
    const pages = ['/', '/register', '/login', '/profile', '/documents'];

    for (const pageUrl of pages) {
      await page.goto(pageUrl);

      // Check for required landmarks
      const landmarks = await page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"]').count();
      expect(landmarks).toBeGreaterThan(0);

      // Verify main landmark exists
      const main = page.locator('[role="main"]');
      await expect(main).toBeVisible();
    }
  });

  test('document upload page meets accessibility standards', async ({ page }) => {
    // Login and navigate to documents page
    await page.goto('/login');
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/profile');

    await page.goto('/documents');

    // Run axe checks
    await checkA11y(page, null, {
      detailedReport: true,
    });

    // Verify file input has proper labels
    const fileInput = page.locator('input[type="file"]');
    const labelFor = await fileInput.getAttribute('id');
    const label = page.locator(`label[for="${labelFor}"]`);
    await expect(label).toBeVisible();
  });

  test('error messages have proper ARIA attributes', async ({ page }) => {
    await page.goto('/register');

    // Submit form with invalid data
    await page.click('button[type="submit"]');

    // Check error message accessibility
    const errorMessage = page.locator('[role="alert"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveAttribute('aria-live', 'polite');

    // Verify form fields have aria-invalid
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('aria-invalid', 'true');
  });

  test('focus management after modal close', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/profile');

    // Open badge modal (if user has earned badge)
    const badgeButton = page.locator('[aria-label="View badges"]').first();
    if (await badgeButton.isVisible()) {
      await badgeButton.click();

      // Verify modal is open
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      // Close modal
      await page.keyboard.press('Escape');

      // Verify focus returns to trigger button
      await expect(badgeButton).toBeFocused();
    }
  });

  test('progress indicators have meaningful text', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/profile');

    // Check progress bar has accessible name
    const progressBar = page.locator('[role="progressbar"]');
    if (await progressBar.isVisible()) {
      await expect(progressBar).toHaveAttribute('aria-label');
      await expect(progressBar).toHaveAttribute('aria-valuenow');
      await expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      await expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    }
  });

  test('color contrast meets WCAG AA standards', async ({ page }) => {
    await page.goto('/register');

    // Run axe check specifically for color contrast
    await checkA11y(page, null, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });

    // Get any violations
    const violations = await getViolations(page);
    const contrastViolations = violations.filter(v => v.id === 'color-contrast');

    expect(contrastViolations.length).toBe(0);
  });

  test('skip to main content link present', async ({ page }) => {
    await page.goto('/');

    // Tab to skip link (should be first focusable element)
    await page.keyboard.press('Tab');

    const skipLink = page.locator('a:has-text("Skip to main content")');
    await expect(skipLink).toBeFocused();

    // Activate skip link
    await page.keyboard.press('Enter');

    // Verify focus moved to main content
    const main = page.locator('[role="main"]');
    await expect(main).toBeFocused();
  });

  test('live region announces points earned', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/profile');

    // Check for live region
    const liveRegion = page.locator('[aria-live="polite"]');
    if (await liveRegion.isVisible()) {
      const content = await liveRegion.textContent();
      expect(content).toBeTruthy();
    }
  });

  test('all interactive elements have accessible names', async ({ page }) => {
    await page.goto('/register');

    // Run axe check for button and link names
    await checkA11y(page, null, {
      rules: {
        'button-name': { enabled: true },
        'link-name': { enabled: true },
      },
    });

    // Verify submit button has accessible name
    const submitButton = page.locator('button[type="submit"]');
    const buttonText = await submitButton.textContent();
    expect(buttonText?.trim()).toBeTruthy();
  });

  test('callback-verify page meets WCAG 2.1 AA', async ({ page }) => {
    // Navigate to callback verification page (OAuth callback)
    await page.goto('/auth/callback?provider=google&code=test_code&state=test_state');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Run comprehensive accessibility checks
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
      rules: {
        'color-contrast': { enabled: true },
        'landmark-one-main': { enabled: true },
        'region': { enabled: true },
        'page-has-heading-one': { enabled: true },
      },
    });

    // Verify no violations found
    const violations = await getViolations(page);
    expect(violations.length).toBe(0);

    // Check for proper loading indicators
    const loadingIndicator = page.locator('[role="status"]');
    if (await loadingIndicator.isVisible()) {
      await expect(loadingIndicator).toHaveAttribute('aria-live', 'polite');
      await expect(loadingIndicator).toHaveAttribute('aria-busy', 'true');
    }
  });

  test('profile-minimal page meets WCAG 2.1 AA', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/profile');

    // Navigate to minimal profile view
    await page.goto('/profile/minimal');

    // Run comprehensive accessibility checks
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
      rules: {
        'color-contrast': { enabled: true },
        'label': { enabled: true },
        'button-name': { enabled: true },
        'landmark-one-main': { enabled: true },
        'aria-required-attr': { enabled: true },
      },
    });

    // Verify no violations found
    const violations = await getViolations(page);
    expect(violations.length).toBe(0);

    // Check form fields have proper labels
    const nameInput = page.locator('input[name="name"]');
    if (await nameInput.isVisible()) {
      await expect(nameInput).toHaveAttribute('aria-label');
    }

    // Verify main landmark exists
    const main = page.locator('[role="main"]');
    await expect(main).toBeVisible();
  });

  test('completion page meets WCAG 2.1 AA', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/profile');

    // Navigate to completion/success page
    await page.goto('/onboarding/complete');

    // Run comprehensive accessibility checks
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
      rules: {
        'color-contrast': { enabled: true },
        'landmark-one-main': { enabled: true },
        'page-has-heading-one': { enabled: true },
        'region': { enabled: true },
        'button-name': { enabled: true },
        'link-name': { enabled: true },
      },
    });

    // Verify no violations found
    const violations = await getViolations(page);
    expect(violations.length).toBe(0);

    // Check success message is announced to screen readers
    const successMessage = page.locator('[role="status"], [role="alert"]');
    if (await successMessage.isVisible()) {
      await expect(successMessage).toHaveAttribute('aria-live');
    }

    // Verify heading hierarchy
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    const h1Text = await h1.textContent();
    expect(h1Text?.toLowerCase()).toContain('complete');

    // Check primary action button is accessible
    const primaryButton = page.locator('button[type="button"]').first();
    if (await primaryButton.isVisible()) {
      const buttonText = await primaryButton.textContent();
      expect(buttonText?.trim()).toBeTruthy();
    }
  });

  test('documents page meets WCAG 2.1 AA (Slice B)', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/profile');

    // Navigate to documents page
    await page.goto('/documents');

    // Inject axe-core for accessibility testing
    await injectAxe(page);

    // Run accessibility scan
    const violations = await getViolations(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true }
    });

    // Zero violations tolerance
    expect(violations).toHaveLength(0);

    // If violations found, log detailed information
    if (violations.length > 0) {
      console.error('❌ WCAG 2.1 AA Violations Found:');
      violations.forEach((violation, index) => {
        console.error(`\nViolation ${index + 1}:`);
        console.error(`  Rule: ${violation.id}`);
        console.error(`  Impact: ${violation.impact}`);
        console.error(`  Description: ${violation.description}`);
        console.error(`  Help: ${violation.help}`);
        console.error(`  Help URL: ${violation.helpUrl}`);
        console.error(`  Elements affected: ${violation.nodes.length}`);

        violation.nodes.forEach((node, nodeIndex) => {
          console.error(`    Element ${nodeIndex + 1}:`);
          console.error(`      HTML: ${node.html}`);
          console.error(`      Target: ${node.target.join(' > ')}`);
        });
      });

      // Save violations to file for evidence
      const fs = require('fs');
      const reportDir = 'a11y-reports';
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      fs.writeFileSync(
        `${reportDir}/documents-violations-${Date.now()}.json`,
        JSON.stringify(violations, null, 2)
      );
    }
  });
});
