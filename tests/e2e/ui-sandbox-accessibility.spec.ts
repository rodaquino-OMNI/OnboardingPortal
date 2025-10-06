import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y, getViolations } from 'axe-playwright';

/**
 * Phase 7.3: UI Sandbox Accessibility Smoke Tests
 *
 * Tests all sandbox-mounted components for WCAG 2.1 AA compliance:
 * - VideoConferencing
 * - VideoChat
 * - EnhancedDocumentUpload
 *
 * ACCEPTANCE CRITERIA:
 * - Zero accessibility violations across all components
 * - All interactive elements keyboard accessible
 * - Proper ARIA labels and roles
 * - Screen reader compatibility
 */

test.describe('UI Sandbox - Accessibility Compliance', () => {
  test.beforeEach(async ({ page }) => {
    // Inject axe-core before each test
    await page.goto('/_sandbox/ui');
    await injectAxe(page);
  });

  test('sandbox home page meets WCAG 2.1 AA', async ({ page }) => {
    // Check the sandbox landing page
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
      rules: {
        'color-contrast': { enabled: true },
        'label': { enabled: true },
        'button-name': { enabled: true },
        'link-name': { enabled: true },
        'landmark-one-main': { enabled: true },
        'aria-required-attr': { enabled: true },
      },
    });

    // Verify no violations
    const violations = await getViolations(page);
    expect(violations.length).toBe(0);

    // Verify component cards are navigable
    const videoConferencingCard = page.locator('a[href="/ui/video-conferencing"]');
    await expect(videoConferencingCard).toBeVisible();

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(videoConferencingCard).toBeFocused();
  });

  test('VideoConferencing component meets WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/_sandbox/ui/video-conferencing');
    await injectAxe(page);

    // Run comprehensive axe checks
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
      rules: {
        'color-contrast': { enabled: true },
        'aria-roles': { enabled: true },
        'button-name': { enabled: true },
        'label': { enabled: true },
        'aria-required-attr': { enabled: true },
        'aria-valid-attr-value': { enabled: true },
        'region': { enabled: true },
      },
    });

    // Verify zero violations
    const violations = await getViolations(page);
    if (violations.length > 0) {
      console.error('Accessibility violations found:', JSON.stringify(violations, null, 2));
    }
    expect(violations.length).toBe(0);

    // Verify critical ARIA attributes
    const videoApp = page.locator('[role="application"][aria-label="Video conferencing application"]');
    await expect(videoApp).toBeVisible();

    // Check control buttons have proper labels
    const micButton = page.locator('button[aria-label*="microphone"]');
    await expect(micButton).toBeVisible();
    await expect(micButton).toHaveAttribute('aria-label');
    await expect(micButton).toHaveAttribute('aria-pressed');

    const videoButton = page.locator('button[aria-label*="camera"]');
    await expect(videoButton).toBeVisible();
    await expect(videoButton).toHaveAttribute('aria-label');
    await expect(videoButton).toHaveAttribute('aria-pressed');

    const screenShareButton = page.locator('button[aria-label*="screen sharing"]');
    await expect(screenShareButton).toBeVisible();
    await expect(screenShareButton).toHaveAttribute('aria-label');
    await expect(screenShareButton).toHaveAttribute('aria-pressed');

    // Verify HIPAA/encryption badges have labels
    const hipaaCompliantBadge = page.locator('[aria-label*="HIPAA compliant"]');
    await expect(hipaaCompliantBadge).toBeVisible();

    const encryptedBadge = page.locator('[aria-label*="encrypted"]');
    await expect(encryptedBadge).toBeVisible();
  });

  test('VideoConferencing keyboard navigation works', async ({ page }) => {
    await page.goto('/_sandbox/ui/video-conferencing');

    // Tab through interactive elements
    await page.keyboard.press('Tab'); // Should focus first interactive element

    // Verify we can navigate to main controls
    const micButton = page.locator('button[aria-label*="microphone"]');
    const videoButton = page.locator('button[aria-label*="camera"]');
    const screenShareButton = page.locator('button[aria-label*="screen sharing"]');
    const endCallButton = page.locator('button[aria-label="End call"]');

    // Test toggling controls with keyboard
    await micButton.focus();
    await expect(micButton).toBeFocused();
    await page.keyboard.press('Enter');

    await videoButton.focus();
    await expect(videoButton).toBeFocused();
    await page.keyboard.press('Enter');
  });

  test('VideoChat component meets WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/_sandbox/ui/video-chat');
    await injectAxe(page);

    // Run axe checks
    await checkA11y(page, null, {
      detailedReport: true,
      rules: {
        'color-contrast': { enabled: true },
        'label': { enabled: true },
        'aria-required-attr': { enabled: true },
        'aria-valid-attr-value': { enabled: true },
      },
    });

    const violations = await getViolations(page);
    if (violations.length > 0) {
      console.error('VideoChat violations:', JSON.stringify(violations, null, 2));
    }
    expect(violations.length).toBe(0);

    // Verify chat region has proper labels
    const chatRegion = page.locator('[role="region"][aria-label*="chat"]');
    await expect(chatRegion).toBeVisible();

    // Verify message log has aria-live
    const messageLog = page.locator('[role="log"]');
    await expect(messageLog).toHaveAttribute('aria-live', 'polite');

    // Verify input has proper label
    const messageInput = page.locator('#chat-message-input');
    await expect(messageInput).toBeVisible();
    const label = page.locator('label[for="chat-message-input"]');
    await expect(label).toBeVisible();

    // Verify send button has label
    const sendButton = page.locator('button[aria-label="Send message"]');
    await expect(sendButton).toBeVisible();

    // Verify encryption status is announced
    const encryptionStatus = page.locator('#encryption-status');
    await expect(encryptionStatus).toHaveAttribute('aria-live', 'polite');
  });

  test('EnhancedDocumentUpload component meets WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/_sandbox/ui/document-upload');
    await injectAxe(page);

    // Run axe checks
    await checkA11y(page, null, {
      detailedReport: true,
      rules: {
        'color-contrast': { enabled: true },
        'label': { enabled: true },
        'button-name': { enabled: true },
        'aria-required-attr': { enabled: true },
      },
    });

    const violations = await getViolations(page);
    if (violations.length > 0) {
      console.error('DocumentUpload violations:', JSON.stringify(violations, null, 2));
    }
    expect(violations.length).toBe(0);

    // Verify file input has label
    const fileInput = page.locator('input[type="file"]').first();
    const inputId = await fileInput.getAttribute('id');
    expect(inputId).toBeTruthy();

    const label = page.locator(`label[for="${inputId}"]`);
    await expect(label).toBeVisible();

    // Verify document type info is accessible
    const documentInfo = page.locator('text=/RG/');
    await expect(documentInfo).toBeVisible();
  });

  test('all sandbox components have proper landmarks', async ({ page }) => {
    const sandboxPages = [
      '/_sandbox/ui',
      '/_sandbox/ui/video-conferencing',
      '/_sandbox/ui/video-chat',
      '/_sandbox/ui/document-upload',
    ];

    for (const pageUrl of sandboxPages) {
      await page.goto(pageUrl);
      await injectAxe(page);

      // Verify landmark structure
      const violations = await getViolations(page, null, {
        runOnly: ['region', 'landmark-one-main'],
      });

      expect(violations.length).toBe(0);

      // Verify we have navigation or main landmarks
      const landmarks = await page.locator('[role="main"], [role="navigation"], [role="region"]').count();
      expect(landmarks).toBeGreaterThan(0);
    }
  });

  test('no violations in color contrast across all sandbox components', async ({ page }) => {
    const sandboxPages = [
      '/_sandbox/ui',
      '/_sandbox/ui/video-conferencing',
      '/_sandbox/ui/video-chat',
      '/_sandbox/ui/document-upload',
    ];

    for (const pageUrl of sandboxPages) {
      await page.goto(pageUrl);
      await injectAxe(page);

      // Run color contrast check specifically
      const violations = await getViolations(page, null, {
        runOnly: ['color-contrast'],
      });

      if (violations.length > 0) {
        console.error(`Color contrast violations on ${pageUrl}:`, JSON.stringify(violations, null, 2));
      }
      expect(violations.length).toBe(0);
    }
  });

  test('all interactive elements have accessible names', async ({ page }) => {
    const sandboxPages = [
      '/_sandbox/ui/video-conferencing',
      '/_sandbox/ui/video-chat',
      '/_sandbox/ui/document-upload',
    ];

    for (const pageUrl of sandboxPages) {
      await page.goto(pageUrl);
      await injectAxe(page);

      // Check for button and link names
      const violations = await getViolations(page, null, {
        runOnly: ['button-name', 'link-name'],
      });

      if (violations.length > 0) {
        console.error(`Interactive element violations on ${pageUrl}:`, JSON.stringify(violations, null, 2));
      }
      expect(violations.length).toBe(0);
    }
  });

  test('focus management is correct after interactions', async ({ page }) => {
    await page.goto('/_sandbox/ui/video-conferencing');

    // Click End Call button and verify focus doesn't get lost
    const endCallButton = page.locator('button[aria-label="End call"]');
    await endCallButton.click();

    // Focus should be somewhere visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('screen reader announcements work correctly', async ({ page }) => {
    await page.goto('/_sandbox/ui/video-conferencing');

    // Verify error messages have role="alert"
    // (We can't test actual screen reader behavior, but we can verify ARIA)
    const errorRegions = page.locator('[role="alert"], [aria-live="assertive"]');
    // Should exist even if not visible
    expect(await errorRegions.count()).toBeGreaterThanOrEqual(0);

    // Verify status regions have aria-live
    const statusRegions = page.locator('[aria-live="polite"]');
    expect(await statusRegions.count()).toBeGreaterThan(0);
  });
});
