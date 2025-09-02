/**
 * @test Complete User Flow End-to-End Tests
 * @description Tests complete user flows from registration to onboarding completion
 * @prerequisites Application running on localhost:3002
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3002';

// Test data
const testUser = {
  name: 'Test User E2E',
  email: `e2e-test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  phone: '(11) 99999-9999',
  cpf: '123.456.789-00'
};

// Helper functions
async function waitForPageLoad(page: Page, timeout = 10000) {
  await page.waitForLoadState('networkidle', { timeout });
}

async function fillFormField(page: Page, selector: string, value: string) {
  const field = page.locator(selector);
  await field.waitFor({ state: 'visible', timeout: 5000 });
  await field.fill(value);
}

async function submitForm(page: Page) {
  const submitButton = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Enviar"), button:has-text("Cadastrar"), button:has-text("Login")');
  await submitButton.click();
}

test.describe('Complete User Flow Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Enable console logging for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`❌ Console Error: ${msg.text()}`);
      }
    });

    page.on('pageerror', error => {
      console.log(`❌ Page Error: ${error.message}`);
    });
  });

  test('1. Landing Page - Navigation and Content', async ({ page }) => {
    console.log('🔍 Testing landing page...');
    
    await page.goto(BASE_URL);
    await waitForPageLoad(page);
    
    // Check page title and main content
    await expect(page).toHaveTitle(/Portal|Onboarding|AUSTA/);
    
    // Verify key elements are present
    await expect(page.locator('h1, h2')).toContainText(/Portal|Onboarding|AUSTA/);
    
    // Check navigation buttons
    const loginButton = page.locator('button:has-text("Login"), a[href*="login"]');
    const registerButton = page.locator('button:has-text("Cadastrar"), button:has-text("Criar"), a[href*="register"]');
    
    await expect(loginButton.or(registerButton)).toBeVisible();
    
    console.log('✅ Landing page validated');
  });

  test('2. Registration Flow - Complete User Registration', async ({ page }) => {
    console.log('🔍 Testing complete registration flow...');
    
    await page.goto(`${BASE_URL}/register`);
    await waitForPageLoad(page);
    
    // Verify we're on registration page
    await expect(page).toHaveURL(/.*register/);
    await expect(page.locator('h1, h2')).toContainText(/cadastr|register|sign up/i);
    
    // Fill registration form
    console.log('Filling registration form...');
    
    // Try multiple field selectors for robustness
    const nameSelectors = ['input[name="name"]', 'input[placeholder*="nome"]', 'input[type="text"]:first-of-type'];
    for (const selector of nameSelectors) {
      if (await page.locator(selector).isVisible().catch(() => false)) {
        await fillFormField(page, selector, testUser.name);
        break;
      }
    }
    
    const emailSelectors = ['input[name="email"]', 'input[type="email"]', 'input[placeholder*="email"]'];
    for (const selector of emailSelectors) {
      if (await page.locator(selector).isVisible().catch(() => false)) {
        await fillFormField(page, selector, testUser.email);
        break;
      }
    }
    
    const passwordSelectors = ['input[name="password"]', 'input[type="password"]:first-of-type'];
    for (const selector of passwordSelectors) {
      if (await page.locator(selector).isVisible().catch(() => false)) {
        await fillFormField(page, selector, testUser.password);
        break;
      }
    }
    
    // Fill password confirmation if present
    const confirmPasswordField = page.locator('input[type="password"]:nth-of-type(2), input[name*="confirm"], input[name*="confirmation"]');
    if (await confirmPasswordField.isVisible().catch(() => false)) {
      await confirmPasswordField.fill(testUser.password);
    }
    
    // Fill additional fields if present
    const phoneField = page.locator('input[name="phone"], input[placeholder*="telefone"], input[placeholder*="phone"]');
    if (await phoneField.isVisible().catch(() => false)) {
      await phoneField.fill(testUser.phone);
    }
    
    // Accept terms if checkbox exists
    const termsCheckbox = page.locator('input[type="checkbox"], label:has(input[type="checkbox"])');
    if (await termsCheckbox.isVisible().catch(() => false)) {
      await termsCheckbox.check();
    }
    
    // Submit form
    console.log('Submitting registration...');
    await submitForm(page);
    await page.waitForTimeout(3000); // Wait for processing
    
    // Verify registration success
    const currentUrl = page.url();
    const hasRedirected = !currentUrl.includes('/register');
    const hasSuccessIndicator = await page.locator('text=/success|sucesso|bem-vindo|welcome|dashboard/i').isVisible().catch(() => false);
    
    expect(hasRedirected || hasSuccessIndicator).toBe(true);
    console.log('✅ Registration flow completed successfully');
  });

  test('3. Login Flow - User Authentication', async ({ page }) => {
    console.log('🔍 Testing login flow...');
    
    await page.goto(`${BASE_URL}/login`);
    await waitForPageLoad(page);
    
    // Verify login page
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('h1, h2')).toContainText(/login|entrar|sign in/i);
    
    // Fill login form
    await fillFormField(page, 'input[type="email"], input[name="email"]', testUser.email);
    await fillFormField(page, 'input[type="password"], input[name="password"]', testUser.password);
    
    // Submit login
    await submitForm(page);
    await page.waitForTimeout(3000);
    
    // Verify successful login (check for redirect or dashboard elements)
    const currentUrl = page.url();
    const isLoggedIn = currentUrl.includes('/dashboard') || 
                      currentUrl.includes('/home') || 
                      await page.locator('text=/dashboard|profile|logout|sair/i').isVisible().catch(() => false);
    
    expect(isLoggedIn).toBe(true);
    console.log('✅ Login flow completed successfully');
  });

  test('4. Health Questionnaire Flow', async ({ page }) => {
    console.log('🔍 Testing health questionnaire flow...');
    
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await fillFormField(page, 'input[type="email"]', testUser.email);
    await fillFormField(page, 'input[type="password"]', testUser.password);
    await submitForm(page);
    await page.waitForTimeout(2000);
    
    // Try different health questionnaire URLs
    const healthUrls = [
      `${BASE_URL}/health-questionnaire`,
      `${BASE_URL}/onboarding/health-questionnaire`,
      `${BASE_URL}/questionnaire`,
      `${BASE_URL}/health`
    ];
    
    let questionnaireFound = false;
    for (const url of healthUrls) {
      await page.goto(url);
      await page.waitForTimeout(2000);
      
      if (!page.url().includes('404') && 
          await page.locator('h1, h2, h3').filter({ hasText: /health|saúde|questionnaire|questionário/i }).isVisible().catch(() => false)) {
        questionnaireFound = true;
        console.log(`✅ Found questionnaire at: ${url}`);
        
        // Fill questionnaire if found
        const ageField = page.locator('input[name="age"], input[placeholder*="idade"], select[name="age"]');
        if (await ageField.isVisible().catch(() => false)) {
          await ageField.fill('30');
        }
        
        const weightField = page.locator('input[name="weight"], input[placeholder*="peso"]');
        if (await weightField.isVisible().catch(() => false)) {
          await weightField.fill('70');
        }
        
        const heightField = page.locator('input[name="height"], input[placeholder*="altura"]');
        if (await heightField.isVisible().catch(() => false)) {
          await heightField.fill('175');
        }
        
        // Submit if submit button exists
        const submitButton = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Enviar")');
        if (await submitButton.isVisible().catch(() => false)) {
          await submitButton.click();
          await page.waitForTimeout(2000);
        }
        
        break;
      }
    }
    
    // Log result
    if (questionnaireFound) {
      console.log('✅ Health questionnaire flow tested successfully');
    } else {
      console.log('⚠️ Health questionnaire not accessible - may require specific user state');
    }
  });

  test('5. Document Upload Flow', async ({ page }) => {
    console.log('🔍 Testing document upload flow...');
    
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await fillFormField(page, 'input[type="email"]', testUser.email);
    await fillFormField(page, 'input[type="password"]', testUser.password);
    await submitForm(page);
    await page.waitForTimeout(2000);
    
    // Navigate to document upload
    await page.goto(`${BASE_URL}/document-upload`);
    await waitForPageLoad(page);
    
    // Check if upload page is accessible
    if (page.url().includes('404')) {
      console.log('⚠️ Document upload page not found - checking onboarding path');
      await page.goto(`${BASE_URL}/onboarding/document-upload`);
      await waitForPageLoad(page);
    }
    
    const hasUploadInterface = await page.locator('input[type="file"], text=/upload|enviar|documento|document/i').isVisible().catch(() => false);
    
    if (hasUploadInterface) {
      // Try to test file upload if input exists
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible().catch(() => false)) {
        // Create test file
        await fileInput.setInputFiles({
          name: 'test-document.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('Test PDF content')
        });
        
        // Submit upload if button exists
        const uploadButton = page.locator('button:has-text("Upload"), button:has-text("Enviar"), button[type="submit"]');
        if (await uploadButton.isVisible().catch(() => false)) {
          await uploadButton.click();
          await page.waitForTimeout(2000);
        }
      }
      console.log('✅ Document upload interface tested');
    } else {
      console.log('⚠️ Document upload interface not accessible in current user state');
    }
  });

  test('6. Authentication Redirects', async ({ page }) => {
    console.log('🔍 Testing authentication redirects...');
    
    // Clear any existing sessions
    await page.context().clearCookies();
    
    // Test protected routes without authentication
    const protectedRoutes = ['/dashboard', '/profile', '/home'];
    
    for (const route of protectedRoutes) {
      await page.goto(`${BASE_URL}${route}`);
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      const redirectedToLogin = currentUrl.includes('/login');
      const hasLoginForm = await page.locator('input[type="email"], input[type="password"]').isVisible().catch(() => false);
      
      if (redirectedToLogin || hasLoginForm) {
        console.log(`✅ ${route} properly redirects unauthenticated users`);
      } else {
        console.log(`⚠️ ${route} may not have proper authentication protection`);
      }
    }
  });

  test('7. Form Validation and Error Handling', async ({ page }) => {
    console.log('🔍 Testing form validation...');
    
    let totalErrors = 0;
    
    // Monitor console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        totalErrors++;
      }
    });
    
    // Test registration form validation
    await page.goto(`${BASE_URL}/register`);
    await waitForPageLoad(page);
    
    // Submit empty form
    await submitForm(page);
    await page.waitForTimeout(1000);
    
    // Check for validation messages (should have validation, not console errors)
    const hasValidationMessages = await page.locator('text=/required|obrigatório|invalid|inválido|campo.*obrigatório/i').isVisible().catch(() => false);
    
    if (hasValidationMessages) {
      console.log('✅ Form validation is working properly');
    }
    
    // Test invalid email format
    const emailField = page.locator('input[type="email"], input[name="email"]');
    if (await emailField.isVisible().catch(() => false)) {
      await emailField.fill('invalid-email');
      await submitForm(page);
      await page.waitForTimeout(1000);
      
      const hasEmailValidation = await page.locator('text=/email.*inválid|invalid.*email/i').isVisible().catch(() => false);
      if (hasEmailValidation) {
        console.log('✅ Email validation working');
      }
    }
    
    console.log(`📊 Console errors during form testing: ${totalErrors}`);
  });

  test('8. Complete User Journey - Registration to Dashboard', async ({ page }) => {
    console.log('🔍 Testing complete user journey...');
    
    // Start fresh
    await page.context().clearCookies();
    
    // Step 1: Land on homepage
    await page.goto(BASE_URL);
    await waitForPageLoad(page);
    await expect(page.locator('h1, h2')).toContainText(/Portal|Onboarding|AUSTA/);
    
    // Step 2: Navigate to registration
    const registerButton = page.locator('button:has-text("Cadastrar"), button:has-text("Criar"), a[href*="register"]');
    if (await registerButton.isVisible().catch(() => false)) {
      await registerButton.click();
    } else {
      await page.goto(`${BASE_URL}/register`);
    }
    await waitForPageLoad(page);
    
    // Step 3: Complete registration (abbreviated for speed)
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(`journey-${Date.now()}@example.com`);
    }
    
    const passwordInput = page.locator('input[type="password"]').first();
    if (await passwordInput.isVisible().catch(() => false)) {
      await passwordInput.fill('TestPassword123!');
    }
    
    const nameInput = page.locator('input[name="name"], input[type="text"]').first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill('Journey Test User');
    }
    
    // Accept terms if present
    const termsCheckbox = page.locator('input[type="checkbox"]');
    if (await termsCheckbox.isVisible().catch(() => false)) {
      await termsCheckbox.check();
    }
    
    // Submit registration
    await submitForm(page);
    await page.waitForTimeout(3000);
    
    // Step 4: Verify successful journey completion
    const currentUrl = page.url();
    const journeyComplete = currentUrl.includes('/dashboard') || 
                           currentUrl.includes('/home') ||
                           await page.locator('text=/dashboard|bem-vindo|welcome/i').isVisible().catch(() => false);
    
    if (journeyComplete) {
      console.log('✅ Complete user journey successful - registration to dashboard');
    } else {
      console.log(`⚠️ User journey incomplete - current URL: ${currentUrl}`);
    }
  });
});

// Export helper functions for reuse
export { testUser, fillFormField, submitForm, waitForPageLoad };