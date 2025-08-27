import { test, expect } from '@playwright/test';

test.describe('Navigation Flow', () => {
  test('should navigate between auth pages', async ({ page }) => {
    // Start at login
    await page.goto('/login');
    await expect(page.locator('h1').filter({ hasText: 'Bem-vindo de volta!' })).toBeVisible();
    
    // Go to register
    await page.click('text=Cadastre-se');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/register/);
    
    // Go back to login (if there's a link)
    try {
      await page.click('text=Entrar', { timeout: 3000 });
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/login/);
    } catch (error) {
      // If no direct link, navigate manually
      await page.goto('/login');
      await expect(page.locator('h1').filter({ hasText: 'Bem-vindo de volta!' })).toBeVisible();
    }
    
    // Go to forgot password
    await page.click('text=Esqueceu sua senha?');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/forgot-password/);
  });

  test('should handle direct URL access', async ({ page }) => {
    // Test direct access to different pages
    const pages = ['/login', '/register', '/forgot-password'];
    
    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      
      // Check that page loaded without error
      const hasError = await page.locator('text=Error').isVisible();
      expect(hasError).toBe(false);
      
      // Take screenshot for verification
      await page.screenshot({ path: `test-results/direct-access-${path.replace('/', '')}.png` });
    }
  });

  test('should have responsive design', async ({ page }) => {
    await page.goto('/login');
    
    // Test desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('h1').filter({ hasText: 'Bem-vindo de volta!' })).toBeVisible();
    await page.screenshot({ path: 'test-results/desktop-view.png' });
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('h1').filter({ hasText: 'Bem-vindo de volta!' })).toBeVisible();
    await page.screenshot({ path: 'test-results/tablet-view.png' });
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('h1').filter({ hasText: 'Bem-vindo de volta!' })).toBeVisible();
    await page.screenshot({ path: 'test-results/mobile-view.png' });
  });
});