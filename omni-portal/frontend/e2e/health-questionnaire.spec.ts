import { test, expect } from '@playwright/test';

test.describe('Health Questionnaire Features', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'fake-jwt-token');
    });

    // Mock questionnaire template
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
            estimated_minutes: 15,
            sections: [
              {
                title: 'Informações Básicas de Saúde',
                description: 'Dados gerais sobre sua saúde',
                questions: [
                  {
                    id: 'height',
                    text: 'Qual é sua altura? (em cm)',
                    type: 'number',
                    required: true,
                    validation: { min: 50, max: 250 }
                  },
                  {
                    id: 'weight',
                    text: 'Qual é seu peso? (em kg)',
                    type: 'number',
                    required: true,
                    validation: { min: 20, max: 300 }
                  },
                  {
                    id: 'blood_type',
                    text: 'Qual é seu tipo sanguíneo?',
                    type: 'select',
                    required: false,
                    options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Não sei']
                  },
                  {
                    id: 'chronic_conditions',
                    text: 'Você possui alguma condição crônica de saúde?',
                    type: 'multiselect',
                    required: true,
                    options: ['Diabetes', 'Hipertensão', 'Doença cardíaca', 'Asma', 'Nenhuma']
                  }
                ]
              },
              {
                title: 'Estilo de Vida',
                description: 'Hábitos que impactam sua saúde',
                questions: [
                  {
                    id: 'smoking',
                    text: 'Você fuma?',
                    type: 'select',
                    required: true,
                    options: ['Nunca fumei', 'Ex-fumante', 'Fumo ocasionalmente', 'Fumo diariamente']
                  },
                  {
                    id: 'exercise_frequency',
                    text: 'Quantas vezes por semana você pratica exercícios físicos?',
                    type: 'select',
                    required: true,
                    options: ['Nunca', '1-2 vezes', '3-4 vezes', '5-6 vezes', 'Todos os dias']
                  },
                  {
                    id: 'stress_level',
                    text: 'Como você classificaria seu nível de estresse?',
                    type: 'scale',
                    required: true,
                    scale: { min: 1, max: 10, labels: ['Muito baixo', 'Muito alto'] }
                  }
                ]
              }
            ]
          }]
        })
      });
    });

    // Mock questionnaire start
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

    await page.goto('/health-questionnaire');
  });

  test('should display questionnaire with correct sections and questions', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Questionário de Saúde Inicial');
    await expect(page.locator('text=Seção 1 de 2')).toBeVisible();
    await expect(page.locator('text=Tempo estimado: 15 min')).toBeVisible();

    // Check first section questions
    await expect(page.locator('text=Informações Básicas de Saúde')).toBeVisible();
    await expect(page.locator('text=Qual é sua altura?')).toBeVisible();
    await expect(page.locator('text=Qual é seu peso?')).toBeVisible();
    await expect(page.locator('text=Qual é seu tipo sanguíneo?')).toBeVisible();
    await expect(page.locator('text=Você possui alguma condição crônica')).toBeVisible();
  });

  test('should validate required fields before proceeding', async ({ page }) => {
    // Try to proceed without filling required fields
    await page.click('button:has-text("Próximo")');

    // Should show validation errors
    await expect(page.locator('text=Este campo é obrigatório')).toHaveCount(3); // height, weight, chronic_conditions
    
    // Fill some required fields
    await page.fill('input[type="number"]', '175');
    await page.fill('input[type="number"]', '70');
    
    // Select chronic condition
    await page.check('input[type="checkbox"]'); // First checkbox (Diabetes)
    
    // Now should be able to proceed
    await page.click('button:has-text("Próximo")');
    
    // Should move to next section
    await expect(page.locator('text=Seção 2 de 2')).toBeVisible();
    await expect(page.locator('text=Estilo de Vida')).toBeVisible();
  });

  test('should handle different question types correctly', async ({ page }) => {
    // Number input
    await page.fill('input[type="number"]:first-of-type', '175');
    await expect(page.locator('input[type="number"]:first-of-type')).toHaveValue('175');

    // Select dropdown
    await page.selectOption('select', 'A+');
    await expect(page.locator('select')).toHaveValue('A+');

    // Multiselect checkboxes
    await page.check('text=Diabetes');
    await page.check('text=Hipertensão');
    await expect(page.locator('input[type="checkbox"]:checked')).toHaveCount(2);

    // Proceed to next section for more question types
    await page.fill('input[type="number"]:last', '70');
    await page.check('text=Nenhuma'); // This should uncheck others
    await page.click('button:has-text("Próximo")');

    // Scale/range input
    await expect(page.locator('input[type="range"]')).toBeVisible();
    await page.locator('input[type="range"]').fill('7');
    await expect(page.locator('text=7')).toBeVisible(); // Value display
  });

  test('should show progress correctly', async ({ page }) => {
    // Initial progress should be 0%
    await expect(page.locator('[data-testid="progress-bar"]')).toHaveAttribute('aria-valuenow', '0');

    // Fill first section
    await page.fill('input[type="number"]:first-of-type', '175');
    await page.fill('input[type="number"]:last', '70');
    await page.selectOption('select', 'A+');
    await page.check('text=Nenhuma');

    // Mock progress response
    await page.route('**/api/health-questionnaires/*/responses', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await page.click('button:has-text("Próximo")');

    // Progress should update to 50%
    await expect(page.locator('text=Seção 2 de 2')).toBeVisible();
  });

  test('should integrate AI assistant correctly', async ({ page }) => {
    // Open AI assistant
    // AI Assistant button removed for clean clinical UX
    
    await expect(page.locator('[data-testid="ai-chat"]')).toBeVisible();
    await expect(page.locator('text=💡 Dica do Assistente')).toBeVisible();

    // Mock AI response
    await page.route('**/api/health-questionnaires/*/ai-insights', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            response: 'Hipertensão, ou pressão alta, é uma condição em que a pressão do sangue nas artérias está elevada.',
            confidence: 0.95,
            follow_up_questions: ['Você tem histórico familiar de hipertensão?'],
            detected_conditions: ['hipertensão'],
            recommendations: ['Reduzir consumo de sal', 'Exercitar-se regularmente']
          }
        })
      });
    });

    // Ask a question
    await page.fill('input[placeholder*="dúvida"]', 'O que é hipertensão?');
    await page.click('button:has-text("→")');

    // Verify AI response appears
    await expect(page.locator('text=Hipertensão, ou pressão alta')).toBeVisible();
    await expect(page.locator('text=⚠️ Condições detectadas: hipertensão')).toBeVisible();

    // Verify follow-up questions
    await expect(page.locator('text=Você tem histórico familiar de hipertensão?')).toBeVisible();
  });

  test('should handle AI service failures gracefully', async ({ page }) => {
    // AI Assistant button removed for clean clinical UX

    // Mock AI service failure
    await page.route('**/api/health-questionnaires/*/ai-insights', async route => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'AI service temporarily unavailable'
        })
      });
    });

    await page.fill('input[placeholder*="dúvida"]', 'Teste pergunta');
    await page.click('button:has-text("→")');

    // Should show error message
    await expect(page.locator('text=não foi possível processar')).toBeVisible();
  });

  test('should show gamification elements', async ({ page }) => {
    // Points counter should be visible
    await expect(page.locator('[data-testid="points-counter"]')).toBeVisible();

    // Mock points animation after answering question
    await page.fill('input[type="number"]:first-of-type', '175');

    // Should show points animation
    await expect(page.locator('text=+50 pontos')).toBeVisible({ timeout: 2000 });
  });

  test('should save progress and allow resuming', async ({ page }) => {
    // Fill partial data
    await page.fill('input[type="number"]:first-of-type', '175');
    await page.selectOption('select', 'A+');

    // Mock auto-save
    await page.route('**/api/health-questionnaires/*/responses', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    // Trigger auto-save by blurring field
    await page.locator('input[type="number"]:first-of-type').blur();

    // Refresh page to simulate returning
    await page.reload();

    // Data should be preserved
    await expect(page.locator('input[type="number"]:first-of-type')).toHaveValue('175');
    await expect(page.locator('select')).toHaveValue('A+');
  });

  test('should complete questionnaire and show results', async ({ page }) => {
    // Fill all required fields in first section
    await page.fill('input[type="number"]:first-of-type', '175');
    await page.fill('input[type="number"]:last', '70');
    await page.check('text=Nenhuma');

    await page.click('button:has-text("Próximo")');

    // Fill second section
    await page.selectOption('select:first-of-type', 'Nunca fumei');
    await page.selectOption('select:last', '3-4 vezes');
    await page.locator('input[type="range"]').fill('5');

    // Mock completion
    await page.route('**/api/health-questionnaires/*/responses', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            score: 5.2,
            risk_level: 'low',
            recommendations: {
              lifestyle: ['Manter atividade física regular'],
              diet: ['Dieta equilibrada'],
              exercise: ['Continuar exercícios 3-4x por semana']
            }
          }
        })
      });
    });

    await page.click('button:has-text("Finalizar")');

    // Should navigate to document upload
    await expect(page).toHaveURL(/.*document-upload/);
  });

  test('should work on mobile devices', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Verify mobile layout
    await expect(page.locator('[data-testid="mobile-questionnaire"]')).toBeVisible();

    // Test touch interactions
    await page.fill('input[type="number"]:first-of-type', '175');
    await page.tap('select');
    await page.selectOption('select', 'A+');

    // AI assistant should work on mobile
    // AI Assistant button removed for clean clinical UX
    await expect(page.locator('[data-testid="ai-chat"]')).toBeVisible();
  });

  test('should validate field constraints', async ({ page }) => {
    // Test height validation
    await page.fill('input[type="number"]:first-of-type', '300'); // Above max
    await page.locator('input[type="number"]:first-of-type').blur();
    await expect(page.locator('text=Valor máximo: 250')).toBeVisible();

    await page.fill('input[type="number"]:first-of-type', '30'); // Below min
    await page.locator('input[type="number"]:first-of-type').blur();
    await expect(page.locator('text=Valor mínimo: 50')).toBeVisible();

    // Test weight validation
    await page.fill('input[type="number"]:last', '400'); // Above max
    await page.locator('input[type="number"]:last').blur();
    await expect(page.locator('text=Valor máximo: 300')).toBeVisible();
  });
});