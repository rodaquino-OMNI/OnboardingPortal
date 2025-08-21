import { test, expect } from '@playwright/test';
import { loginUser, uploadDocument, checkGamificationProgress, TEST_USERS, waitForApiResponse, checkConsoleErrors } from './helpers/test-helpers';
import path from 'path';

test.describe('Document Upload Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginUser(page, TEST_USERS.demo);
    await checkConsoleErrors(page);
  });

  test('should upload ID document successfully', async ({ page }) => {
    await page.goto('/documents');
    
    // Wait for upload area to be visible
    await page.waitForSelector('[data-testid="document-upload"]');
    
    // Select document type
    await page.selectOption('select[name="document_type"]', 'ID');
    
    // Create a test file
    const testFilePath = path.join(__dirname, '../fixtures/test-id.jpg');
    
    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    // Wait for upload progress
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
    
    // Wait for upload completion
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });
    
    // Verify document appears in list
    await expect(page.locator('[data-testid="document-list"]')).toContainText('ID');
    
    // Check gamification points awarded
    const progress = await checkGamificationProgress(page);
    expect(progress.points).toBeGreaterThan(0);
  });

  test('should validate file type restrictions', async ({ page }) => {
    await page.goto('/documents');
    
    // Try to upload unsupported file type
    const testFilePath = path.join(__dirname, '../fixtures/test-document.txt');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    // Should see file type error
    await expect(page.locator('[data-testid="file-type-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-type-error"]')).toContainText('supported file types');
  });

  test('should validate file size limits', async ({ page }) => {
    // Mock large file upload
    await page.goto('/documents');
    
    // Create a mock large file (simulate)
    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (input) {
        Object.defineProperty(input, 'files', {
          value: [{
            name: 'large-file.jpg',
            size: 50 * 1024 * 1024, // 50MB
            type: 'image/jpeg'
          }],
          writable: false
        });
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    // Should see file size error
    await expect(page.locator('[data-testid="file-size-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-size-error"]')).toContainText('file size');
  });

  test('should upload multiple document types', async ({ page }) => {
    await page.goto('/documents');
    
    const documentTypes = ['ID', 'Passport', 'Drivers_License', 'Birth_Certificate'];
    
    for (const docType of documentTypes) {
      // Select document type
      await page.selectOption('select[name="document_type"]', docType);
      
      // Upload file
      const testFilePath = path.join(__dirname, `../fixtures/test-${docType.toLowerCase()}.jpg`);
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);
      
      // Wait for upload completion
      await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });
      
      // Verify document appears in list
      await expect(page.locator('[data-testid="document-list"]')).toContainText(docType.replace('_', ' '));
    }
    
    // Verify all documents are listed
    await expect(page.locator('[data-testid="document-item"]')).toHaveCount(documentTypes.length);
  });

  test('should handle OCR processing and text extraction', async ({ page }) => {
    await page.goto('/documents');
    
    // Upload ID document
    await page.selectOption('select[name="document_type"]', 'ID');
    const testFilePath = path.join(__dirname, '../fixtures/test-id-with-text.jpg');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    // Wait for upload and OCR processing
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="ocr-processing"]')).toBeVisible();
    
    // Wait for OCR completion
    await expect(page.locator('[data-testid="ocr-complete"]')).toBeVisible({ timeout: 60000 });
    
    // Should show extracted text
    await expect(page.locator('[data-testid="extracted-text"]')).toBeVisible();
    
    // Should show confidence score
    await expect(page.locator('[data-testid="ocr-confidence"]')).toBeVisible();
  });

  test('should handle document verification status', async ({ page }) => {
    await page.goto('/documents');
    
    // Upload document
    await page.selectOption('select[name="document_type"]', 'ID');
    const testFilePath = path.join(__dirname, '../fixtures/test-id.jpg');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });
    
    // Should show verification status
    await expect(page.locator('[data-testid="verification-status"]')).toBeVisible();
    
    // Initially should be "Pending"
    await expect(page.locator('[data-testid="verification-status"]')).toContainText('Pending');
  });

  test('should allow document replacement', async ({ page }) => {
    await page.goto('/documents');
    
    // Upload initial document
    await page.selectOption('select[name="document_type"]', 'ID');
    const testFilePath1 = path.join(__dirname, '../fixtures/test-id.jpg');
    
    let fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath1);
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });
    
    // Replace document
    await page.click('[data-testid="replace-document"]');
    await page.selectOption('select[name="document_type"]', 'ID');
    
    const testFilePath2 = path.join(__dirname, '../fixtures/test-id-replacement.jpg');
    fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath2);
    
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });
    
    // Should still have only one ID document
    const idDocuments = page.locator('[data-testid="document-item"][data-type="ID"]');
    await expect(idDocuments).toHaveCount(1);
  });

  test('should download uploaded documents', async ({ page }) => {
    await page.goto('/documents');
    
    // Upload document first
    await page.selectOption('select[name="document_type"]', 'ID');
    const testFilePath = path.join(__dirname, '../fixtures/test-id.jpg');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });
    
    // Download document
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-document"]');
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toContain('ID');
  });

  test('should delete uploaded documents', async ({ page }) => {
    await page.goto('/documents');
    
    // Upload document first
    await page.selectOption('select[name="document_type"]', 'Passport');
    const testFilePath = path.join(__dirname, '../fixtures/test-passport.jpg');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });
    
    // Verify document exists
    await expect(page.locator('[data-testid="document-item"][data-type="Passport"]')).toBeVisible();
    
    // Delete document
    await page.click('[data-testid="delete-document"]');
    
    // Confirm deletion
    await page.click('[data-testid="confirm-delete"]');
    
    // Document should be removed
    await expect(page.locator('[data-testid="document-item"][data-type="Passport"]')).not.toBeVisible();
  });

  test('should handle upload errors gracefully', async ({ page }) => {
    // Mock upload error
    await page.route('**/api/documents/upload', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Upload failed' })
      });
    });
    
    await page.goto('/documents');
    
    // Try to upload
    await page.selectOption('select[name="document_type"]', 'ID');
    const testFilePath = path.join(__dirname, '../fixtures/test-id.jpg');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    // Should show error message
    await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-error"]')).toContainText('Upload failed');
  });

  test('should show upload progress accurately', async ({ page }) => {
    await page.goto('/documents');
    
    // Mock slow upload to see progress
    await page.route('**/api/documents/upload', async route => {
      // Simulate slow upload
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true,
          document_id: '123',
          message: 'Document uploaded successfully'
        })
      });
    });
    
    await page.selectOption('select[name="document_type"]', 'ID');
    const testFilePath = path.join(__dirname, '../fixtures/test-id.jpg');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    // Should show progress bar
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="progress-percentage"]')).toBeVisible();
    
    // Wait for completion
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 10000 });
  });

  test('should handle drag and drop upload', async ({ page }) => {
    await page.goto('/documents');
    
    // Create a file for drag and drop
    const testFilePath = path.join(__dirname, '../fixtures/test-id.jpg');
    
    // Simulate drag and drop
    const dropZone = page.locator('[data-testid="drag-drop-zone"]');
    await expect(dropZone).toBeVisible();
    
    // Use setInputFiles on the hidden input (since actual drag/drop is complex to simulate)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    // Should process the file
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });
  });

  test('should validate document completeness for onboarding', async ({ page }) => {
    await page.goto('/documents');
    
    // Check initial completion status
    await expect(page.locator('[data-testid="document-requirements"]')).toBeVisible();
    await expect(page.locator('[data-testid="completion-progress"]')).toContainText('0%');
    
    // Upload required documents
    const requiredDocs = ['ID', 'Address_Proof'];
    
    for (const docType of requiredDocs) {
      await page.selectOption('select[name="document_type"]', docType);
      const testFilePath = path.join(__dirname, `../fixtures/test-${docType.toLowerCase()}.jpg`);
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);
      await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });
    }
    
    // Should show 100% completion
    await expect(page.locator('[data-testid="completion-progress"]')).toContainText('100%');
    await expect(page.locator('[data-testid="documents-complete"]')).toBeVisible();
  });

  test('should handle mobile upload experience', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip(); // Only run on mobile
    }

    await page.goto('/documents');
    
    // Mobile-specific upload interface
    await expect(page.locator('[data-testid="mobile-upload-interface"]')).toBeVisible();
    
    // Camera capture option should be available
    await expect(page.locator('[data-testid="camera-capture"]')).toBeVisible();
    
    // Touch-friendly file selection
    await page.tap('[data-testid="file-select-button"]');
    
    // Use regular file input for testing
    const testFilePath = path.join(__dirname, '../fixtures/test-id.jpg');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });
  });
});