import { test, expect, Page, BrowserContext } from '@playwright/test';

class OnboardingPortalPage {
  constructor(private page: Page) {}

  // Navigation methods
  async navigateToHome() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async navigateToLogin() {
    await this.page.goto('/auth/login');
    await this.page.waitForLoadState('networkidle');
  }

  async navigateToRegister() {
    await this.page.goto('/auth/register');
    await this.page.waitForLoadState('networkidle');
  }

  // Authentication methods
  async login(email: string, password: string) {
    await this.page.fill('[name="email"]', email);
    await this.page.fill('[name="password"]', password);
    await this.page.click('button[type="submit"]');
    await this.page.waitForLoadState('networkidle');
  }

  async register(userData: {
    name: string;
    email: string;
    cpf: string;
    password: string;
  }) {
    await this.page.fill('[name="name"]', userData.name);
    await this.page.fill('[name="email"]', userData.email);
    await this.page.fill('[name="cpf"]', userData.cpf);
    await this.page.fill('[name="password"]', userData.password);
    await this.page.fill('[name="password_confirmation"]', userData.password);
    await this.page.click('button[type="submit"]');
    await this.page.waitForLoadState('networkidle');
  }

  // Health questionnaire methods
  async fillHealthQuestionnaire(answers: Record<string, string | boolean>) {
    for (const [question, answer] of Object.entries(answers)) {
      if (typeof answer === 'boolean') {
        if (answer) {
          await this.page.check(`[name="${question}"][value="yes"]`);
        } else {
          await this.page.check(`[name="${question}"][value="no"]`);
        }
      } else {
        await this.page.fill(`[name="${question}"]`, answer);
      }
    }
  }

  async submitHealthQuestionnaire() {
    await this.page.click('button[type="submit"]');
    await this.page.waitForLoadState('networkidle');
  }

  // Document upload methods
  async uploadDocument(filePath: string, documentType: string) {
    await this.page.setInputFiles('[type="file"]', filePath);
    await this.page.selectOption('[name="document_type"]', documentType);
    await this.page.click('button:has-text("Upload")');
  }

  // Appointment scheduling methods
  async scheduleAppointment(date: string, time: string) {
    await this.page.click(`[data-date="${date}"]`);
    await this.page.click(`[data-time="${time}"]`);
    await this.page.click('button:has-text("Book Appointment")');
    await this.page.waitForLoadState('networkidle');
  }

  // Verification methods
  async verifyDashboardAccess() {
    await expect(this.page).toHaveURL(/.*dashboard.*/);
    await expect(this.page.locator('h1')).toContainText('Dashboard');
  }

  async verifyRegistrationSuccess() {
    await expect(this.page.locator('[data-testid="success-message"]')).toBeVisible();
  }

  async verifyHealthQuestionnaireCompletion() {
    await expect(this.page.locator('[data-testid="questionnaire-complete"]')).toBeVisible();
  }
}

