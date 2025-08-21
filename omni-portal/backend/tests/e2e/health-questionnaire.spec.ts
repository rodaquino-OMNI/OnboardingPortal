import { test, expect } from '@playwright/test';
import { loginUser, fillHealthQuestionnaire, checkGamificationProgress, TEST_USERS, waitForApiResponse, checkConsoleErrors } from './helpers/test-helpers';

test.describe('Health Questionnaire Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginUser(page, TEST_USERS.demo);
    await checkConsoleErrors(page);
  });

  test('should complete health questionnaire successfully', async ({ page }) => {
    const responses = {
      'general_health': 'good',
      'chronic_conditions': false,
      'medications': 'none',
      'allergies': false,
      'exercise_frequency': '3-4 times per week',
      'smoking_status': 'never',
      'alcohol_consumption': 'occasional',
      'stress_level': 5,
      'sleep_hours': 7,
      'mental_health': 'good'
    };

    await fillHealthQuestionnaire(page, responses);
    
    // Verify successful completion
    await expect(page.locator('[data-testid="questionnaire-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('completed successfully');
    
    // Check that gamification points were awarded
    const progress = await checkGamificationProgress(page);
    expect(progress.points).toBeGreaterThan(0);
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/health-questionnaire');
    
    // Try to submit without filling required fields
    await page.click('button[data-testid="submit-questionnaire"]');
    
    // Should see validation errors
    await expect(page.locator('[data-testid="validation-errors"]')).toBeVisible();
    await expect(page.locator('[data-testid="general-health-error"]')).toBeVisible();
  });

  test('should save progress and allow continuation', async ({ page }) => {
    await page.goto('/health-questionnaire');
    
    // Fill partial questionnaire
    await page.selectOption('select[name="general_health"]', 'good');
    await page.check('input[name="chronic_conditions"][value="false"]');
    
    // Navigate away
    await page.goto('/dashboard');
    
    // Return to questionnaire
    await page.goto('/health-questionnaire');
    
    // Should have preserved previous responses
    await expect(page.locator('select[name="general_health"]')).toHaveValue('good');
    await expect(page.locator('input[name="chronic_conditions"][value="false"]')).toBeChecked();
  });

  test('should handle chronic conditions follow-up questions', async ({ page }) => {
    await page.goto('/health-questionnaire');
    
    // Select that user has chronic conditions
    await page.check('input[name="chronic_conditions"][value="true"]');
    
    // Follow-up questions should appear
    await expect(page.locator('[data-testid="chronic-conditions-details"]')).toBeVisible();
    
    // Fill follow-up
    await page.check('input[name="diabetes"]');
    await page.check('input[name="hypertension"]');
    await page.fill('textarea[name="condition_details"]', 'Well-controlled diabetes and mild hypertension');
    
    // Submit questionnaire
    await page.click('button[data-testid="submit-questionnaire"]');
    
    // Should complete successfully with chronic conditions
    await expect(page.locator('[data-testid="questionnaire-success"]')).toBeVisible();
  });

  test('should handle medication details questions', async ({ page }) => {
    await page.goto('/health-questionnaire');
    
    // Select that user takes medications
    await page.selectOption('select[name="medications"]', 'prescription');
    
    // Medication details section should appear
    await expect(page.locator('[data-testid="medication-details"]')).toBeVisible();
    
    // Fill medication details
    await page.fill('textarea[name="medication_list"]', 'Metformin 500mg twice daily\nLisinopril 10mg once daily');
    
    // Submit questionnaire
    await page.click('button[data-testid="submit-questionnaire"]');
    
    // Should complete successfully
    await expect(page.locator('[data-testid="questionnaire-success"]')).toBeVisible();
  });

  test('should handle stress level assessment', async ({ page }) => {
    await page.goto('/health-questionnaire');
    
    // Use stress level slider
    const stressSlider = page.locator('input[name="stress_level"]');
    await stressSlider.fill('8'); // High stress level
    
    // High stress follow-up should appear
    await expect(page.locator('[data-testid="stress-followup"]')).toBeVisible();
    
    // Fill stress management questions
    await page.check('input[name="stress_management"][value="exercise"]');
    await page.check('input[name="stress_management"][value="meditation"]');
    
    // Submit questionnaire
    await page.click('button[data-testid="submit-questionnaire"]');
    
    // Should complete successfully
    await expect(page.locator('[data-testid="questionnaire-success"]')).toBeVisible();
  });

  test('should handle mental health screening', async ({ page }) => {
    await page.goto('/health-questionnaire');
    
    // Navigate to mental health section
    await page.click('[data-testid="mental-health-section"]');
    
    // Fill PHQ-9 questions (depression screening)
    for (let i = 1; i <= 9; i++) {
      await page.selectOption(`select[name="phq9_${i}"]`, '2'); // Several days
    }
    
    // Fill GAD-7 questions (anxiety screening)
    for (let i = 1; i <= 7; i++) {
      await page.selectOption(`select[name="gad7_${i}"]`, '1'); // Not at all
    }
    
    // Submit questionnaire
    await page.click('button[data-testid="submit-questionnaire"]');
    
    // Should complete with mental health assessment
    await expect(page.locator('[data-testid="questionnaire-success"]')).toBeVisible();
  });

  test('should trigger crisis intervention for high-risk responses', async ({ page }) => {
    await page.goto('/health-questionnaire');
    
    // Navigate to mental health section
    await page.click('[data-testid="mental-health-section"]');
    
    // Answer suicide risk question positively
    await page.selectOption('select[name="phq9_9"]', '3'); // Nearly every day
    
    // Crisis intervention should trigger immediately
    await expect(page.locator('[data-testid="crisis-intervention"]')).toBeVisible();
    await expect(page.locator('[data-testid="crisis-hotline"]')).toBeVisible();
    await expect(page.locator('[data-testid="emergency-contacts"]')).toBeVisible();
    
    // Should not allow questionnaire submission without acknowledging
    const submitButton = page.locator('button[data-testid="submit-questionnaire"]');
    await expect(submitButton).toBeDisabled();
    
    // Acknowledge crisis resources
    await page.check('input[name="crisis_acknowledged"]');
    
    // Submit button should be enabled
    await expect(submitButton).toBeEnabled();
  });

  test('should handle questionnaire in mobile view', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip(); // Only run on mobile
    }

    await page.goto('/health-questionnaire');
    
    // Mobile-specific navigation should be present
    await expect(page.locator('[data-testid="mobile-progress-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-section-nav"]')).toBeVisible();
    
    // Touch-friendly sliders should work
    const stressSlider = page.locator('[data-testid="touch-slider-stress"]');
    await stressSlider.tap();
    
    // Complete questionnaire on mobile
    const responses = {
      'general_health': 'good',
      'chronic_conditions': false,
      'stress_level': 5
    };
    
    await fillHealthQuestionnaire(page, responses);
    await expect(page.locator('[data-testid="questionnaire-success"]')).toBeVisible();
  });

  test('should validate questionnaire completion tracking', async ({ page }) => {
    // Check initial completion status
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="health-questionnaire-incomplete"]')).toBeVisible();
    
    // Complete questionnaire
    const responses = {
      'general_health': 'excellent',
      'chronic_conditions': false,
      'medications': 'none',
      'stress_level': 3
    };
    
    await fillHealthQuestionnaire(page, responses);
    
    // Return to dashboard
    await page.goto('/dashboard');
    
    // Should show as completed
    await expect(page.locator('[data-testid="health-questionnaire-complete"]')).toBeVisible();
    await expect(page.locator('[data-testid="health-questionnaire-incomplete"]')).not.toBeVisible();
  });

  test('should handle questionnaire API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/health-questionnaire', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal server error' })
      });
    });
    
    await page.goto('/health-questionnaire');
    
    // Fill minimal required fields
    await page.selectOption('select[name="general_health"]', 'good');
    await page.click('button[data-testid="submit-questionnaire"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('error');
    
    // Form should remain editable
    await expect(page.locator('select[name="general_health"]')).toBeEnabled();
  });

  test('should track questionnaire completion time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/health-questionnaire');
    
    // Fill questionnaire quickly
    const responses = {
      'general_health': 'good',
      'chronic_conditions': false,
      'medications': 'none',
      'stress_level': 5
    };
    
    await fillHealthQuestionnaire(page, responses);
    
    const endTime = Date.now();
    const completionTime = endTime - startTime;
    
    // Verify completion time is tracked (reasonable range)
    expect(completionTime).toBeGreaterThan(1000); // At least 1 second
    expect(completionTime).toBeLessThan(300000); // Less than 5 minutes
  });

  test('should provide health recommendations based on responses', async ({ page }) => {
    await page.goto('/health-questionnaire');
    
    // Fill questionnaire with responses that should generate recommendations
    const responses = {
      'general_health': 'poor',
      'chronic_conditions': true,
      'diabetes': true,
      'exercise_frequency': 'never',
      'smoking_status': 'current',
      'stress_level': 9,
      'sleep_hours': 4
    };
    
    await fillHealthQuestionnaire(page, responses);
    
    // Should see health recommendations
    await expect(page.locator('[data-testid="health-recommendations"]')).toBeVisible();
    await expect(page.locator('[data-testid="exercise-recommendation"]')).toBeVisible();
    await expect(page.locator('[data-testid="smoking-cessation-resources"]')).toBeVisible();
    await expect(page.locator('[data-testid="stress-management-resources"]')).toBeVisible();
  });

  test('should handle questionnaire version updates', async ({ page }) => {
    // Mock API response indicating questionnaire update available
    await page.route('**/api/health-questionnaire/version', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          current_version: '2.0',
          user_version: '1.0',
          update_required: true 
        })
      });
    });
    
    await page.goto('/health-questionnaire');
    
    // Should show update notification
    await expect(page.locator('[data-testid="questionnaire-update-notice"]')).toBeVisible();
    await expect(page.locator('[data-testid="update-notice"]')).toContainText('updated questionnaire');
  });
});