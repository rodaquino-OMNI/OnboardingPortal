/**
 * Critical Fixes Validation - End-to-End Test Suite
 * Validates the complete user journey with both gamification and health questionnaire fixes
 */

import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

// Test configuration
const testConfig = {
  user: {
    email: `test.${Date.now()}@example.com`,
    password: 'TestPass123!@#',
    fullName: faker.person.fullName(),
    cpf: '12345678901',
    phone: '11987654321',
    birthDate: '1990-05-15'
  },
  timeouts: {
    apiResponse: 5000,
    pageLoad: 10000,
    animation: 2000
  }
};

test.describe('Critical Fixes Validation - Complete User Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Setup API mocks for consistent testing
    await setupAPIMocks(page);
  });

  test('should complete full onboarding with gamification and health questionnaire fixes', async ({ page }) => {
    // Start timing for performance validation
    const startTime = Date.now();

    // Step 1: Registration with gamification tracking
    await page.goto('/register');
    
    await expect(page.locator('h1')).toContainText('Criar Conta');

    // Verify gamification elements are present
    await expect(page.locator('[data-testid="points-display"]')).toBeVisible();
    await expect(page.getByText('0 pontos')).toBeVisible();

    // Fill registration form
    await page.fill('input[type="email"]', testConfig.user.email);
    await page.fill('input[type="password"]', testConfig.user.password);
    await page.fill('input[placeholder*="confirme"]', testConfig.user.password);

    // Submit and verify gamification points awarded
    await page.click('button[type="submit"]');

    // Wait for registration success and points animation
    await expect(page.locator('[data-testid="points-animation"]')).toBeVisible({ 
      timeout: testConfig.timeouts.animation 
    });
    await expect(page.getByText('25 pontos')).toBeVisible(); // Registration completion points

    // Step 2: Company Information with validation
    await expect(page).toHaveURL(/.*company-info/);
    await expect(page.locator('h1')).toContainText('Informações da Empresa');

    await page.fill('input[placeholder*="nome completo"]', testConfig.user.fullName);
    await page.fill('input[placeholder*="CPF"]', testConfig.user.cpf);
    await page.fill('input[type="tel"]', testConfig.user.phone);
    await page.fill('input[type="date"]', testConfig.user.birthDate);

    await page.click('button:has-text("Próximo")');

    // Verify more points awarded
    await expect(page.getByText('75 pontos')).toBeVisible(); // Profile completion points

    // Step 3: Unified Health Questionnaire
    await expect(page).toHaveURL(/.*health-questionnaire/);
    await expect(page.locator('h1')).toContainText('Avaliação de Saúde');

    // Verify unified health questionnaire components
    await expect(page.locator('[data-testid="health-progress-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="domain-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="time-estimate"]')).toBeVisible();

    // Test dynamic question flow
    await testHealthQuestionnaireFlow(page);

    // Verify health questionnaire completion points
    await expect(page.locator('[data-testid="badge-notification"]')).toBeVisible();
    await expect(page.getByText('Health Assessment Expert')).toBeVisible();

    // Step 4: Document Upload
    await expect(page).toHaveURL(/.*document-upload/);
    
    // Test file upload with progress tracking
    await testDocumentUpload(page);

    // Step 5: Final completion with comprehensive gamification
    await expect(page).toHaveURL(/.*completion/);
    await expect(page.locator('h1')).toContainText('Parabéns!');

    // Verify comprehensive gamification summary
    await validateGamificationSummary(page);

    // Performance validation
    const totalTime = Date.now() - startTime;
    expect(totalTime).toBeLessThan(60000); // Complete flow under 1 minute

    console.log(`Complete onboarding flow completed in ${totalTime}ms`);
  });

  test('should handle health questionnaire domain transitions correctly', async ({ page }) => {
    await page.goto('/health-questionnaire');

    // Start with triage questions
    await expect(page.getByText('Avaliação Inicial')).toBeVisible();
    
    // Answer age question
    await page.fill('input[placeholder*="idade"]', '45');
    await page.click('button:has-text("Próximo")');

    // Verify domain transition to emergency screening
    await expect(page.getByText('Triagem de Emergência')).toBeVisible();
    
    // Select no emergency conditions
    await page.click('input[value="none"]');
    await page.click('button:has-text("Próximo")');

    // Should transition to appropriate domain based on age
    await expect(page.getByText('Avaliação de Dor')).toBeVisible();
    
    // Test pain assessment
    await page.click('[data-testid="pain-scale-7"]');
    await page.click('button:has-text("Próximo")');

    // Should transition to pain management domain
    await expect(page.getByText('Gestão da Dor')).toBeVisible();
    
    // Verify progressive disclosure - should show relevant follow-up questions
    await expect(page.getByText('Há quanto tempo você sente essa dor?')).toBeVisible();
  });

  test('should maintain gamification state across page refreshes', async ({ page }) => {
    await page.goto('/health-questionnaire');

    // Earn some initial points
    await page.fill('input[placeholder*="idade"]', '30');
    await page.click('button:has-text("Próximo")');

    // Verify points awarded
    await expect(page.getByText('25 pontos')).toBeVisible();

    // Refresh the page
    await page.reload();

    // Points should persist
    await expect(page.getByText('25 pontos')).toBeVisible();
    
    // Progress should be maintained
    await expect(page.locator('[data-testid="health-progress-bar"]')).toHaveAttribute('aria-valuenow');
    const progress = await page.locator('[data-testid="health-progress-bar"]').getAttribute('aria-valuenow');
    expect(parseInt(progress || '0')).toBeGreaterThan(0);
  });

  test('should handle concurrent gamification events correctly', async ({ page }) => {
    await page.goto('/health-questionnaire');

    // Trigger multiple gamification events simultaneously
    const promises = [
      page.fill('input[placeholder*="idade"]', '35'),
      page.click('input[value="male"]'),
      page.click('input[value="no_emergency"]')
    ];

    await Promise.all(promises);
    await page.click('button:has-text("Próximo")');

    // Verify all points are correctly accumulated
    await expect(page.locator('[data-testid="points-display"]')).toBeVisible();
    
    // Should show combined points from all actions
    const pointsText = await page.locator('[data-testid="points-display"]').textContent();
    const points = parseInt(pointsText?.match(/\d+/)?.[0] || '0');
    expect(points).toBeGreaterThanOrEqual(75); // Minimum expected from all actions
  });

  test('should recover gracefully from API failures', async ({ page }) => {
    // Setup API failure scenarios
    await page.route('**/api/health-questionnaires/start', route => {
      route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    await page.goto('/health-questionnaire');

    // Should show error state
    await expect(page.getByText('Erro ao carregar questionário')).toBeVisible();
    await expect(page.getByText('Tentar novamente')).toBeVisible();

    // Fix API and retry
    await page.route('**/api/health-questionnaires/start', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { questionnaire_id: 1, current_question: 'age' }
        })
      });
    });

    await page.click('button:has-text("Tentar novamente")');

    // Should recover and show questionnaire
    await expect(page.getByText('Qual é sua idade?')).toBeVisible();
  });

  test('should validate mobile responsiveness for critical fixes', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/health-questionnaire');

    // Verify mobile-optimized health questionnaire
    await expect(page.locator('[data-testid="mobile-health-header"]')).toBeVisible();
    
    // Test touch-friendly controls
    await page.tap('[data-testid="pain-scale-slider"]');
    await expect(page.locator('[data-testid="touch-feedback"]')).toBeVisible();

    // Verify mobile gamification display
    await expect(page.locator('[data-testid="mobile-points-counter"]')).toBeVisible();
    
    // Test mobile navigation
    await page.tap('button:has-text("Próximo")');
    await expect(page.locator('[data-testid="mobile-progress-indicator"]')).toBeVisible();
  });

  test('should handle performance under load simulation', async ({ page }) => {
    const startTime = performance.now();

    // Navigate to health questionnaire
    await page.goto('/health-questionnaire');

    // Simulate rapid user interactions
    const rapidActions = [];
    for (let i = 0; i < 10; i++) {
      rapidActions.push(
        page.click(`[data-testid="quick-answer-${i % 3}"]`)
      );
    }

    await Promise.all(rapidActions);

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    // Should handle rapid interactions without performance degradation
    expect(processingTime).toBeLessThan(5000); // Under 5 seconds

    // Verify state consistency after rapid interactions
    await expect(page.locator('[data-testid="questionnaire-state"]')).toHaveAttribute('data-consistent', 'true');
  });

  test('should validate accessibility compliance for fixes', async ({ page }) => {
    await page.goto('/health-questionnaire');

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();

    // Test screen reader support
    const question = page.locator('[data-testid="current-question"]');
    await expect(question).toHaveAttribute('aria-label');
    await expect(question).toHaveAttribute('role', 'region');

    // Test high contrast mode compatibility
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('[data-testid="health-progress-bar"]')).toBeVisible();

    // Verify ARIA labels for gamification elements
    const pointsDisplay = page.locator('[data-testid="points-display"]');
    await expect(pointsDisplay).toHaveAttribute('aria-label', /pontos/);
  });
});

