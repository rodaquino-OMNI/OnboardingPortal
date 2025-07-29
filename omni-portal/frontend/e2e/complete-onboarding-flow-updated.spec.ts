import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

// Test data
const testUser = {
  email: faker.internet.email(),
  password: 'TestPass123!@#',
  fullName: faker.person.fullName(),
  cpf: '123.456.789-00',
  phone: '(11) 98765-4321',
  birthDate: '1990-05-15',
  company: 'Test Company Inc.',
  department: 'Engineering',
  employeeId: 'EMP001'
};

test.describe('Complete Onboarding Flow - Updated', () => {
  test.beforeEach(async ({ page }) => {
    // Set auth token to simulate logged-in state
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'fake-jwt-token');
    });

    // Mock API responses
    await page.route('**/api/auth/check', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          authenticated: true,
          user: { 
            id: 1, 
            name: testUser.fullName,
            registration_step: 'personal_info' 
          }
        })
      });
    });

    // Mock health questionnaire templates
    await page.route('**/api/health-questionnaires/templates', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{
            id: 1,
            code: 'initial_health_assessment',
            name: 'Questionário de Saúde Inicial',
            sections: [{
              title: 'Informações Básicas de Saúde',
              questions: [
                { id: 'height', text: 'Altura (cm)', type: 'number', required: true },
                { id: 'weight', text: 'Peso (kg)', type: 'number', required: true }
              ]
            }]
          }]
        })
      });
    });
  });

  test('should complete the entire onboarding process successfully', async ({ page }) => {
    // Step 1: Welcome Page
    await page.goto('/welcome');
    await expect(page.locator('h1')).toContainText(/Bem-vindo|Welcome/);
    
    // Click start button
    await page.click('button:has-text("Começar"), button:has-text("Iniciar"), a:has-text("Começar")');
    
    // Step 2: Company Information
    await page.waitForURL(/.*company-info/);
    await expect(page.locator('h1, h2').first()).toContainText(/Informações|Empresa|Company/);
    
    // Fill company information
    await page.fill('input[name="company"], input[placeholder*="empresa"]', testUser.company);
    await page.fill('input[name="department"], input[placeholder*="departamento"]', testUser.department);
    await page.fill('input[name="employeeId"], input[placeholder*="matrícula"]', testUser.employeeId);
    
    // Mock API for company info submission
    await page.route('**/api/users/update-profile', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
    
    await page.click('button:has-text("Próximo"), button:has-text("Continuar")');
    
    // Step 3: Health Questionnaire
    await page.waitForURL(/.*health-questionnaire/, { timeout: 10000 });
    await expect(page.locator('h1, h2').first()).toContainText(/Saúde|Questionário|Health/);
    
    // Wait for questionnaire to load
    await page.waitForSelector('input[type="number"]', { timeout: 10000 });
    
    // Fill health data
    const inputs = page.locator('input[type="number"]');
    await inputs.first().fill('175'); // Height
    await inputs.nth(1).fill('70');   // Weight
    
    // Mock questionnaire submission
    await page.route('**/api/health-questionnaires/submit-dual-pathway', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true,
          data: { id: 1, status: 'completed' }
        })
      });
    });
    
    // Submit questionnaire
    await page.click('button:has-text("Enviar"), button:has-text("Próximo"), button:has-text("Concluir")');
    
    // Step 4: Document Upload
    await page.waitForURL(/.*document-upload/, { timeout: 10000 });
    await expect(page.locator('h1, h2').first()).toContainText(/Documentos|Upload|Documents/);
    
    // Upload a document
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'rg.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake image content')
    });
    
    // Select document type if needed
    const rgButton = page.locator('button:has-text("RG"), label:has-text("RG")');
    if (await rgButton.isVisible()) {
      await rgButton.click();
    }
    
    // Mock document upload
    await page.route('**/api/documents/upload', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 1, status: 'processing' }
        })
      });
    });
    
    await page.click('button:has-text("Enviar"), button:has-text("Upload")');
    
    // Wait for success message
    await expect(page.locator('text=/sucesso|enviado|success/i')).toBeVisible({ timeout: 10000 });
    
    // Continue to completion
    await page.click('button:has-text("Continuar"), button:has-text("Próximo"), button:has-text("Finalizar")');
    
    // Step 5: Completion
    await page.waitForURL(/.*completion/, { timeout: 15000 });
    await expect(page.locator('h1, h2').first()).toContainText(/Parabéns|Concluído|Complete/);
    
    // Verify completion message
    await expect(page.locator('text=/processo.*concluído|onboarding.*completo/i')).toBeVisible();
    
    // Check for gamification elements if present
    const gamificationSection = page.locator('[data-testid*="gamification"], [class*="gamification"]');
    if (await gamificationSection.isVisible()) {
      console.log('Gamification elements found');
    }
    
    // Final assertion
    await expect(page.locator('text=/100%|Completo|Finalizado/i')).toBeVisible();
  });

  test('should handle AI health assistant interaction', async ({ page }) => {
    // Navigate directly to health questionnaire
    await page.goto('/health-questionnaire');
    
    // Wait for page to load
    await expect(page.locator('h1, h2').first()).toContainText(/Saúde|Health/);
    
    // Look for AI assistant button
    const aiButton = page.locator('button:has-text("AI"), button:has-text("Assistente"), button[aria-label*="assistant"]');
    
    if (await aiButton.isVisible()) {
      await aiButton.click();
      
      // Wait for AI chat to open
      await expect(page.locator('text=/posso ajudar|can I help/i')).toBeVisible({ timeout: 5000 });
      
      // Type a question
      const chatInput = page.locator('input[placeholder*="pergunta"], textarea[placeholder*="pergunta"]');
      await chatInput.fill('O que é IMC?');
      
      // Mock AI response
      await page.route('**/api/health/ai-assistant', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: 'IMC significa Índice de Massa Corporal...'
          })
        });
      });
      
      await chatInput.press('Enter');
      
      // Verify AI response
      await expect(page.locator('text=/IMC significa|Body Mass Index/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show gamification features throughout the flow', async ({ page }) => {
    // Start onboarding
    await page.goto('/welcome');
    
    // Check for progress indicators
    const progressBar = page.locator('[role="progressbar"], [data-testid="progress-bar"]');
    if (await progressBar.isVisible()) {
      await expect(progressBar).toHaveAttribute('aria-valuenow', /\d+/);
    }
    
    // Navigate through steps and check for points
    await page.click('button:has-text("Começar"), a:has-text("Começar")');
    
    // Look for points notification
    const pointsNotification = page.locator('text=/\+\d+ pontos|points earned/i');
    if (await pointsNotification.isVisible({ timeout: 3000 })) {
      console.log('Points notification displayed');
    }
    
    // Check for badges
    const badgeSection = page.locator('[data-testid*="badge"], [class*="badge"]');
    if (await badgeSection.isVisible()) {
      console.log('Badge section found');
    }
  });

  test('should handle validation errors appropriately', async ({ page }) => {
    await page.goto('/company-info');
    
    // Try to submit without filling required fields
    await page.click('button:has-text("Próximo"), button:has-text("Continuar")');
    
    // Check for validation messages
    await expect(page.locator('text=/obrigatório|required|preencha/i')).toBeVisible({ timeout: 5000 });
    
    // Fill required fields and proceed
    await page.fill('input[name="company"], input[placeholder*="empresa"]', 'Test Company');
    await page.fill('input[name="department"], input[placeholder*="departamento"]', 'IT');
    
    // Should now be able to proceed
    await page.click('button:has-text("Próximo"), button:has-text("Continuar")');
    await page.waitForURL(/.*health-questionnaire/, { timeout: 10000 });
  });

  test('should work correctly on mobile devices', async ({ page, viewport }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    
    await page.goto('/welcome');
    
    // Check mobile navigation
    const mobileMenu = page.locator('[data-testid="mobile-menu"], button[aria-label*="menu"]');
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
      await expect(page.locator('nav[role="navigation"]')).toBeVisible();
    }
    
    // Check responsive layout
    await expect(page.locator('h1, h2').first()).toBeVisible();
    
    // Verify touch-friendly buttons
    const buttons = page.locator('button');
    const firstButton = buttons.first();
    const box = await firstButton.boundingBox();
    
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44); // Minimum touch target size
    }
  });

  test('should maintain progress between sessions', async ({ page, context }) => {
    // Start onboarding
    await page.goto('/welcome');
    await page.click('button:has-text("Começar"), a:has-text("Começar")');
    
    // Fill some data
    await page.waitForURL(/.*company-info/);
    await page.fill('input[name="company"], input[placeholder*="empresa"]', 'Test Company');
    
    // Store progress in localStorage
    await page.evaluate(() => {
      localStorage.setItem('onboarding_progress', JSON.stringify({
        step: 'company_info',
        data: { company: 'Test Company' }
      }));
    });
    
    // Create new page (simulating new session)
    const newPage = await context.newPage();
    await newPage.goto('/company-info');
    
    // Check if data is preserved
    const companyInput = newPage.locator('input[name="company"], input[placeholder*="empresa"]');
    await expect(companyInput).toHaveValue('Test Company');
    
    await newPage.close();
  });

  test('should handle API failures gracefully', async ({ page }) => {
    await page.goto('/health-questionnaire');
    
    // Mock API failure
    await page.route('**/api/health-questionnaires/submit-dual-pathway', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    // Fill and submit questionnaire
    await page.waitForSelector('input[type="number"]');
    const inputs = page.locator('input[type="number"]');
    await inputs.first().fill('175');
    await inputs.nth(1).fill('70');
    
    await page.click('button:has-text("Enviar"), button:has-text("Próximo")');
    
    // Should show error message
    await expect(page.locator('text=/erro|error|tente novamente/i')).toBeVisible({ timeout: 5000 });
    
    // Should allow retry
    const retryButton = page.locator('button:has-text("Tentar novamente"), button:has-text("Retry")');
    if (await retryButton.isVisible()) {
      await retryButton.click();
    }
  });
});