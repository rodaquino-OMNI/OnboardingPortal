import { test, expect } from '@playwright/test';

test.describe('Healthcare Features', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('should display health risk analytics', async ({ page }) => {
    await page.goto('/health-risks/analytics');
    
    // Check for analytics components
    await expect(page.locator('.risk-score-card')).toBeVisible();
    await expect(page.locator('.risk-chart')).toBeVisible();
    await expect(page.locator('.risk-factors')).toBeVisible();
    
    // Verify data is loaded
    await expect(page.locator('.risk-score')).not.toBeEmpty();
  });

  test('should show health risk alerts', async ({ page }) => {
    await page.goto('/health-risks/alerts');
    
    // Check for alerts section
    await expect(page.locator('.alerts-container')).toBeVisible();
    
    // Check alert categories
    await expect(page.locator('.critical-alerts')).toBeVisible();
    await expect(page.locator('.warning-alerts')).toBeVisible();
    await expect(page.locator('.info-alerts')).toBeVisible();
  });

  test('should generate health reports', async ({ page }) => {
    await page.goto('/health-risks/reports');
    
    // Click generate report
    await page.click('button:has-text("Generate Report")');
    
    // Select report type
    await page.selectOption('select[name="report_type"]', 'comprehensive');
    
    // Select date range
    await page.fill('input[name="start_date"]', '2025-01-01');
    await page.fill('input[name="end_date"]', '2025-01-31');
    
    // Generate report
    await page.click('button:has-text("Generate")');
    
    // Wait for report generation
    await page.waitForSelector('.report-ready', { timeout: 30000 });
    
    // Verify download button appears
    await expect(page.locator('button:has-text("Download PDF")')).toBeVisible();
  });

  test('should use health intelligence features', async ({ page }) => {
    await page.goto('/health-risks/intelligence');
    
    // Check AI recommendations
    await expect(page.locator('.ai-recommendations')).toBeVisible();
    
    // Check predictive analytics
    await expect(page.locator('.predictive-insights')).toBeVisible();
    
    // Check personalized suggestions
    await expect(page.locator('.personalized-plan')).toBeVisible();
  });

  test('should handle OCR document processing', async ({ page }) => {
    await page.goto('/document-upload');
    
    // Upload medical document
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles({
      name: 'medical-report.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake image content'),
    });
    
    // Click process with OCR
    await page.click('button:has-text("Process with OCR")');
    
    // Wait for OCR processing
    await page.waitForSelector('.ocr-processing', { state: 'hidden', timeout: 30000 });
    
    // Verify extracted text appears
    await expect(page.locator('.extracted-text')).toBeVisible();
  });

  test('should access telemedicine video consultation', async ({ page }) => {
    await page.goto('/video-consultation');
    
    // Check video controls
    await expect(page.locator('.video-container')).toBeVisible();
    await expect(page.locator('button:has-text("Start Video")')).toBeVisible();
    await expect(page.locator('button:has-text("Mute")')).toBeVisible();
    
    // Check chat functionality
    await expect(page.locator('.chat-container')).toBeVisible();
    await expect(page.locator('input[placeholder*="Type a message"]')).toBeVisible();
  });

  test('should track health metrics over time', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check metrics dashboard
    await expect(page.locator('.metrics-overview')).toBeVisible();
    
    // Verify charts are rendered
    await expect(page.locator('.weight-chart')).toBeVisible();
    await expect(page.locator('.blood-pressure-chart')).toBeVisible();
    await expect(page.locator('.activity-chart')).toBeVisible();
    
    // Check trend indicators
    await expect(page.locator('.trend-indicator')).toHaveCount({ minimum: 1 });
  });

  test('should integrate with wearable devices', async ({ page }) => {
    await page.goto('/profile');
    
    // Navigate to integrations
    await page.click('text=Integrations');
    
    // Check available integrations
    await expect(page.locator('.fitbit-integration')).toBeVisible();
    await expect(page.locator('.apple-health-integration')).toBeVisible();
    await expect(page.locator('.google-fit-integration')).toBeVisible();
    
    // Try to connect a device
    await page.click('.fitbit-integration button:has-text("Connect")');
    
    // Verify OAuth flow starts
    await expect(page).toHaveURL(/.*fitbit.*/);
  });

  test('should provide medication reminders', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check medication section
    await expect(page.locator('.medication-reminders')).toBeVisible();
    
    // Add new medication
    await page.click('button:has-text("Add Medication")');
    await page.fill('input[name="medication_name"]', 'Vitamin D');
    await page.selectOption('select[name="frequency"]', 'daily');
    await page.fill('input[name="time"]', '09:00');
    await page.click('button:has-text("Save")');
    
    // Verify medication added
    await expect(page.locator('text=Vitamin D')).toBeVisible();
  });

  test('should show appointment history', async ({ page }) => {
    await page.goto('/profile');
    
    // Navigate to appointments
    await page.click('text=Appointments');
    
    // Check appointment sections
    await expect(page.locator('.upcoming-appointments')).toBeVisible();
    await expect(page.locator('.past-appointments')).toBeVisible();
    
    // Verify appointment cards
    await expect(page.locator('.appointment-card')).toHaveCount({ minimum: 0 });
  });
});