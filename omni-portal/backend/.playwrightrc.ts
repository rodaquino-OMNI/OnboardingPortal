import { defineConfig, devices } from '@playwright/test';

/**
 * Dedicated Playwright configuration for backend E2E testing
 * This file prevents conflicts with frontend Playwright setup
 */
export default defineConfig({
  // Test directory - strictly limited to backend E2E tests
  testDir: './tests/e2e',
  testMatch: ['**/*.spec.ts'],
  
  // Run tests in parallel
  fullyParallel: true,
  
  // Forbid test.only in CI
  forbidOnly: !!process.env.CI,
  
  // Retry configuration
  retries: process.env.CI ? 2 : 0,
  
  // Worker configuration
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  // Global test configuration
  use: {
    // Base URL for the frontend application
    baseURL: process.env.FRONTEND_URL || 'http://localhost:3000',
    
    // Tracing configuration
    trace: 'on-first-retry',
    
    // Screenshots on failure
    screenshot: 'only-on-failure',
    
    // Video recording on failure
    video: 'retain-on-failure',
    
    // Timeouts
    actionTimeout: 15000,
    navigationTimeout: 30000,
    
    // Context options
    ignoreHTTPSErrors: true,
    
    // API base URL for backend API calls
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  },

  // Test projects for different browsers
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
        }
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile devices
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // Tablet devices
    {
      name: 'iPad',
      use: { ...devices['iPad Pro'] },
    },
  ],

  // Test output directory
  outputDir: 'test-results/',
  
  // Test timeout
  timeout: 60000,
  
  // Expect timeout
  expect: {
    timeout: 10000,
  },
});