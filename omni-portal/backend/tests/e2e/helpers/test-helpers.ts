import { Page, expect } from '@playwright/test';

/**
 * Common test helpers for E2E tests
 */

export interface TestUser {
  email: string;
  password: string;
  name?: string;
  cpf?: string;
}

export const TEST_USERS = {
  admin: {
    email: 'admin@example.com',
    password: 'password123',
    name: 'Admin User'
  },
  demo: {
    email: 'demo@example.com', 
    password: 'demo123',
    name: 'Demo User',
    cpf: '12345678901'
  },
  testUser: {
    email: 'test@example.com',
    password: 'test123',
    name: 'Test User',
    cpf: '98765432100'
  }
} as const;

export const API_ENDPOINTS = {
  login: '/api/login',
  register: '/api/register',
  profile: '/api/profile',
  healthQuestionnaire: '/api/health-questionnaire',
  documents: '/api/documents',
  interviews: '/api/interviews',
  gamification: '/api/gamification'
} as const;

/**
 * Login helper function
 */
export async function loginUser(page: Page, user: TestUser) {
  await page.goto('/login');
  
  // Wait for login form to be visible
  await page.waitForSelector('form[data-testid="login-form"]', { timeout: 10000 });
  
  // Fill login form
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for successful login (redirect to dashboard)
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  
  // Verify we're logged in
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
}

/**
 * Logout helper function
 */
export async function logoutUser(page: Page) {
  // Click user menu
  await page.click('[data-testid="user-menu"]');
  
  // Click logout button
  await page.click('[data-testid="logout-button"]');
  
  // Wait for redirect to login page
  await page.waitForURL('**/login', { timeout: 10000 });
}

/**
 * Register new user helper
 */
export async function registerUser(page: Page, userData: {
  name: string;
  email: string;
  password: string;
  cpf: string;
  company?: string;
}) {
  await page.goto('/register');
  
  // Step 1: Basic Information
  await page.waitForSelector('[data-testid="register-step-1"]');
  await page.fill('input[name="name"]', userData.name);
  await page.fill('input[name="email"]', userData.email);
  await page.fill('input[name="cpf"]', userData.cpf);
  await page.click('button[data-testid="next-step"]');
  
  // Step 2: Password
  await page.waitForSelector('[data-testid="register-step-2"]');
  await page.fill('input[name="password"]', userData.password);
  await page.fill('input[name="password_confirmation"]', userData.password);
  await page.click('button[data-testid="next-step"]');
  
  // Step 3: Company (if provided)
  if (userData.company) {
    await page.waitForSelector('[data-testid="register-step-3"]');
    await page.fill('input[name="company"]', userData.company);
  }
  
  // Complete registration
  await page.click('button[data-testid="complete-registration"]');
  
  // Wait for successful registration
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

/**
 * Fill health questionnaire helper
 */
export async function fillHealthQuestionnaire(page: Page, responses: Record<string, any>) {
  await page.goto('/health-questionnaire');
  
  // Wait for questionnaire to load
  await page.waitForSelector('[data-testid="health-questionnaire"]');
  
  // Fill out questionnaire responses
  for (const [questionId, response] of Object.entries(responses)) {
    const questionElement = page.locator(`[data-question-id="${questionId}"]`);
    await questionElement.waitFor();
    
    if (typeof response === 'boolean') {
      // Radio button or checkbox
      await questionElement.locator(`input[value="${response}"]`).click();
    } else if (typeof response === 'string') {
      // Text input or textarea
      await questionElement.locator('input, textarea').fill(response);
    } else if (typeof response === 'number') {
      // Range slider or number input
      await questionElement.locator('input[type="range"], input[type="number"]').fill(response.toString());
    }
  }
  
  // Submit questionnaire
  await page.click('button[data-testid="submit-questionnaire"]');
  
  // Wait for success confirmation
  await page.waitForSelector('[data-testid="questionnaire-success"]');
}

/**
 * Upload document helper
 */
export async function uploadDocument(page: Page, documentPath: string, documentType: string = 'ID') {
  await page.goto('/documents');
  
  // Wait for upload area
  await page.waitForSelector('[data-testid="document-upload"]');
  
  // Select document type
  await page.selectOption('select[name="document_type"]', documentType);
  
  // Upload file
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(documentPath);
  
  // Wait for upload to complete
  await page.waitForSelector('[data-testid="upload-success"]', { timeout: 30000 });
}

/**
 * Schedule interview helper
 */
export async function scheduleInterview(page: Page, slot: { date: string; time: string }) {
  await page.goto('/interviews');
  
  // Wait for calendar to load
  await page.waitForSelector('[data-testid="interview-calendar"]');
  
  // Select date
  await page.click(`[data-date="${slot.date}"]`);
  
  // Select time slot
  await page.click(`[data-time="${slot.time}"]`);
  
  // Confirm booking
  await page.click('button[data-testid="confirm-booking"]');
  
  // Wait for confirmation
  await page.waitForSelector('[data-testid="booking-success"]');
}

/**
 * Check gamification progress helper
 */
export async function checkGamificationProgress(page: Page) {
  await page.goto('/dashboard');
  
  // Wait for gamification card to load
  await page.waitForSelector('[data-testid="gamification-progress"]');
  
  // Get current progress
  const progressCard = page.locator('[data-testid="gamification-progress"]');
  const level = await progressCard.locator('[data-testid="current-level"]').textContent();
  const points = await progressCard.locator('[data-testid="current-points"]').textContent();
  const badges = await progressCard.locator('[data-testid="badge-count"]').textContent();
  
  return {
    level: parseInt(level || '0'),
    points: parseInt(points || '0'),
    badges: parseInt(badges || '0')
  };
}

/**
 * Wait for API response helper
 */
export async function waitForApiResponse(page: Page, endpoint: string) {
  return page.waitForResponse(response => 
    response.url().includes(endpoint) && response.status() === 200
  );
}

/**
 * Mock API response helper
 */
export async function mockApiResponse(page: Page, endpoint: string, response: any) {
  await page.route(`**${endpoint}`, route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response)
    });
  });
}

/**
 * Check for console errors
 */
export async function checkConsoleErrors(page: Page) {
  const errors: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  return errors;
}

/**
 * Take screenshot with timestamp
 */
export async function takeTimestampedScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ 
    path: `test-results/screenshots/${name}-${timestamp}.png`,
    fullPage: true 
  });
}