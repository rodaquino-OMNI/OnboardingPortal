import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility Tests - WCAG 2.1 AA Compliance
 *
 * Tests all Phase 8 routes for accessibility compliance using axe-core.
 * Ensures WCAG 2.1 Level AA standards are met across all pages.
 */

test.describe('Accessibility - WCAG 2.1 AA Compliance', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport for consistent testing
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('login page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/login');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Run accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Assert no violations
    expect(accessibilityScanResults.violations).toEqual([]);

    // Additional specific checks
    await expect(page.locator('main')).toHaveAttribute('role', 'main');
    await expect(page.locator('form')).toHaveAccessibleName();

    // Check all inputs have labels
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      await expect(input).toHaveAccessibleName();
    }
  });

  test('register-step1 page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/register/step1');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);

    // Check form accessibility
    await expect(page.locator('form')).toHaveAccessibleName();
    await expect(page.locator('[role="progressbar"]')).toBeVisible();

    // Verify step indicator is accessible
    const stepIndicator = page.locator('[aria-label*="step"]').first();
    await expect(stepIndicator).toHaveAttribute('aria-current', 'step');
  });

  test('register-step2 page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/register/step2');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);

    // Check file upload accessibility
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
      await expect(fileInput).toHaveAccessibleName();
    }

    // Check error messages are accessible
    const errorMessages = page.locator('[role="alert"]');
    if (await errorMessages.count() > 0) {
      await expect(errorMessages.first()).toHaveAttribute('aria-live', 'polite');
    }
  });

  test('register-step3 page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/register/step3');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);

    // Check summary is accessible
    const summary = page.locator('[role="region"]').first();
    if (await summary.count() > 0) {
      await expect(summary).toHaveAccessibleName();
    }
  });

  test('document-upload page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/documents/upload');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);

    // Check drag-and-drop is keyboard accessible
    const dropzone = page.locator('[data-testid="dropzone"]').first();
    if (await dropzone.count() > 0) {
      await expect(dropzone).toBeFocused();
      await expect(dropzone).toHaveAttribute('tabindex', '0');
    }
  });

  test('health-questionnaire page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/health/questionnaire');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);

    // Check radio buttons are properly grouped
    const radioGroups = page.locator('[role="radiogroup"]');
    const radioGroupCount = await radioGroups.count();
    for (let i = 0; i < radioGroupCount; i++) {
      const group = radioGroups.nth(i);
      await expect(group).toHaveAccessibleName();
    }

    // Check required fields are marked
    const requiredInputs = page.locator('[required]');
    const requiredCount = await requiredInputs.count();
    for (let i = 0; i < requiredCount; i++) {
      const input = requiredInputs.nth(i);
      await expect(input).toHaveAttribute('aria-required', 'true');
    }
  });

  test('interview-scheduling page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/interview/schedule');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);

    // Check calendar is accessible
    const calendar = page.locator('[role="grid"]').first();
    if (await calendar.count() > 0) {
      await expect(calendar).toHaveAccessibleName();

      // Check date cells are keyboard navigable
      const dateCells = page.locator('[role="gridcell"]');
      const cellCount = await dateCells.count();
      if (cellCount > 0) {
        await expect(dateCells.first()).toHaveAttribute('tabindex');
      }
    }
  });

  test('callback-verify page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/callback/verify');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Assert no violations
    expect(accessibilityScanResults.violations).toEqual([]);

    // Check loading states are accessible
    const loadingIndicator = page.locator('[role="status"]').first();
    if (await loadingIndicator.count() > 0) {
      await expect(loadingIndicator).toHaveAttribute('aria-live', 'polite');
      await expect(loadingIndicator).toHaveAccessibleName();
    }

    // Check error states are announced
    const errorAlert = page.locator('[role="alert"]').first();
    if (await errorAlert.count() > 0) {
      await expect(errorAlert).toHaveAttribute('aria-live');
    }

    // Verify main content is identifiable
    const mainContent = page.locator('main').first();
    await expect(mainContent).toBeVisible();
  });

  test('profile minimal page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/profile/minimal');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Assert no violations
    expect(accessibilityScanResults.violations).toEqual([]);

    // Check form fields are properly labeled
    const formInputs = page.locator('input, select, textarea');
    const formInputCount = await formInputs.count();
    for (let i = 0; i < formInputCount; i++) {
      const input = formInputs.nth(i);
      const inputType = await input.getAttribute('type');

      // Skip hidden inputs
      if (inputType !== 'hidden') {
        await expect(input).toHaveAccessibleName();
      }
    }

    // Check save button is accessible
    const saveButton = page.locator('button[type="submit"]').first();
    if (await saveButton.count() > 0) {
      await expect(saveButton).toHaveAccessibleName();
      await expect(saveButton).toBeEnabled();
    }

    // Verify navigation is accessible
    const navigation = page.locator('nav').first();
    if (await navigation.count() > 0) {
      await expect(navigation).toHaveAttribute('role', 'navigation');
    }
  });

  test('completion page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/complete');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Assert no violations
    expect(accessibilityScanResults.violations).toEqual([]);

    // Check success message is announced
    const successMessage = page.locator('[role="status"], [role="alert"]').first();
    if (await successMessage.count() > 0) {
      await expect(successMessage).toHaveAttribute('aria-live');
      await expect(successMessage).toHaveAccessibleName();
    }

    // Check all action buttons are accessible
    const actionButtons = page.locator('button, a[role="button"]');
    const buttonCount = await actionButtons.count();
    for (let i = 0; i < buttonCount; i++) {
      const button = actionButtons.nth(i);
      const isVisible = await button.isVisible();

      if (isVisible) {
        await expect(button).toHaveAccessibleName();
      }
    }

    // Verify heading hierarchy
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();

    // Check that h1 exists
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThan(0);

    // Check summary information is in a landmark
    const mainLandmark = page.locator('main, [role="main"]').first();
    await expect(mainLandmark).toBeVisible();
  });

  test('keyboard navigation works across all pages', async ({ page }) => {
    const routes = [
      '/login',
      '/register/step1',
      '/register/step2',
      '/register/step3',
      '/documents/upload',
      '/health/questionnaire',
      '/interview/schedule',
      '/callback/verify',
      '/profile/minimal',
      '/complete'
    ];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      // Check focus is visible
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();

      // Check skip link exists (if applicable)
      const skipLink = page.locator('a[href="#main-content"], a[href="#main"]').first();
      if (await skipLink.count() > 0) {
        await expect(skipLink).toBeFocused();
      }
    }
  });

  test('color contrast meets WCAG 2.1 AA standards', async ({ page }) => {
    const routes = [
      '/login',
      '/register/step1',
      '/callback/verify',
      '/profile/minimal',
      '/complete'
    ];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      // Run contrast checks specifically
      const contrastResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .include('*')
        .analyze();

      // Filter for color contrast violations
      const contrastViolations = contrastResults.violations.filter(
        v => v.id.includes('color-contrast')
      );

      expect(contrastViolations).toEqual([]);
    }
  });

  test('screen reader announcements are appropriate', async ({ page }) => {
    await page.goto('/register/step1');
    await page.waitForLoadState('networkidle');

    // Check live regions exist
    const liveRegions = page.locator('[aria-live]');
    const liveRegionCount = await liveRegions.count();

    if (liveRegionCount > 0) {
      for (let i = 0; i < liveRegionCount; i++) {
        const region = liveRegions.nth(i);
        const ariaLive = await region.getAttribute('aria-live');

        // Verify appropriate politeness levels
        expect(['polite', 'assertive', 'off']).toContain(ariaLive);
      }
    }

    // Check aria-label usage
    const ariaLabels = page.locator('[aria-label]');
    const ariaLabelCount = await ariaLabels.count();

    for (let i = 0; i < ariaLabelCount; i++) {
      const element = ariaLabels.nth(i);
      const label = await element.getAttribute('aria-label');

      // Ensure labels are not empty
      expect(label?.trim().length).toBeGreaterThan(0);
    }
  });

  test('form validation errors are accessible', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Submit empty form to trigger validation
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();

    // Wait for error messages
    await page.waitForSelector('[role="alert"], [aria-invalid="true"]', { timeout: 5000 });

    // Check error messages are associated with inputs
    const invalidInputs = page.locator('[aria-invalid="true"]');
    const invalidCount = await invalidInputs.count();

    for (let i = 0; i < invalidCount; i++) {
      const input = invalidInputs.nth(i);
      const describedBy = await input.getAttribute('aria-describedby');

      if (describedBy) {
        const errorMessage = page.locator(`#${describedBy}`);
        await expect(errorMessage).toBeVisible();
      }
    }

    // Check error summary is announced
    const errorSummary = page.locator('[role="alert"]').first();
    if (await errorSummary.count() > 0) {
      await expect(errorSummary).toHaveAttribute('aria-live');
    }
  });

  test('responsive design maintains accessibility', async ({ page }) => {
    const viewports = [
      { width: 375, height: 667 },  // Mobile
      { width: 768, height: 1024 }, // Tablet
      { width: 1920, height: 1080 } // Desktop
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/register/step1');
      await page.waitForLoadState('networkidle');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });
});
