import { test, expect } from '@playwright/test';

test.describe('Health Questionnaire E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login to access protected questionnaire
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('complete PHQ-9 questionnaire with branching logic', async ({ page }) => {
    // Navigate to questionnaire
    await page.goto('/health/questionnaire');

    // Verify feature flag guard - questionnaire should load
    await expect(page.locator('h1')).toContainText('Health Assessment');

    // Verify initial page load analytics event
    await page.waitForResponse(response =>
      response.url().includes('/api/analytics') &&
      response.request().method() === 'POST'
    );

    // Fill PHQ-9 (9 questions) - indicating moderate depression
    for (let i = 0; i < 9; i++) {
      await page.click(`[name="phq9.${i}"][value="2"]`); // "More than half the days"
    }

    // Track page turn analytics event
    const analyticsPromise = page.waitForResponse(response =>
      response.url().includes('/api/analytics') &&
      response.request().postDataJSON()?.event === 'questionnaire_page_turn'
    );

    await page.click('button:has-text("Next")');
    await analyticsPromise;

    // GAD-7 should appear due to branching logic (PHQ-9 score > threshold)
    await expect(page.locator('h2')).toContainText('Anxiety Assessment');

    // Fill GAD-7 (7 questions)
    for (let i = 0; i < 7; i++) {
      await page.click(`[name="gad7.${i}"][value="1"]`);
    }

    // Submit questionnaire
    const submitPromise = page.waitForResponse(response =>
      response.url().includes('/api/health/questionnaire') &&
      response.request().method() === 'POST'
    );

    await page.click('button:has-text("Submit")');
    const submitResponse = await submitPromise;

    // Verify NO PHI in response
    const responseBody = await submitResponse.json();
    expect(responseBody).not.toHaveProperty('answers');
    expect(responseBody).not.toHaveProperty('phq9');
    expect(responseBody).not.toHaveProperty('gad7');

    // Verify completion page with risk band (NO PHI)
    await page.waitForURL('/health/questionnaire/complete');
    await expect(page.locator('[data-testid="risk-band"]')).toContainText('moderate');
    await expect(page.locator('[data-testid="score"]')).toBeVisible();

    // Verify NO PHI in page source or localStorage
    const pageContent = await page.content();
    expect(pageContent).not.toContain('phq9');
    expect(pageContent).not.toContain('answers');
    expect(pageContent).not.toContain('gad7');

    const localStorage = await page.evaluate(() => JSON.stringify(window.localStorage));
    expect(localStorage).not.toContain('phq9');
    expect(localStorage).not.toContain('answers');
  });

  test('resume from draft after page refresh', async ({ page }) => {
    await page.goto('/health/questionnaire');

    // Fill partial questionnaire
    await page.click('[name="phq9.0"][value="1"]');
    await page.click('[name="phq9.1"][value="2"]');
    await page.click('[name="phq9.2"][value="0"]');

    // Wait for auto-save debounce (3 seconds)
    await page.waitForTimeout(3500);

    // Verify draft saved to server (not localStorage - HIPAA compliant)
    const draftResponse = await page.waitForResponse(response =>
      response.url().includes('/api/health/questionnaire/draft') &&
      response.request().method() === 'POST'
    );
    expect(draftResponse.status()).toBe(200);

    // Refresh page
    await page.reload();

    // Wait for draft restoration
    await page.waitForLoadState('networkidle');

    // Verify draft restored from server
    await expect(page.locator('[name="phq9.0"][value="1"]')).toBeChecked();
    await expect(page.locator('[name="phq9.1"][value="2"]')).toBeChecked();
    await expect(page.locator('[name="phq9.2"][value="0"]')).toBeChecked();

    // Verify progress indicator shows correct position
    await expect(page.locator('[data-testid="progress"]')).toContainText('3 of 9');
  });

  test('accessibility: keyboard navigation and ARIA', async ({ page }) => {
    await page.goto('/health/questionnaire');

    // Verify ARIA landmarks
    await expect(page.locator('main[role="main"]')).toBeVisible();
    await expect(page.locator('[role="radiogroup"]')).toHaveCount(9); // 9 PHQ-9 questions

    // Tab to first question
    await page.keyboard.press('Tab');
    const firstFocused = await page.locator(':focus');
    await expect(firstFocused).toHaveAttribute('name', 'phq9.0');

    // Arrow keys to navigate radio options
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[name="phq9.0"][value="1"]')).toBeChecked();

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[name="phq9.0"][value="2"]')).toBeChecked();

    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[name="phq9.0"][value="1"]')).toBeChecked();

    // Tab to next question
    await page.keyboard.press('Tab');
    const secondFocused = await page.locator(':focus');
    await expect(secondFocused).toHaveAttribute('name', 'phq9.1');

    // Verify screen reader announcements
    const ariaLive = page.locator('[aria-live="polite"]');
    await expect(ariaLive).toBeVisible();
  });

  test('branching logic triggers correct sections', async ({ page }) => {
    await page.goto('/health/questionnaire');

    // Fill PHQ-9 with LOW scores (should NOT trigger GAD-7)
    for (let i = 0; i < 9; i++) {
      await page.click(`[name="phq9.${i}"][value="0"]`); // "Not at all"
    }

    await page.click('button:has-text("Next")');

    // Should go directly to completion (no GAD-7 section)
    await page.waitForURL('/health/questionnaire/complete');
    await expect(page.locator('[data-testid="risk-band"]')).toContainText('minimal');

    // Start new questionnaire with HIGH scores
    await page.goto('/health/questionnaire');

    // Fill PHQ-9 with HIGH scores (SHOULD trigger GAD-7)
    for (let i = 0; i < 9; i++) {
      await page.click(`[name="phq9.${i}"][value="3"]`); // "Nearly every day"
    }

    await page.click('button:has-text("Next")');

    // GAD-7 section should appear
    await expect(page.locator('h2')).toContainText('Anxiety Assessment');
    await expect(page.locator('[name="gad7.0"]')).toBeVisible();
  });

  test('analytics events fire correctly throughout flow', async ({ page }) => {
    await page.goto('/health/questionnaire');

    // Track all analytics events
    const analyticsEvents: Array<{ event: string; timestamp: number }> = [];

    page.on('response', async (response) => {
      if (response.url().includes('/api/analytics') && response.request().method() === 'POST') {
        try {
          const data = await response.request().postDataJSON();
          analyticsEvents.push({
            event: data.event,
            timestamp: Date.now()
          });
        } catch (e) {
          // Ignore parsing errors
        }
      }
    });

    // Complete questionnaire
    for (let i = 0; i < 9; i++) {
      await page.click(`[name="phq9.${i}"][value="2"]`);
    }

    await page.click('button:has-text("Next")');

    // Wait for page turn event
    await page.waitForTimeout(500);

    // Fill GAD-7
    for (let i = 0; i < 7; i++) {
      await page.click(`[name="gad7.${i}"][value="1"]`);
    }

    await page.click('button:has-text("Submit")');
    await page.waitForURL('/health/questionnaire/complete');

    // Verify expected analytics events fired
    const eventTypes = analyticsEvents.map(e => e.event);
    expect(eventTypes).toContain('questionnaire_started');
    expect(eventTypes).toContain('questionnaire_page_turn');
    expect(eventTypes).toContain('questionnaire_completed');

    // Verify events are in chronological order
    for (let i = 1; i < analyticsEvents.length; i++) {
      expect(analyticsEvents[i].timestamp).toBeGreaterThanOrEqual(analyticsEvents[i - 1].timestamp);
    }
  });

  test('error handling: network failure during submission', async ({ page }) => {
    await page.goto('/health/questionnaire');

    // Fill complete questionnaire
    for (let i = 0; i < 9; i++) {
      await page.click(`[name="phq9.${i}"][value="2"]`);
    }

    await page.click('button:has-text("Next")');

    for (let i = 0; i < 7; i++) {
      await page.click(`[name="gad7.${i}"][value="1"]`);
    }

    // Intercept submission and simulate network error
    await page.route('**/api/health/questionnaire', route => {
      route.abort('failed');
    });

    await page.click('button:has-text("Submit")');

    // Verify error message displayed
    await expect(page.locator('[role="alert"]')).toContainText('network error');

    // Verify user can retry
    await expect(page.locator('button:has-text("Retry")')).toBeVisible();

    // Verify answers are still present (not lost)
    await expect(page.locator('[name="gad7.0"][value="1"]')).toBeChecked();
  });

  test('feature flag: questionnaire disabled', async ({ page }) => {
    // Mock feature flag API to return disabled
    await page.route('**/api/feature-flags**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          questionnaire_enabled: false
        })
      });
    });

    await page.goto('/health/questionnaire');

    // Verify feature unavailable message
    await expect(page.locator('[data-testid="feature-disabled"]')).toBeVisible();
    await expect(page.locator('[data-testid="feature-disabled"]')).toContainText('temporarily unavailable');

    // Verify questionnaire form is NOT rendered
    await expect(page.locator('[name="phq9.0"]')).not.toBeVisible();
  });

  test('progress indicator updates correctly', async ({ page }) => {
    await page.goto('/health/questionnaire');

    // Initial state
    await expect(page.locator('[data-testid="progress"]')).toContainText('0 of 9');
    await expect(page.locator('[data-testid="progress-bar"]')).toHaveAttribute('aria-valuenow', '0');

    // Answer first question
    await page.click('[name="phq9.0"][value="1"]');
    await expect(page.locator('[data-testid="progress"]')).toContainText('1 of 9');
    await expect(page.locator('[data-testid="progress-bar"]')).toHaveAttribute('aria-valuenow', '11'); // ~11%

    // Answer all PHQ-9 questions
    for (let i = 1; i < 9; i++) {
      await page.click(`[name="phq9.${i}"][value="1"]`);
    }

    await expect(page.locator('[data-testid="progress"]')).toContainText('9 of 9');
    await expect(page.locator('[data-testid="progress-bar"]')).toHaveAttribute('aria-valuenow', '100');
  });

  test('validation: cannot submit incomplete questionnaire', async ({ page }) => {
    await page.goto('/health/questionnaire');

    // Fill only first 5 questions
    for (let i = 0; i < 5; i++) {
      await page.click(`[name="phq9.${i}"][value="1"]`);
    }

    // Try to proceed
    await page.click('button:has-text("Next")');

    // Verify validation error
    await expect(page.locator('[role="alert"]')).toContainText('complete all questions');

    // Verify still on same page
    await expect(page).toHaveURL(/\/health\/questionnaire$/);

    // Complete remaining questions
    for (let i = 5; i < 9; i++) {
      await page.click(`[name="phq9.${i}"][value="1"]`);
    }

    // Now should proceed successfully
    await page.click('button:has-text("Next")');
    await expect(page.locator('h2')).toContainText('Anxiety Assessment');
  });

  test('mobile responsive: questionnaire works on small screens', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/health/questionnaire');

    // Verify mobile layout
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[name="phq9.0"]')).toBeVisible();

    // Verify radio buttons are touch-friendly (at least 44x44px)
    const radioButton = page.locator('[name="phq9.0"][value="0"]');
    const boundingBox = await radioButton.boundingBox();
    expect(boundingBox?.width).toBeGreaterThanOrEqual(44);
    expect(boundingBox?.height).toBeGreaterThanOrEqual(44);

    // Complete questionnaire on mobile
    for (let i = 0; i < 9; i++) {
      await page.click(`[name="phq9.${i}"][value="1"]`);
    }

    await page.click('button:has-text("Next")');
    await page.waitForURL(/\/health\/questionnaire\/complete$/);
  });
});
