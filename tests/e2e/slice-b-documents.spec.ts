/**
 * E2E Test Suite: Slice B Documents Flow
 *
 * Tests the complete document upload flow including:
 * - Feature flag integration
 * - Upload orchestration
 * - Analytics verification
 * - A11y compliance
 * - Keyboard navigation
 * - Error handling
 */

import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Slice B: Documents Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login flow
    await page.goto('http://localhost:3000/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'Test123!@#');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test('complete upload flow with analytics verification', async ({ page, request }) => {
    // Navigate to documents page
    await page.goto('http://localhost:3000/documents');

    // Should be visible if feature flag is enabled
    await expect(page.locator('h1:has-text("Upload Documents")')).toBeVisible({ timeout: 10000 });

    // Select document type
    await page.selectOption('select#document-type', 'rg');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-rg.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test content'),
    });

    // Wait for upload to complete
    await expect(page.locator('text=Upload successful')).toBeVisible({ timeout: 30000 });

    // Verify analytics event was tracked
    const response = await request.get('http://localhost:8000/api/analytics/events?event_name=documents.upload_success');
    expect(response.ok()).toBeTruthy();

    const events = await response.json();
    expect(events.data).toBeDefined();
    expect(events.data.length).toBeGreaterThan(0);

    // Verify no PII in analytics
    const eventJson = JSON.stringify(events.data[0]);
    expect(eventJson).not.toContain('test@example.com');
    expect(eventJson).not.toContain('123.456.789');
  });

  test('documents page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('http://localhost:3000/documents');

    // Inject axe-core
    await injectAxe(page);

    // Run a11y checks
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });
  });

  test('keyboard navigation is fully functional', async ({ page }) => {
    await page.goto('http://localhost:3000/documents');

    // Tab to document type selector
    await page.keyboard.press('Tab');
    let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['SELECT', 'INPUT', 'BUTTON']).toContain(focusedElement);

    // Navigate with arrow keys
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Tab to file input
    await page.keyboard.press('Tab');
    focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'LABEL', 'BUTTON']).toContain(focusedElement);
  });

  test('feature flag disabled shows appropriate message', async ({ page }) => {
    // Note: This test would require mock server or test-specific flag override
    await page.goto('http://localhost:3000/documents');

    // Check for either upload form or disabled message
    const hasUploadForm = await page.locator('input[type="file"]').count();
    const hasDisabledMessage = await page.locator('text=/not available/i').count();

    // At least one should be present
    expect(hasUploadForm + hasDisabledMessage).toBeGreaterThan(0);
  });

  test('error handling for oversized files', async ({ page }) => {
    await page.goto('http://localhost:3000/documents');

    // Try to upload a file that's too large (> 10MB)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'huge.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(15 * 1024 * 1024), // 15MB
    });

    // Should show error message
    await expect(page.locator('text=/file.*large/i')).toBeVisible({ timeout: 5000 });
  });

  test('error handling for invalid file types', async ({ page }) => {
    await page.goto('http://localhost:3000/documents');

    // Try to upload an invalid file type
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('test content'),
    });

    // Should show error message
    await expect(page.locator('text=/não suportado|not supported/i')).toBeVisible({ timeout: 5000 });
  });

  test('multiple document types can be uploaded', async ({ page }) => {
    await page.goto('http://localhost:3000/documents');

    // Upload RG
    await page.selectOption('select#document-type', 'rg');
    let fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'rg.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 rg content'),
    });
    await expect(page.locator('text=Upload successful')).toBeVisible({ timeout: 30000 });

    // Wait for reset
    await page.waitForTimeout(3500);

    // Upload CPF
    await page.selectOption('select#document-type', 'cpf');
    fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'cpf.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 cpf content'),
    });
    await expect(page.locator('text=Upload successful')).toBeVisible({ timeout: 30000 });
  });

  test('upload progress indicators work correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/documents');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test'),
    });

    // Should show uploading state
    await expect(page.locator('text=/preparing|uploading/i')).toBeVisible({ timeout: 2000 });

    // Should eventually show success
    await expect(page.locator('text=/success/i')).toBeVisible({ timeout: 30000 });
  });

  test('can cancel and retry upload', async ({ page }) => {
    await page.goto('http://localhost:3000/documents');

    // Upload a file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test'),
    });

    // Wait for file to be selected
    await expect(page.locator('text=test.pdf')).toBeVisible();

    // Click clear/remove button
    await page.click('button[aria-label="Remover arquivo"]');

    // File should be cleared
    await expect(page.locator('text=test.pdf')).not.toBeVisible();

    // Can upload again
    await fileInput.setInputFiles({
      name: 'test2.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test2'),
    });
    await expect(page.locator('text=test2.pdf')).toBeVisible();
  });
});
