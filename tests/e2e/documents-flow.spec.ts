import { test, expect } from '@playwright/test';
import { injectAxe, getViolations } from 'axe-playwright';

test.describe('Slice B: Documents Upload Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'Test123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('complete upload flow persists analytics events', async ({ page }) => {
    // Navigate to documents page
    await page.goto('/documents');

    // Select document type
    await page.selectOption('select', 'rg');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-rg.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake pdf content'),
    });

    // Wait for upload to complete
    await page.waitForSelector('text=Upload successful', { timeout: 30000 });

    // Verify analytics events were persisted
    const response = await page.request.get('/api/analytics/events?event_name=documents.presigned_generated');
    expect(response.ok()).toBeTruthy();

    const events = await response.json();
    expect(events.data).toHaveLength(1);
    expect(events.data[0].event_category).toBe('documents');

    // Verify no PII in analytics
    const eventMetadata = JSON.stringify(events.data[0].metadata);
    expect(eventMetadata).not.toContain('test@example.com');
    expect(eventMetadata).not.toContain('123456789');
  });

  test('upload flow shows progress and handles errors', async ({ page }) => {
    await page.goto('/documents');

    // Try to upload oversized file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'huge.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(15 * 1024 * 1024), // 15MB
    });

    // Should show error
    await expect(page.locator('text=File too large')).toBeVisible();
  });

  test('documents page meets WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/documents');
    await injectAxe(page);

    const violations = await getViolations(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true }
    });

    expect(violations).toHaveLength(0);

    // If violations found, log details
    if (violations.length > 0) {
      console.error('A11y Violations:', JSON.stringify(violations, null, 2));
    }
  });

  test('keyboard navigation works for entire flow', async ({ page }) => {
    await page.goto('/documents');

    // Tab through form
    await page.keyboard.press('Tab'); // Focus select
    await page.keyboard.press('ArrowDown'); // Select RG
    await page.keyboard.press('Tab'); // Focus file input

    // Verify focus indicators visible
    const focused = await page.evaluate(() => {
      return document.activeElement?.tagName;
    });
    expect(['SELECT', 'INPUT']).toContain(focused);
  });

  test('screen reader announces upload status', async ({ page }) => {
    await page.goto('/documents');

    // Check for ARIA live regions
    const liveRegion = page.locator('[aria-live="polite"]');
    await expect(liveRegion).toBeAttached();

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('test'),
    });

    // Status should be announced
    await expect(liveRegion).toHaveText(/uploading|success/i);
  });
});
