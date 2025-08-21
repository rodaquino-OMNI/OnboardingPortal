import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for backend E2E testing
 * Tests the complete full-stack application flow
 */
export default defineConfig({
  // Test directory - only scan this specific directory
  testDir: './tests/e2e',
  
  // Explicitly include only our E2E tests and exclude frontend tests
  testMatch: ['./tests/e2e/**/*.spec.ts'],
  testIgnore: ['**/frontend/**', '**/node_modules/**'],
  
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
        // Additional Chrome-specific settings
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

    // API-only tests (headless)
    {
      name: 'api',
      use: {
        baseURL: process.env.BACKEND_URL || 'http://localhost:8000',
      },
    },
  ],

  // Web server configuration for development
  webServer: [
    {
      command: 'php artisan serve --host=0.0.0.0 --port=8000',
      port: 8000,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'cd ../frontend && npm run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],

  // Global setup/teardown - make them optional
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',

  // Test output directory
  outputDir: 'test-results/',
  
  // Test timeout
  timeout: 60000,
  
  // Expect timeout
  expect: {
    timeout: 10000,
  },
});