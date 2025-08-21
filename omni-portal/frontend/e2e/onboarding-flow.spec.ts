import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display welcome page', async ({ page }) => {
    await expect(page).toHaveTitle(/AUSTA OnboardingPortal/);
    await expect(page.locator('h1')).toContainText(/Welcome/);
  });

  test('should navigate to registration', async ({ page }) => {
    await page.click('text=Get Started');
    await expect(page).toHaveURL('/register');
    await expect(page.locator('h2')).toContainText(/Create Account/);
  });

  test('should complete registration flow', async ({ page }) => {
    await page.goto('/register');
    
    // Fill registration form
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.fill('input[name="password_confirmation"]', 'Password123!');
    await page.check('input[name="terms"]');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForURL('**/welcome');
    await expect(page.locator('h1')).toContainText(/Welcome/);
  });

  test('should complete health questionnaire', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    
    // Navigate to health questionnaire
    await page.goto('/health-questionnaire');
    
    // Fill basic health info
    await page.selectOption('select[name="age_group"]', '25-34');
    await page.selectOption('select[name="gender"]', 'male');
    await page.fill('input[name="height"]', '180');
    await page.fill('input[name="weight"]', '75');
    
    // Submit questionnaire
    await page.click('button:has-text("Submit")');
    
    // Verify completion
    await expect(page.locator('.success-message')).toBeVisible();
  });

  test('should upload documents', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    
    // Navigate to document upload
    await page.goto('/document-upload');
    
    // Upload a file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('test pdf content'),
    });
    
    // Submit upload
    await page.click('button:has-text("Upload")');
    
    // Verify upload success
    await expect(page.locator('.upload-success')).toBeVisible();
  });

  test('should schedule telemedicine appointment', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    
    // Navigate to telemedicine scheduling
    await page.goto('/telemedicine-schedule');
    
    // Select date and time
    await page.click('.calendar-day:not(.disabled)');
    await page.click('.time-slot:not(.disabled)');
    
    // Confirm appointment
    await page.click('button:has-text("Schedule Appointment")');
    
    // Verify confirmation
    await expect(page.locator('.appointment-confirmed')).toBeVisible();
  });

  test('should show gamification rewards', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    
    // Navigate to rewards
    await page.goto('/rewards');
    
    // Check for gamification elements
    await expect(page.locator('.points-display')).toBeVisible();
    await expect(page.locator('.badges-section')).toBeVisible();
    await expect(page.locator('.leaderboard')).toBeVisible();
  });

  test('should complete full onboarding flow', async ({ page }) => {
    // Start from homepage
    await page.goto('/');
    
    // Click get started
    await page.click('text=Get Started');
    
    // Complete registration
    await page.fill('input[name="name"]', 'Complete Test User');
    await page.fill('input[name="email"]', 'complete@example.com');
    await page.fill('input[name="password"]', 'CompletePass123!');
    await page.fill('input[name="password_confirmation"]', 'CompletePass123!');
    await page.check('input[name="terms"]');
    await page.click('button[type="submit"]');
    
    // Wait for welcome page
    await page.waitForURL('**/welcome');
    
    // Continue to health questionnaire
    await page.click('text=Continue');
    await page.waitForURL('**/health-questionnaire');
    
    // Fill health questionnaire
    await page.selectOption('select[name="age_group"]', '35-44');
    await page.selectOption('select[name="gender"]', 'female');
    await page.fill('input[name="height"]', '165');
    await page.fill('input[name="weight"]', '60');
    await page.click('button:has-text("Next")');
    
    // Continue through remaining steps
    await page.click('text=Continue');
    await page.waitForURL('**/document-upload');
    
    // Skip document upload for now
    await page.click('text=Skip');
    
    // Complete onboarding
    await page.waitForURL('**/completion');
    await expect(page.locator('h1')).toContainText(/Congratulations/);
  });
});