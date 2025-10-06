import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests/accessibility',
  testMatch: '**/*.a11y.spec.ts',

  // Timeouts
  timeout: 30000,
  expect: {
    timeout: 5000,
  },

  // Fail fast
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporting
  reporter: [
    ['html', { outputFolder: 'test-results/a11y-report' }],
    ['json', { outputFile: 'test-results/a11y-results.json' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Web server for UI Sandbox
  webServer: {
    command: 'npm run sandbox:serve',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
