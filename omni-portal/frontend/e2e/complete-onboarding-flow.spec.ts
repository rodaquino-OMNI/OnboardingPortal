import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

// Test data
const testUser = {
  email: faker.internet.email(),
  password: 'TestPass123!@#',
  fullName: faker.person.fullName(),
  cpf: '12345678901',
  phone: '11987654321',
  birthDate: '1990-05-15',
  company: 'Test Company Inc.',
  department: 'Engineering',
  employeeId: 'EMP001'
};

test.describe('Complete Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for consistent testing
    await page.route('**/api/auth/check-email', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ exists: false })
      });
    });

    await page.route('**/api/auth/check-cpf', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ exists: false })
      });
    });

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
            estimated_minutes: 10,
            sections: [{
              title: 'Informações Básicas',
              description: 'Dados gerais sobre sua saúde',
              questions: [
                {
                  id: 'height',
                  text: 'Qual é sua altura? (em cm)',
                  type: 'number',
                  required: true
                },
                {
                  id: 'weight', 
                  text: 'Qual é seu peso? (em kg)',
                  type: 'number',
                  required: true
                }
              ]
            }]
          }]
        })
      });
    });
  });

  test('should complete the entire onboarding process successfully', async ({ page }) => {
    // Step 1: Registration - Email and Password
    await page.goto('/register');
    
    await expect(page.locator('h1')).toContainText('Criar Conta');
    
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.fill('input[placeholder*="confirme"]', testUser.password);
    
    // Mock registration API call
    await page.route('**/api/register/step1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { token: 'fake-jwt-token', user: { id: 1, email: testUser.email } }
        })
      });
    });
    
    await page.click('button[type="submit"]');
    
    // Wait for navigation to step 2
    await expect(page).toHaveURL(/.*company-info/);

    // Step 2: Company Information
    await expect(page.locator('h1')).toContainText('Informações da Empresa');
    
    await page.fill('input[placeholder*="nome completo"]', testUser.fullName);
    await page.fill('input[placeholder*="CPF"]', testUser.cpf);
    await page.fill('input[type="tel"]', testUser.phone);
    await page.fill('input[type="date"]', testUser.birthDate);
    await page.fill('input[placeholder*="empresa"]', testUser.company);
    await page.fill('input[placeholder*="departamento"]', testUser.department);
    await page.fill('input[placeholder*="matrícula"]', testUser.employeeId);
    
    // Mock step 2 API call
    await page.route('**/api/register/step2', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
    
    await page.click('button:has-text("Próximo")');
    
    // Wait for navigation to health questionnaire
    await expect(page).toHaveURL(/.*health-questionnaire/);

    // Step 3: Health Questionnaire
    await expect(page.locator('h1')).toContainText('Questionário de Saúde');
    
    // Verify progress indicators
    await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();
    await expect(page.locator('text=Seção 1 de 1')).toBeVisible();
    
    // Fill health questionnaire
    await page.fill('input[type="number"]:first', '175'); // Height
    await page.fill('input[type="number"]:last', '70');  // Weight
    
    // Mock questionnaire start API
    await page.route('**/api/health-questionnaires/start', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 1, template_id: 1, responses: {} }
        })
      });
    });
    
    // Mock questionnaire responses API
    await page.route('**/api/health-questionnaires/*/responses', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
    
    await page.click('button:has-text("Finalizar")');
    
    // Wait for navigation to document upload
    await expect(page).toHaveURL(/.*document-upload/);

    // Step 4: Document Upload
    await expect(page.locator('h1')).toContainText('Upload de Documentos');
    
    // Test file upload for RG
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'rg.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake image content')
    });
    
    // Mock document upload API
    await page.route('**/api/documents/upload', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 1,
            type: 'rg',
            status: 'processing',
            file_path: 'documents/1/rg.jpg'
          }
        })
      });
    });
    
    await page.click('button:has-text("Upload RG")');
    
    // Verify upload success
    await expect(page.locator('text=Upload realizado com sucesso')).toBeVisible();
    
    // Mock document validation progress
    await page.route('**/api/documents/validation-progress', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            progress: {
              rg: { uploaded: true, status: 'approved', required: true }
            },
            overall_percentage: 25,
            completed_documents: 1,
            total_required: 4
          }
        })
      });
    });
    
    await page.click('button:has-text("Continuar")');
    
    // Wait for completion page
    await expect(page).toHaveURL(/.*completion/);

    // Step 5: Completion
    await expect(page.locator('h1')).toContainText('Parabéns!');
    await expect(page.locator('text=Onboarding concluído com sucesso')).toBeVisible();
    
    // Verify gamification elements
    await expect(page.locator('[data-testid="points-display"]')).toBeVisible();
    await expect(page.locator('[data-testid="badges-earned"]')).toBeVisible();
  });

  test('should handle AI health assistant interaction', async ({ page }) => {
    // Navigate to health questionnaire
    await page.goto('/health-questionnaire');
    
    // Open AI assistant
    await page.click('button:has-text("Assistente IA")');
    await expect(page.locator('[data-testid="ai-chat"]')).toBeVisible();
    
    // Mock AI insights API
    await page.route('**/api/health-questionnaires/*/ai-insights', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            response: 'Diabetes é uma condição crônica que afeta como seu corpo processa açúcar no sangue.',
            confidence: 0.9,
            follow_up_questions: ['Você tem histórico familiar de diabetes?'],
            detected_conditions: ['diabetes'],
            recommendations: ['Manter dieta balanceada', 'Exercitar-se regularmente']
          }
        })
      });
    });
    
    // Ask a health question
    await page.fill('input[placeholder*="dúvida"]', 'O que é diabetes?');
    await page.click('button[aria-label="Send message"]');
    
    // Verify AI response
    await expect(page.locator('text=Diabetes é uma condição crônica')).toBeVisible();
    await expect(page.locator('text=⚠️ Condições detectadas: diabetes')).toBeVisible();
  });

  test('should show gamification features throughout the flow', async ({ page }) => {
    await page.goto('/health-questionnaire');
    
    // Verify points display in header
    await expect(page.locator('[data-testid="points-counter"]')).toBeVisible();
    
    // Mock points earning
    await page.route('**/api/gamification/progress', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            points: 250,
            level: 'Bronze',
            badges: ['first_questionnaire', 'health_conscious']
          }
        })
      });
    });
    
    // Fill a question to trigger points
    await page.fill('input[type="number"]:first', '175');
    
    // Check for points animation
    await expect(page.locator('[data-testid="points-animation"]')).toBeVisible({ timeout: 3000 });
  });

  test('should handle validation errors appropriately', async ({ page }) => {
    await page.goto('/company-info');
    
    // Try to submit without filling required fields
    await page.click('button:has-text("Próximo")');
    
    // Check for validation errors
    await expect(page.locator('text=Campo obrigatório')).toBeVisible();
    await expect(page.locator('input[aria-invalid="true"]')).toHaveCount(7); // All required fields
    
    // Fill invalid CPF
    await page.fill('input[placeholder*="CPF"]', '12345678900'); // Invalid CPF
    await page.locator('input[placeholder*="CPF"]').blur();
    
    await expect(page.locator('text=CPF inválido')).toBeVisible();
  });

  test('should work correctly on mobile devices', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size
    
    await page.goto('/register');
    
    // Verify mobile-optimized layout
    await expect(page.locator('[data-testid="mobile-header"]')).toBeVisible();
    
    // Test touch interactions
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    
    // Verify form is usable on mobile
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveValue(testUser.email);
    
    // Test responsive navigation
    await expect(page.locator('[data-testid="progress-indicator"]')).toBeVisible();
  });

  test('should maintain progress between sessions', async ({ page, context }) => {
    // Start registration
    await page.goto('/register');
    await page.fill('input[type="email"]', testUser.email);
    
    // Mock partial registration save
    await page.route('**/api/register/step1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { token: 'fake-jwt-token', progress: 'step1_completed' }
        })
      });
    });
    
    await page.fill('input[type="password"]', testUser.password);
    await page.fill('input[placeholder*="confirme"]', testUser.password);
    await page.click('button[type="submit"]');
    
    // Simulate page refresh/return
    await page.reload();
    
    // Should remember progress and redirect to correct step
    await expect(page).toHaveURL(/.*company-info/);
  });

  test('should handle API failures gracefully', async ({ page }) => {
    await page.goto('/health-questionnaire');
    
    // Mock API failure
    await page.route('**/api/health-questionnaires/templates', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    await page.reload();
    
    // Should show error message
    await expect(page.locator('text=Erro ao carregar questionário')).toBeVisible();
    await expect(page.locator('button:has-text("Tentar novamente")')).toBeVisible();
  });
});