// Helper functions
async function setupAPIMocks(page: any) {
  // Mock gamification APIs
  await page.route('**/api/gamification/progress', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          points: 25,
          level: 1,
          badges: [],
          achievements: []
        }
      })
    });
  });

  await page.route('**/api/gamification/add-points', async (route: any) => {
    const requestData = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          new_total: 25 + (requestData.points || 0),
          level_up: false,
          points_added: requestData.points || 0
        }
      })
    });
  });

  // Mock unified health questionnaire APIs
  await page.route('**/api/health-questionnaires/start', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          questionnaire_id: 1,
          current_question: {
            id: 'age',
            text: 'Qual é sua idade?',
            type: 'number',
            domain: 'demographic'
          },
          progress: 0,
          estimated_time: 8
        }
      })
    });
  });

  await page.route('**/api/health-questionnaires/*/responses', async (route: any) => {
    const requestData = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          next_question: {
            id: 'gender',
            text: 'Qual é seu sexo biológico?',
            type: 'select',
            options: [
              { value: 'male', label: 'Masculino' },
              { value: 'female', label: 'Feminino' }
            ]
          },
          progress: 10,
          points_awarded: 25
        }
      })
    });
  });
}

async function testHealthQuestionnaireFlow(page: any) {
  // Test age question
  await page.fill('input[placeholder*="idade"]', '35');
  await page.click('button:has-text("Próximo")');

  // Verify points awarded for answering
  await expect(page.getByText('100 pontos')).toBeVisible();

  // Test gender selection
  await page.click('input[value="male"]');
  await page.click('button:has-text("Próximo")');

  // Test emergency screening
  await page.click('input[value="none"]');
  await page.click('button:has-text("Próximo")');

  // Test pain assessment with slider
  await page.click('[data-testid="pain-scale-3"]');
  await page.click('button:has-text("Próximo")');

  // Verify domain progression
  await expect(page.getByText('Avaliação Mental')).toBeVisible();
}

async function testDocumentUpload(page: any) {
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({
    name: 'rg.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('fake image content')
  });

  await page.click('button:has-text("Fazer Upload")');
  
  // Verify upload success with gamification
  await expect(page.getByText('Upload realizado com sucesso')).toBeVisible();
  await expect(page.locator('[data-testid="upload-badge"]')).toBeVisible();
}

async function validateGamificationSummary(page: any) {
  // Verify final point total
  const finalPoints = await page.locator('[data-testid="final-points"]').textContent();
  expect(parseInt(finalPoints?.match(/\d+/)?.[0] || '0')).toBeGreaterThan(200);

  // Verify badges earned
  await expect(page.locator('[data-testid="badges-earned"]')).toBeVisible();
  await expect(page.getByText('Health Assessment Expert')).toBeVisible();
  await expect(page.getByText('Document Upload Master')).toBeVisible();

  // Verify level progression
  await expect(page.locator('[data-testid="level-display"]')).toContainText('Nível');
  
  // Verify leaderboard position
  await expect(page.locator('[data-testid="leaderboard-position"]')).toBeVisible();
}