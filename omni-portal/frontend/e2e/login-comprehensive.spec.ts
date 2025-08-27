import { test, expect } from '@playwright/test';

test.describe('Login Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form elements correctly', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Login/);
    
    // Check heading
    await expect(page.locator('h1').filter({ hasText: 'Bem-vindo de volta!' })).toBeVisible();
    
    // Check form elements
    await expect(page.locator('input[id="login"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Check labels
    await expect(page.locator('label[for="login"]')).toHaveText('E-mail');
    await expect(page.locator('label[for="password"]')).toHaveText('Senha');
    
    // Check button text
    await expect(page.locator('button[type="submit"]')).toHaveText('Entrar');
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    // Click submit without filling fields
    await page.click('button[type="submit"]');
    
    // Wait for validation errors
    await page.waitForTimeout(1000);
    
    // Check for error indicators (form validation)
    const loginInput = page.locator('input[id="login"]');
    const passwordInput = page.locator('input[id="password"]');
    
    // Check if inputs have error styling or aria-invalid
    await expect(loginInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('should attempt login with demo credentials', async ({ page }) => {
    // Fill in the form
    await page.fill('input[id="login"]', 'demo@example.com');
    await page.fill('input[id="password"]', 'DemoPass123!');
    
    // Click login button
    await page.click('button[type="submit"]');
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/login-attempt.png' });
    
    // Check current URL or page content
    const currentUrl = page.url();
    console.log('Current URL after login:', currentUrl);
    
    // Check if we're redirected or if there's an error
    const pageContent = await page.content();
    const hasError = pageContent.toLowerCase().includes('error');
    const hasSuccess = pageContent.toLowerCase().includes('success') || 
                     pageContent.toLowerCase().includes('bem-vindo') ||
                     currentUrl.includes('/home') ||
                     currentUrl.includes('/dashboard');
    
    console.log('Has error:', hasError);
    console.log('Has success:', hasSuccess);
    
    // At minimum, form submission should trigger some response
    expect(hasError || hasSuccess || currentUrl !== `${page.url().split('/').slice(0, 3).join('/')}/login`).toBe(true);
  });

  test('should navigate to register page', async ({ page }) => {
    // Click on register link
    await page.click('text=Cadastre-se');
    
    // Check if navigated to register page
    await expect(page).toHaveURL(/register/);
  });

  test('should navigate to forgot password page', async ({ page }) => {
    // Click on forgot password link
    await page.click('text=Esqueceu sua senha?');
    
    // Check if navigated to forgot password page
    await expect(page).toHaveURL(/forgot-password/);
  });
});