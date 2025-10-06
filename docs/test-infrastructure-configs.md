# Test Infrastructure Configuration Templates

This document contains ready-to-use configuration files for the UI package test infrastructure.

## 1. Vitest Configuration

### packages/ui/vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
      ],
      thresholds: {
        global: {
          statements: 85,
          branches: 85,
          functions: 85,
          lines: 85,
        },
        'src/ui/form-accessible.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
        'src/ui/SkipLinks.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
      },
    },

    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'tests/accessibility/**'],

    testTimeout: 10000,
    hookTimeout: 10000,

    reporters: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results/unit-results.json',
      html: './test-results/index.html',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/ui': path.resolve(__dirname, './src/ui'),
      '@/utils': path.resolve(__dirname, './src/utils'),
    },
  },
});
```

## 2. Playwright Configuration

### packages/ui/playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/accessibility',
  testMatch: '**/*.a11y.spec.ts',

  timeout: 30000,
  expect: {
    timeout: 5000,
  },

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

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

  webServer: {
    command: 'npm run sandbox:serve',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

## 3. Package.json Scripts

### packages/ui/package.json (scripts section)

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "lint": "eslint src --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "test": "npm run test:unit && npm run test:a11y",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest watch",
    "test:unit:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:a11y": "playwright test",
    "test:a11y:ui": "playwright test --ui",
    "test:a11y:debug": "playwright test --debug",
    "sandbox:dev": "vite serve tests/sandbox",
    "sandbox:build": "vite build tests/sandbox",
    "sandbox:serve": "vite preview --port 5173 tests/sandbox"
  },
  "devDependencies": {
    "@axe-core/playwright": "^4.8.1",
    "@playwright/test": "^1.40.0",
    "@testing-library/jest-dom": "^6.1.5",
    "@testing-library/react": "^14.1.2",
    "@testing-library/user-event": "^14.5.1",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.1",
    "@vitest/ui": "^1.0.4",
    "eslint": "^8.56.0",
    "jsdom": "^23.0.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.8",
    "vitest": "^1.0.4"
  }
}
```

## 4. GitHub Actions Workflow

### .github/workflows/ui-tests.yml

```yaml
name: UI Package Tests

on:
  push:
    branches: [main, develop, 'feature/**']
    paths:
      - 'packages/ui/**'
      - '.github/workflows/ui-tests.yml'
  pull_request:
    branches: [main, develop]
    paths:
      - 'packages/ui/**'

env:
  NODE_VERSION: '20'

jobs:
  unit-tests:
    name: Unit & Component Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci

      - name: Run unit tests
        working-directory: packages/ui
        run: npm run test:unit -- --coverage --reporter=verbose --reporter=json

      - name: Check coverage
        working-directory: packages/ui
        run: |
          COVERAGE=$(jq '.total.lines.pct' coverage/coverage-summary.json)
          echo "Coverage: ${COVERAGE}%"
          if (( $(echo "$COVERAGE < 85" | bc -l) )); then
            echo "Coverage below 85%"
            exit 1
          fi

      - uses: codecov/codecov-action@v4
        with:
          files: ./packages/ui/coverage/lcov.info
          flags: ui-unit

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: unit-test-results
          path: packages/ui/test-results/

  a11y-tests:
    name: Accessibility Tests
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci

      - name: Install Playwright
        working-directory: packages/ui
        run: npx playwright install --with-deps

      - name: Build sandbox
        working-directory: packages/ui
        run: npm run sandbox:build

      - name: Run a11y tests
        working-directory: packages/ui
        run: npm run test:a11y

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: a11y-test-results
          path: packages/ui/test-results/a11y-*

  typecheck:
    name: TypeScript Type Check
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - working-directory: packages/ui
        run: npm run typecheck

  lint:
    name: ESLint
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - working-directory: packages/ui
        run: npm run lint
```

## 5. Vite Configuration for Sandbox

### packages/ui/tests/sandbox/vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '@/ui': path.resolve(__dirname, '../../src/ui'),
    },
  },
});
```

## 6. TypeScript Configuration for Tests

### packages/ui/tsconfig.test.json

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["tests/**/*", "src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 7. ESLint Configuration

### packages/ui/.eslintrc.test.json

```json
{
  "extends": ["./.eslintrc.json"],
  "env": {
    "jest": true
  },
  "rules": {
    "@typescript-eslint/no-explicit-any": "off",
    "testing-library/prefer-screen-queries": "error",
    "testing-library/no-wait-for-multiple-assertions": "error"
  },
  "overrides": [
    {
      "files": ["**/*.test.ts", "**/*.test.tsx"],
      "extends": ["plugin:testing-library/react"]
    }
  ]
}
```

## 8. Installation Commands

```bash
# Navigate to UI package
cd packages/ui

# Install testing dependencies
npm install -D \
  vitest@^1.0.4 \
  @vitest/ui@^1.0.4 \
  @testing-library/react@^14.1.2 \
  @testing-library/jest-dom@^6.1.5 \
  @testing-library/user-event@^14.5.1 \
  jsdom@^23.0.1 \
  @playwright/test@^1.40.0 \
  @axe-core/playwright@^4.8.1 \
  vite@^5.0.8 \
  @vitejs/plugin-react@^4.2.1

# Install Playwright browsers
npx playwright install
```

## 9. Quick Start

```bash
# Run unit tests
npm run test:unit

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:unit:watch

# Open Vitest UI
npm run test:unit:ui

# Run a11y tests
npm run test:a11y

# Open Playwright UI
npm run test:a11y:ui

# Run all tests
npm test
```

## 10. Directory Creation Script

```bash
# Create test directory structure
mkdir -p packages/ui/tests/{unit/components,unit/utils,accessibility/smoke,accessibility/fixtures,helpers,sandbox}

# Create placeholder files
touch packages/ui/tests/setup.ts
touch packages/ui/tests/helpers/{render.tsx,a11y.ts,mocks.ts,matchers.ts}
touch packages/ui/tests/sandbox/{index.html,components.tsx}
```
