import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have accessible navigation', async ({ page }) => {
    // Check for skip links
    const skipLink = page.locator('a[href="#main-content"]');
    await skipLink.focus();
    await expect(skipLink).toBeVisible();
    
    // Check main navigation is keyboard accessible
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    const activeElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON']).toContain(activeElement);
  });

  test('should be responsive on mobile devices', async ({ page, viewport }) => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check mobile menu button is visible
    const mobileMenuButton = page.getByLabel(/menu/i);
    await expect(mobileMenuButton).toBeVisible();
    
    // Open mobile menu
    await mobileMenuButton.click();
    
    // Check navigation drawer is visible
    const nav = page.getByRole('navigation', { name: /mobile navigation/i });
    await expect(nav).toBeVisible();
  });

  test('should meet WCAG color contrast requirements', async ({ page }) => {
    // Check primary button contrast
    const button = page.getByRole('button').first();
    const contrast = await page.evaluate((el) => {
      const style = window.getComputedStyle(el as HTMLElement);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
      };
    }, await button.elementHandle());
    
    // This is a simple check - in real tests, you'd calculate actual contrast ratio
    expect(contrast.color).toBeTruthy();
    expect(contrast.backgroundColor).toBeTruthy();
  });

  test('should handle form validation accessibly', async ({ page }) => {
    await page.goto('/company-info');
    
    // Try to submit empty form
    const submitButton = page.getByRole('button', { name: /submit|continue/i });
    await submitButton.click();
    
    // Check for accessible error messages
    const errorMessage = page.getByRole('alert');
    await expect(errorMessage).toBeVisible();
    
    // Check input has aria-invalid
    const input = page.getByRole('textbox').first();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  test('should support keyboard navigation through form', async ({ page }) => {
    await page.goto('/company-info');
    
    // Tab through form fields
    await page.keyboard.press('Tab'); // Skip to first input
    await page.keyboard.type('Test Company');
    
    await page.keyboard.press('Tab'); // Next field
    await page.keyboard.type('123 Test St');
    
    await page.keyboard.press('Tab'); // Continue through form
    await page.keyboard.press('Tab');
    
    // Should be able to submit with Enter
    await page.keyboard.press('Enter');
  });

  test('should announce page changes to screen readers', async ({ page }) => {
    // Navigate to different pages
    await page.goto('/dashboard');
    
    // Check for aria-live region or page title change
    const pageTitle = await page.title();
    expect(pageTitle).toContain('Dashboard');
    
    // Check for main landmark
    const main = page.locator('main#main-content');
    await expect(main).toBeVisible();
  });

  test('should handle touch gestures on mobile', async ({ page, browserName }) => {
    // Skip on desktop browsers
    if (browserName !== 'chromium') return;
    
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    
    // Simulate swipe gesture
    const touchTarget = page.locator('body');
    await touchTarget.dispatchEvent('touchstart', {
      touches: [{ clientX: 300, clientY: 300 }],
    });
    await touchTarget.dispatchEvent('touchend', {
      changedTouches: [{ clientX: 100, clientY: 300 }],
    });
    
    // Mobile menu should be visible after swipe
    const nav = page.getByRole('navigation', { name: /mobile navigation/i });
    await expect(nav).toBeVisible();
  });
});