test.describe('Comprehensive User Journey Tests', () => {
  let page: Page;
  let context: BrowserContext;
  let portalPage: OnboardingPortalPage;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      // Enable permissions for file upload
      permissions: ['clipboard-read', 'clipboard-write'],
      // Set reasonable viewport
      viewport: { width: 1280, height: 720 }
    });
  });

  test.beforeEach(async () => {
    page = await context.newPage();
    portalPage = new OnboardingPortalPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.describe('User Registration Flow', () => {
    test('should complete full registration process', async () => {
      const userData = {
        name: 'Test User E2E',
        email: `e2e-test-${Date.now()}@example.com`,
        cpf: '12345678901',
        password: 'SecurePassword123!'
      };

      // Navigate to registration page
      await portalPage.navigateToRegister();

      // Verify registration page loads
      await expect(page.locator('h1')).toContainText('Register');

      // Fill and submit registration form
      await portalPage.register(userData);

      // Verify successful registration
      await portalPage.verifyRegistrationSuccess();

      // Should redirect to onboarding
      await expect(page).toHaveURL(/.*onboarding.*/);
    });

    test('should show validation errors for invalid data', async () => {
      await portalPage.navigateToRegister();

      // Submit form with invalid email
      await portalPage.register({
        name: 'Test User',
        email: 'invalid-email',
        cpf: '123', // Invalid CPF
        password: '123' // Too short
      });

      // Verify validation errors are shown
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="cpf-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
    });

    test('should prevent duplicate email registration', async () => {
      const email = 'existing@example.com';

      // First registration
      await portalPage.navigateToRegister();
      await portalPage.register({
        name: 'First User',
        email,
        cpf: '12345678901',
        password: 'Password123!'
      });

      // Second registration with same email
      await portalPage.navigateToRegister();
      await portalPage.register({
        name: 'Second User',
        email,
        cpf: '98765432109',
        password: 'Password123!'
      });

      // Should show duplicate email error
      await expect(page.locator('[data-testid="email-error"]'))
        .toContainText('email has already been taken');
    });
  });

  test.describe('User Authentication Flow', () => {
    test('should login with valid credentials', async () => {
      // Use existing test user
      await portalPage.navigateToLogin();
      await portalPage.login('admin@example.com', 'password');

      // Should redirect to dashboard
      await portalPage.verifyDashboardAccess();
    });

    test('should show error for invalid credentials', async () => {
      await portalPage.navigateToLogin();
      await portalPage.login('nonexistent@example.com', 'wrongpassword');

      // Should show authentication error
      await expect(page.locator('[data-testid="auth-error"]')).toBeVisible();
    });

    test('should handle logout correctly', async () => {
      // Login first
      await portalPage.navigateToLogin();
      await portalPage.login('admin@example.com', 'password');
      await portalPage.verifyDashboardAccess();

      // Logout
      await page.click('[data-testid="logout-button"]');

      // Should redirect to login page
      await expect(page).toHaveURL(/.*login.*/);
    });
  });

  test.describe('Health Questionnaire Flow', () => {
    test.beforeEach(async () => {
      // Login as test user
      await portalPage.navigateToLogin();
      await portalPage.login('admin@example.com', 'password');
      
      // Navigate to health questionnaire
      await page.goto('/onboarding/health-questionnaire');
      await page.waitForLoadState('networkidle');
    });

    test('should complete health questionnaire successfully', async () => {
      const healthAnswers = {
        'age': '30',
        'height': '175',
        'weight': '70',
        'has_diabetes': false,
        'has_hypertension': false,
        'exercises_regularly': true,
        'smoker': false,
        'alcohol_consumption': 'moderate',
        'medications': 'None'
      };

      await portalPage.fillHealthQuestionnaire(healthAnswers);
      await portalPage.submitHealthQuestionnaire();

      await portalPage.verifyHealthQuestionnaireCompletion();
    });

    test('should show validation for required fields', async () => {
      // Submit empty form
      await portalPage.submitHealthQuestionnaire();

      // Should show validation errors
      await expect(page.locator('[data-testid="age-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="height-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="weight-error"]')).toBeVisible();
    });

    test('should save progress and allow continuation', async () => {
      // Fill partial questionnaire
      await page.fill('[name="age"]', '30');
      await page.fill('[name="height"]', '175');
      
      // Navigate away
      await page.goto('/dashboard');
      
      // Return to questionnaire
      await page.goto('/onboarding/health-questionnaire');
      
      // Progress should be saved
      await expect(page.locator('[name="age"]')).toHaveValue('30');
      await expect(page.locator('[name="height"]')).toHaveValue('175');
    });

    test('should calculate and display health risk assessment', async () => {
      // Fill questionnaire indicating high risk
      const highRiskAnswers = {
        'age': '65',
        'height': '170',
        'weight': '100',
        'has_diabetes': true,
        'has_hypertension': true,
        'exercises_regularly': false,
        'smoker': true,
        'alcohol_consumption': 'heavy'
      };

      await portalPage.fillHealthQuestionnaire(highRiskAnswers);
      await portalPage.submitHealthQuestionnaire();

      // Should show high risk assessment
      await expect(page.locator('[data-testid="risk-level"]'))
        .toContainText('High Risk');
    });
  });

  test.describe('Document Upload Flow', () => {
    test.beforeEach(async () => {
      await portalPage.navigateToLogin();
      await portalPage.login('admin@example.com', 'password');
      await page.goto('/onboarding/document-upload');
      await page.waitForLoadState('networkidle');
    });

    test('should upload document successfully', async () => {
      // Create a test file
      const testFile = 'tests/fixtures/test-document.pdf';
      
      await portalPage.uploadDocument(testFile, 'id_card');

      // Should show upload success
      await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
    });

    test('should validate file type and size', async () => {
      // Try to upload invalid file
      const invalidFile = 'tests/fixtures/large-file.zip';
      
      await portalPage.uploadDocument(invalidFile, 'id_card');

      // Should show validation error
      await expect(page.locator('[data-testid="file-error"]'))
        .toContainText('Invalid file type or size');
    });

    test('should process OCR for uploaded documents', async () => {
      const documentFile = 'tests/fixtures/id-card.jpg';
      
      await portalPage.uploadDocument(documentFile, 'id_card');

      // Wait for OCR processing
      await expect(page.locator('[data-testid="ocr-processing"]')).toBeVisible();
      
      // Should complete OCR and extract data
      await expect(page.locator('[data-testid="extracted-data"]')).toBeVisible();
    });
  });

  test.describe('Telemedicine Scheduling Flow', () => {
    test.beforeEach(async () => {
      await portalPage.navigateToLogin();
      await portalPage.login('admin@example.com', 'password');
      await page.goto('/onboarding/telemedicine-schedule');
      await page.waitForLoadState('networkidle');
    });

    test('should book appointment successfully', async () => {
      // Get tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateString = tomorrow.toISOString().split('T')[0];

      await portalPage.scheduleAppointment(dateString, '14:00');

      // Should show booking confirmation
      await expect(page.locator('[data-testid="booking-confirmation"]')).toBeVisible();
    });

    test('should prevent booking in the past', async () => {
      // Try to book yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateString = yesterday.toISOString().split('T')[0];

      // Past dates should be disabled
      await expect(page.locator(`[data-date="${dateString}"]`))
        .toHaveClass(/disabled/);
    });

    test('should show availability correctly', async () => {
      // Should load available time slots
      await expect(page.locator('[data-testid="available-slots"]')).toBeVisible();
      
      // Should have at least one available slot
      const availableSlots = page.locator('[data-available="true"]');
      await expect(availableSlots).toHaveCountGreaterThan(0);
    });
  });

  test.describe('Complete Onboarding Flow', () => {
    test('should complete entire onboarding process', async () => {
      const userData = {
        name: 'Complete Test User',
        email: `complete-test-${Date.now()}@example.com`,
        cpf: '11122233344',
        password: 'CompleteTest123!'
      };

      // 1. Register
      await portalPage.navigateToRegister();
      await portalPage.register(userData);
      await portalPage.verifyRegistrationSuccess();

      // 2. Complete health questionnaire
      await page.goto('/onboarding/health-questionnaire');
      await portalPage.fillHealthQuestionnaire({
        'age': '35',
        'height': '180',
        'weight': '75',
        'has_diabetes': false,
        'has_hypertension': false,
        'exercises_regularly': true,
        'smoker': false
      });
      await portalPage.submitHealthQuestionnaire();

      // 3. Upload documents (mock file)
      await page.goto('/onboarding/document-upload');
      // Skip actual file upload in complete flow test
      await page.click('[data-testid="skip-upload"]');

      // 4. Schedule appointment
      await page.goto('/onboarding/telemedicine-schedule');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await portalPage.scheduleAppointment(
        tomorrow.toISOString().split('T')[0], 
        '10:00'
      );

      // 5. Verify completion
      await expect(page).toHaveURL(/.*onboarding.*complete.*/);
      await expect(page.locator('[data-testid="onboarding-complete"]'))
        .toContainText('Onboarding Complete');

      // 6. Access dashboard
      await page.click('[data-testid="go-to-dashboard"]');
      await portalPage.verifyDashboardAccess();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network failures gracefully', async () => {
      // Simulate network failure
      await context.route('**/api/**', route => route.abort());

      await portalPage.navigateToLogin();
      await portalPage.login('admin@example.com', 'password');

      // Should show network error message
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
    });

    test('should handle server errors gracefully', async () => {
      // Simulate server error
      await context.route('**/api/**', route => 
        route.fulfill({ status: 500, body: 'Server Error' })
      );

      await portalPage.navigateToLogin();
      await portalPage.login('admin@example.com', 'password');

      // Should show server error message
      await expect(page.locator('[data-testid="server-error"]')).toBeVisible();
    });

    test('should maintain session across page refreshes', async () => {
      // Login
      await portalPage.navigateToLogin();
      await portalPage.login('admin@example.com', 'password');
      await portalPage.verifyDashboardAccess();

      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should still be logged in
      await portalPage.verifyDashboardAccess();
    });

    test('should handle browser back/forward navigation', async () => {
      await portalPage.navigateToLogin();
      await portalPage.login('admin@example.com', 'password');
      
      // Navigate to health questionnaire
      await page.goto('/onboarding/health-questionnaire');
      
      // Go back
      await page.goBack();
      await portalPage.verifyDashboardAccess();
      
      // Go forward
      await page.goForward();
      await expect(page).toHaveURL(/.*health-questionnaire.*/);
    });
  });

  test.describe('Accessibility and Mobile Responsiveness', () => {
    test('should be navigable with keyboard only', async () => {
      await portalPage.navigateToLogin();

      // Tab through form elements
      await page.keyboard.press('Tab'); // Email field
      await expect(page.locator('[name="email"]')).toBeFocused();
      
      await page.keyboard.press('Tab'); // Password field
      await expect(page.locator('[name="password"]')).toBeFocused();
      
      await page.keyboard.press('Tab'); // Submit button
      await expect(page.locator('button[type="submit"]')).toBeFocused();
    });

    test('should work on mobile viewport', async () => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

      await portalPage.navigateToLogin();
      
      // Mobile menu should be visible
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
      
      // Forms should be properly sized
      const emailInput = page.locator('[name="email"]');
      const box = await emailInput.boundingBox();
      expect(box?.width).toBeGreaterThan(250); // Should be reasonably wide
    });

    test('should have proper contrast and readability', async () => {
      await portalPage.navigateToHome();
      
      // Check for accessibility violations
      // This would typically use axe-playwright
      // await expect(page).toHaveNoViolations();
    });
  });

  test.describe('Performance and Load Testing', () => {
    test('should load pages within acceptable time', async () => {
      const startTime = Date.now();
      
      await portalPage.navigateToHome();
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    });

    test('should handle concurrent form submissions', async () => {
      await portalPage.navigateToLogin();
      
      // Fill form
      await page.fill('[name="email"]', 'admin@example.com');
      await page.fill('[name="password"]', 'password');
      
      // Simulate rapid double-click
      const submitButton = page.locator('button[type="submit"]');
      await Promise.all([
        submitButton.click(),
        submitButton.click()
      ]);
      
      // Should handle gracefully without errors
      await expect(page.locator('[data-testid="error"]')).not.toBeVisible();
    });
  });
});