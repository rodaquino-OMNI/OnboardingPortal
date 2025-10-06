# UI Package Test Infrastructure Design

## Executive Summary

This document outlines a comprehensive test infrastructure for `packages/ui` with:
- **Unit/Component Testing**: Vitest + React Testing Library
- **Accessibility Testing**: Playwright + axe-core
- **CI Integration**: GitHub Actions with separate a11y smoke tests
- **Coverage Requirements**: ≥85% overall, ≥90% critical paths

## 1. Test Infrastructure Architecture

### 1.1 Testing Pyramid

```
           /\
          /E2E\           <- UI Sandbox A11y Tests (Playwright + axe-core)
         /------\
        /Integr.\         <- Component Integration Tests
       /----------\
      /   Unit     \      <- Component Unit Tests (Vitest + RTL)
     /--------------\
```

### 1.2 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Unit/Component | Vitest | Fast test runner with native ESM support |
| Component Testing | React Testing Library | User-centric component testing |
| Accessibility | Playwright + axe-core | Automated a11y validation |
| Coverage | c8 (v8 coverage) | Built-in Vitest coverage |
| Mocking | vi (Vitest) | Test doubles and mocks |

### 1.3 Directory Structure

```
packages/ui/
├── src/
│   ├── ui/                     # Components
│   └── utils/                  # Utilities
├── tests/
│   ├── unit/                   # Unit tests
│   │   ├── components/         # Component tests
│   │   │   ├── Button.test.tsx
│   │   │   ├── Card.test.tsx
│   │   │   └── form-accessible.test.tsx
│   │   └── utils/              # Utility tests
│   ├── accessibility/          # A11y tests
│   │   ├── smoke/              # Smoke tests
│   │   │   ├── components.a11y.spec.ts
│   │   │   └── forms.a11y.spec.ts
│   │   └── fixtures/           # Test fixtures
│   ├── helpers/                # Test utilities
│   │   ├── render.tsx          # Custom render
│   │   ├── a11y.ts             # A11y helpers
│   │   ├── mocks.ts            # Mock factories
│   │   └── matchers.ts         # Custom matchers
│   └── sandbox/                # UI Sandbox page
│       ├── index.html
│       └── components.tsx
├── vitest.config.ts            # Vitest configuration
├── playwright.config.ts        # Playwright configuration
└── package.json
```

## 2. Unit/Component Testing Design

### 2.1 Vitest Configuration

**File**: `packages/ui/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Environment
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],

    // Coverage
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
        // Overall thresholds
        global: {
          statements: 85,
          branches: 85,
          functions: 85,
          lines: 85,
        },
        // Critical components (higher threshold)
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

    // Test matching
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'tests/accessibility/**'],

    // Performance
    testTimeout: 10000,
    hookTimeout: 10000,

    // Reporting
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

### 2.2 Test Setup File

**File**: `packages/ui/tests/setup.ts`

```typescript
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import * as matchers from './helpers/matchers';

// Extend Vitest matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;
```

### 2.3 Mock Strategies

**File**: `packages/ui/tests/helpers/mocks.ts`

```typescript
import { vi } from 'vitest';

/**
 * Mock data factories for consistent test data
 */

// Form field mock
export const createMockFormField = (overrides = {}) => ({
  id: 'test-field',
  name: 'testField',
  value: '',
  onChange: vi.fn(),
  onBlur: vi.fn(),
  error: undefined,
  touched: false,
  ...overrides,
});

// Accessibility props mock
export const createMockA11yProps = (overrides = {}) => ({
  'aria-label': 'Test component',
  'aria-describedby': undefined,
  'aria-invalid': false,
  role: undefined,
  ...overrides,
});

// Toast notification mock
export const createMockToast = () => ({
  toast: vi.fn(),
  dismiss: vi.fn(),
  toasts: [],
});

// Router mock (for components using routing)
export const createMockRouter = (overrides = {}) => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  pathname: '/',
  query: {},
  asPath: '/',
  ...overrides,
});
```

### 2.4 Custom Render Helper

**File**: `packages/ui/tests/helpers/render.tsx`

```typescript
import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { TooltipProvider } from '@/ui/tooltip';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  withTooltip?: boolean;
}

/**
 * Custom render that wraps components with common providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { withTooltip = true, ...renderOptions } = options;

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    if (withTooltip) {
      return <TooltipProvider>{children}</TooltipProvider>;
    }
    return <>{children}</>;
  };

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Re-export everything from RTL
export * from '@testing-library/react';
export { renderWithProviders as render };
```

## 3. Accessibility Testing Design

### 3.1 Playwright Configuration

**File**: `packages/ui/playwright.config.ts`

```typescript
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
```

### 3.2 UI Sandbox Design

The UI Sandbox is a dev-only page that renders all components for accessibility testing.

**File**: `packages/ui/tests/sandbox/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UI Component Sandbox - A11y Testing</title>
  <script type="module" src="./components.tsx"></script>
</head>
<body>
  <div id="root"></div>
</body>
</html>
```

**File**: `packages/ui/tests/sandbox/components.tsx`

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Button } from '@/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/ui/card';
import { FormAccessible } from '@/ui/form-accessible';
import { SkipLinks } from '@/ui/SkipLinks';
import { TouchFriendlySlider } from '@/ui/TouchFriendlySlider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui/tabs';

/**
 * UI Sandbox - All components for accessibility testing
 *
 * This page is served during Playwright tests to validate
 * accessibility across all components.
 */
function UISandbox() {
  return (
    <div className="sandbox-container" style={{ padding: '2rem' }}>
      {/* Skip Links */}
      <SkipLinks
        links={[
          { href: '#main', label: 'Skip to main content' },
          { href: '#nav', label: 'Skip to navigation' },
        ]}
      />

      <h1 id="main">UI Component Sandbox</h1>

      {/* Button variants */}
      <section aria-labelledby="buttons-heading" className="sandbox-section">
        <h2 id="buttons-heading">Buttons</h2>
        <div className="component-grid">
          <Button variant="default">Default Button</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      {/* Cards */}
      <section aria-labelledby="cards-heading" className="sandbox-section">
        <h2 id="cards-heading">Cards</h2>
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Card content goes here.</p>
          </CardContent>
        </Card>
      </section>

      {/* Forms */}
      <section aria-labelledby="forms-heading" className="sandbox-section">
        <h2 id="forms-heading">Accessible Forms</h2>
        <FormAccessible
          fields={[
            {
              id: 'name',
              type: 'text',
              label: 'Full Name',
              required: true,
              description: 'Enter your legal name',
            },
            {
              id: 'email',
              type: 'email',
              label: 'Email Address',
              required: true,
              validation: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
            },
          ]}
          onSubmit={(data) => console.log(data)}
        />
      </section>

      {/* Sliders */}
      <section aria-labelledby="sliders-heading" className="sandbox-section">
        <h2 id="sliders-heading">Touch-Friendly Slider</h2>
        <TouchFriendlySlider
          label="Volume"
          min={0}
          max={100}
          defaultValue={50}
          step={1}
        />
      </section>

      {/* Tabs */}
      <section aria-labelledby="tabs-heading" className="sandbox-section">
        <h2 id="tabs-heading">Tabs</h2>
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content for Tab 1</TabsContent>
          <TabsContent value="tab2">Content for Tab 2</TabsContent>
          <TabsContent value="tab3">Content for Tab 3</TabsContent>
        </Tabs>
      </section>
    </div>
  );
}

// Mount the sandbox
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UISandbox />
  </React.StrictMode>
);
```

### 3.3 Accessibility Test Utilities

**File**: `packages/ui/tests/helpers/a11y.ts`

```typescript
import { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility testing utilities
 */

export interface A11yTestOptions {
  /**
   * Include only specific WCAG tags
   * @example ['wcag2a', 'wcag2aa', 'wcag21aa']
   */
  tags?: string[];

  /**
   * Exclude specific rules
   * @example ['color-contrast'] // Skip color contrast checks
   */
  disabledRules?: string[];

  /**
   * Run only specific rules
   */
  rules?: string[];
}

/**
 * Run axe-core accessibility tests on a page
 */
export async function checkA11y(
  page: Page,
  options: A11yTestOptions = {}
) {
  const {
    tags = ['wcag2a', 'wcag2aa', 'wcag21aa'],
    disabledRules = [],
    rules,
  } = options;

  const builder = new AxeBuilder({ page })
    .withTags(tags)
    .disableRules(disabledRules);

  if (rules) {
    builder.withRules(rules);
  }

  const results = await builder.analyze();

  return {
    violations: results.violations,
    passes: results.passes,
    incomplete: results.incomplete,
    inapplicable: results.inapplicable,
  };
}

/**
 * Check specific element for accessibility violations
 */
export async function checkElementA11y(
  page: Page,
  selector: string,
  options: A11yTestOptions = {}
) {
  const { tags = ['wcag2a', 'wcag2aa'], disabledRules = [] } = options;

  const results = await new AxeBuilder({ page })
    .include(selector)
    .withTags(tags)
    .disableRules(disabledRules)
    .analyze();

  return results.violations;
}

/**
 * Format axe violations for readable error messages
 */
export function formatViolations(violations: any[]) {
  return violations.map((violation) => {
    const nodes = violation.nodes.map((node: any) => ({
      html: node.html,
      target: node.target,
      failureSummary: node.failureSummary,
    }));

    return {
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      help: violation.help,
      helpUrl: violation.helpUrl,
      nodes,
    };
  });
}

/**
 * Assert no accessibility violations
 */
export function assertNoA11yViolations(violations: any[]) {
  if (violations.length > 0) {
    const formatted = formatViolations(violations);
    const message = `
      Found ${violations.length} accessibility violations:
      ${JSON.stringify(formatted, null, 2)}
    `;
    throw new Error(message);
  }
}

/**
 * Common accessibility test patterns
 */
export const a11yTestPatterns = {
  /**
   * Check keyboard navigation
   */
  async testKeyboardNavigation(page: Page, selector: string) {
    await page.focus(selector);
    const focused = await page.evaluate(
      (sel) => document.activeElement?.matches(sel),
      selector
    );
    return focused;
  },

  /**
   * Check ARIA attributes
   */
  async testAriaAttributes(page: Page, selector: string) {
    const element = await page.locator(selector);
    const role = await element.getAttribute('role');
    const ariaLabel = await element.getAttribute('aria-label');
    const ariaDescribedBy = await element.getAttribute('aria-describedby');

    return { role, ariaLabel, ariaDescribedBy };
  },

  /**
   * Check color contrast (using axe)
   */
  async testColorContrast(page: Page, selector: string) {
    const violations = await checkElementA11y(page, selector, {
      rules: ['color-contrast'],
    });
    return violations;
  },

  /**
   * Check focus indicators
   */
  async testFocusIndicators(page: Page, selector: string) {
    await page.focus(selector);
    const outline = await page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (!element) return null;
      const styles = window.getComputedStyle(element);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        outlineColor: styles.outlineColor,
      };
    }, selector);
    return outline;
  },
};
```

## 4. Sample Test Files

### 4.1 Component Unit Test

**File**: `packages/ui/tests/unit/components/form-accessible.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@/tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { FormAccessible } from '@/ui/form-accessible';

describe('FormAccessible', () => {
  const mockOnSubmit = vi.fn();

  const defaultFields = [
    {
      id: 'name',
      type: 'text' as const,
      label: 'Full Name',
      required: true,
      description: 'Enter your legal name',
    },
    {
      id: 'email',
      type: 'email' as const,
      label: 'Email Address',
      required: true,
    },
  ];

  afterEach(() => {
    mockOnSubmit.mockClear();
  });

  describe('Rendering', () => {
    it('should render all form fields', () => {
      render(<FormAccessible fields={defaultFields} onSubmit={mockOnSubmit} />);

      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    it('should display field descriptions', () => {
      render(<FormAccessible fields={defaultFields} onSubmit={mockOnSubmit} />);

      expect(screen.getByText('Enter your legal name')).toBeInTheDocument();
    });

    it('should mark required fields with asterisk', () => {
      render(<FormAccessible fields={defaultFields} onSubmit={mockOnSubmit} />);

      const nameLabel = screen.getByText(/full name/i).closest('label');
      expect(nameLabel).toHaveTextContent('*');
    });
  });

  describe('Accessibility', () => {
    it('should associate labels with inputs', () => {
      render(<FormAccessible fields={defaultFields} onSubmit={mockOnSubmit} />);

      const nameInput = screen.getByLabelText(/full name/i);
      expect(nameInput).toHaveAttribute('id', 'name');
    });

    it('should use aria-describedby for field descriptions', () => {
      render(<FormAccessible fields={defaultFields} onSubmit={mockOnSubmit} />);

      const nameInput = screen.getByLabelText(/full name/i);
      const descriptionId = nameInput.getAttribute('aria-describedby');

      expect(descriptionId).toBeTruthy();
      expect(screen.getByText('Enter your legal name')).toHaveAttribute('id', descriptionId);
    });

    it('should set aria-invalid on validation errors', async () => {
      const user = userEvent.setup();
      render(<FormAccessible fields={defaultFields} onSubmit={mockOnSubmit} />);

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        const emailInput = screen.getByLabelText(/email address/i);
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('should announce errors to screen readers', async () => {
      const user = userEvent.setup();
      render(<FormAccessible fields={defaultFields} onSubmit={mockOnSubmit} />);

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toBeInTheDocument();
      });
    });
  });

  describe('Validation', () => {
    it('should validate required fields', async () => {
      const user = userEvent.setup();
      render(<FormAccessible fields={defaultFields} onSubmit={mockOnSubmit} />);

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });

    it('should validate email format', async () => {
      const user = userEvent.setup();
      render(<FormAccessible fields={defaultFields} onSubmit={mockOnSubmit} />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'invalid-email');

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should submit valid form data', async () => {
      const user = userEvent.setup();
      render(<FormAccessible fields={defaultFields} onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(screen.getByLabelText(/email address/i), 'john@example.com');

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'John Doe',
          email: 'john@example.com',
        });
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support tab navigation between fields', async () => {
      const user = userEvent.setup();
      render(<FormAccessible fields={defaultFields} onSubmit={mockOnSubmit} />);

      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email address/i);

      nameInput.focus();
      expect(nameInput).toHaveFocus();

      await user.tab();
      expect(emailInput).toHaveFocus();
    });

    it('should submit on Enter key', async () => {
      const user = userEvent.setup();
      render(<FormAccessible fields={defaultFields} onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(screen.getByLabelText(/email address/i), 'john@example.com{Enter}');

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should focus first error field on validation failure', async () => {
      const user = userEvent.setup();
      render(<FormAccessible fields={defaultFields} onSubmit={mockOnSubmit} />);

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/full name/i);
        expect(nameInput).toHaveFocus();
      });
    });

    it('should clear errors on field change', async () => {
      const user = userEvent.setup();
      render(<FormAccessible fields={defaultFields} onSubmit={mockOnSubmit} />);

      // Trigger validation error
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/required/i)).toBeInTheDocument();
      });

      // Type in field
      const nameInput = screen.getByLabelText(/full name/i);
      await user.type(nameInput, 'John');

      // Error should clear
      await waitFor(() => {
        expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
      });
    });
  });
});
```

### 4.2 Accessibility Smoke Test

**File**: `packages/ui/tests/accessibility/smoke/components.a11y.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { checkA11y, assertNoA11yViolations, a11yTestPatterns } from '@/tests/helpers/a11y';

test.describe('Component Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should have no accessibility violations on page load', async ({ page }) => {
    const results = await checkA11y(page);
    assertNoA11yViolations(results.violations);
  });

  test.describe('Buttons', () => {
    test('should have accessible names', async ({ page }) => {
      const buttons = await page.locator('button').all();

      for (const button of buttons) {
        const accessibleName = await button.getAttribute('aria-label') ||
                              await button.textContent();
        expect(accessibleName).toBeTruthy();
      }
    });

    test('should have visible focus indicators', async ({ page }) => {
      const button = page.getByRole('button', { name: /default button/i });
      const focusIndicator = await a11yTestPatterns.testFocusIndicators(
        page,
        'button:has-text("Default Button")'
      );

      expect(focusIndicator?.outlineWidth).not.toBe('0px');
    });

    test('should be keyboard accessible', async ({ page }) => {
      const button = page.getByRole('button', { name: /default button/i });

      await page.keyboard.press('Tab');
      const isFocused = await a11yTestPatterns.testKeyboardNavigation(
        page,
        'button:has-text("Default Button")'
      );

      expect(isFocused).toBeTruthy();
    });
  });

  test.describe('Forms', () => {
    test('should have properly labeled inputs', async ({ page }) => {
      const results = await checkA11y(page, {
        rules: ['label', 'label-title-only'],
      });

      assertNoA11yViolations(results.violations);
    });

    test('should associate errors with fields', async ({ page }) => {
      const nameInput = page.getByLabel(/full name/i);
      const describedBy = await nameInput.getAttribute('aria-describedby');

      expect(describedBy).toBeTruthy();
    });

    test('should announce validation errors', async ({ page }) => {
      const submitButton = page.getByRole('button', { name: /submit/i });
      await submitButton.click();

      const alert = page.getByRole('alert');
      await expect(alert).toBeVisible();
    });
  });

  test.describe('Skip Links', () => {
    test('should be focusable with keyboard', async ({ page }) => {
      await page.keyboard.press('Tab');

      const skipLink = page.getByText(/skip to main content/i);
      await expect(skipLink).toBeFocused();
    });

    test('should navigate to target on activation', async ({ page }) => {
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');

      const mainContent = page.locator('#main');
      await expect(mainContent).toBeFocused();
    });
  });

  test.describe('Sliders', () => {
    test('should have accessible labels', async ({ page }) => {
      const slider = page.getByRole('slider', { name: /volume/i });
      await expect(slider).toBeVisible();
    });

    test('should support keyboard controls', async ({ page }) => {
      const slider = page.getByRole('slider', { name: /volume/i });

      await slider.focus();
      await page.keyboard.press('ArrowRight');

      const value = await slider.getAttribute('aria-valuenow');
      expect(parseInt(value || '0')).toBeGreaterThan(50);
    });

    test('should have touch-friendly targets (≥44x44px)', async ({ page }) => {
      const sliderHandle = page.locator('[role="slider"]');
      const box = await sliderHandle.boundingBox();

      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe('Tabs', () => {
    test('should have proper ARIA roles', async ({ page }) => {
      const tablist = page.getByRole('tablist');
      const tabs = page.getByRole('tab');
      const tabpanels = page.getByRole('tabpanel');

      await expect(tablist).toBeVisible();
      await expect(tabs.first()).toBeVisible();
      await expect(tabpanels.first()).toBeVisible();
    });

    test('should support arrow key navigation', async ({ page }) => {
      const firstTab = page.getByRole('tab', { name: /tab 1/i });
      const secondTab = page.getByRole('tab', { name: /tab 2/i });

      await firstTab.focus();
      await page.keyboard.press('ArrowRight');

      await expect(secondTab).toBeFocused();
    });

    test('should associate tabs with panels', async ({ page }) => {
      const tab = page.getByRole('tab', { name: /tab 1/i });
      const controls = await tab.getAttribute('aria-controls');
      const panel = page.locator(`#${controls}`);

      await expect(panel).toBeVisible();
    });
  });

  test.describe('Color Contrast', () => {
    test('should meet WCAG AA contrast ratios', async ({ page }) => {
      const results = await checkA11y(page, {
        rules: ['color-contrast'],
      });

      assertNoA11yViolations(results.violations);
    });
  });

  test.describe('Landmarks', () => {
    test('should have proper landmark structure', async ({ page }) => {
      const results = await checkA11y(page, {
        rules: ['region', 'landmark-one-main', 'landmark-unique'],
      });

      assertNoA11yViolations(results.violations);
    });
  });
});
```

## 5. Custom Test Matchers

**File**: `packages/ui/tests/helpers/matchers.ts`

```typescript
import { expect } from 'vitest';

/**
 * Custom Vitest matchers for UI testing
 */

export function toBeAccessible(element: HTMLElement) {
  const hasAriaLabel = element.hasAttribute('aria-label');
  const hasAriaLabelledBy = element.hasAttribute('aria-labelledby');
  const hasTextContent = element.textContent && element.textContent.trim().length > 0;

  const isAccessible = hasAriaLabel || hasAriaLabelledBy || hasTextContent;

  return {
    pass: isAccessible,
    message: () =>
      isAccessible
        ? `Expected element not to be accessible`
        : `Expected element to have aria-label, aria-labelledby, or text content`,
    actual: {
      'aria-label': element.getAttribute('aria-label'),
      'aria-labelledby': element.getAttribute('aria-labelledby'),
      textContent: element.textContent,
    },
  };
}

export function toHaveNoA11yViolations(violations: any[]) {
  const hasViolations = violations.length > 0;

  return {
    pass: !hasViolations,
    message: () =>
      hasViolations
        ? `Expected no accessibility violations but found ${violations.length}:\n${JSON.stringify(violations, null, 2)}`
        : `Expected accessibility violations but found none`,
    actual: violations,
  };
}

export function toHaveFocusVisible(element: HTMLElement) {
  const styles = window.getComputedStyle(element);
  const hasOutline = styles.outline !== 'none' && styles.outlineWidth !== '0px';
  const hasBoxShadow = styles.boxShadow !== 'none';

  const hasFocusIndicator = hasOutline || hasBoxShadow;

  return {
    pass: hasFocusIndicator,
    message: () =>
      hasFocusIndicator
        ? `Expected element not to have visible focus indicator`
        : `Expected element to have visible focus indicator (outline or box-shadow)`,
    actual: {
      outline: styles.outline,
      outlineWidth: styles.outlineWidth,
      boxShadow: styles.boxShadow,
    },
  };
}

// Extend Vitest expect
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeAccessible(): T;
    toHaveNoA11yViolations(): T;
    toHaveFocusVisible(): T;
  }
}
```

## 6. CI Integration

### 6.1 GitHub Actions Workflow

**File**: `.github/workflows/ui-tests.yml`

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
  CACHE_VERSION: v1

jobs:
  # ==================
  # Unit Tests
  # ==================
  unit-tests:
    name: Unit & Component Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        working-directory: packages/ui
        run: npm run test:unit -- --coverage --reporter=verbose --reporter=json

      - name: Check coverage thresholds
        working-directory: packages/ui
        run: |
          if [ ! -f coverage/coverage-summary.json ]; then
            echo "❌ Coverage report not found"
            exit 1
          fi

          COVERAGE=$(jq '.total.lines.pct' coverage/coverage-summary.json)
          echo "📊 Coverage: ${COVERAGE}%"

          if (( $(echo "$COVERAGE < 85" | bc -l) )); then
            echo "❌ Coverage below threshold (85%)"
            exit 1
          fi

      - name: Upload coverage reports
        uses: codecov/codecov-action@v4
        with:
          files: ./packages/ui/coverage/lcov.info
          flags: ui-unit
          name: ui-unit-coverage

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: unit-test-results
          path: |
            packages/ui/test-results/
            packages/ui/coverage/
          retention-days: 30

  # ==================
  # Accessibility Tests
  # ==================
  a11y-tests:
    name: Accessibility Tests
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        working-directory: packages/ui
        run: npx playwright install --with-deps chromium firefox webkit

      - name: Build UI Sandbox
        working-directory: packages/ui
        run: npm run sandbox:build

      - name: Run accessibility tests
        working-directory: packages/ui
        run: npm run test:a11y

      - name: Upload a11y test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: a11y-test-results
          path: packages/ui/test-results/a11y-*
          retention-days: 30

      - name: Comment a11y results on PR
        if: github.event_name == 'pull_request' && always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const resultsPath = 'packages/ui/test-results/a11y-results.json';

            if (!fs.existsSync(resultsPath)) {
              console.log('No a11y results found');
              return;
            }

            const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
            const passed = results.stats.expected;
            const failed = results.stats.unexpected;
            const total = passed + failed;

            const body = `
            ## 🔍 Accessibility Test Results

            | Metric | Value |
            |--------|-------|
            | ✅ Passed | ${passed}/${total} |
            | ❌ Failed | ${failed}/${total} |
            | 📊 Success Rate | ${((passed/total) * 100).toFixed(1)}% |

            ${failed > 0 ? '⚠️ **Accessibility violations detected. Please review.**' : '✅ **All accessibility checks passed!**'}

            [View detailed report](${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }})
            `;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });

  # ==================
  # Type Checking
  # ==================
  typecheck:
    name: TypeScript Type Check
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run type check
        working-directory: packages/ui
        run: npm run typecheck

  # ==================
  # Lint
  # ==================
  lint:
    name: ESLint
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        working-directory: packages/ui
        run: npm run lint

  # ==================
  # Summary Report
  # ==================
  test-summary:
    name: Test Summary
    runs-on: ubuntu-latest
    needs: [unit-tests, a11y-tests, typecheck, lint]
    if: always()

    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v4

      - name: Generate summary
        run: |
          cat >> $GITHUB_STEP_SUMMARY <<EOF
          # UI Package Test Summary

          ## Test Results

          | Job | Status |
          |-----|--------|
          | Unit Tests | ${{ needs.unit-tests.result == 'success' && '✅ PASS' || '❌ FAIL' }} |
          | Accessibility Tests | ${{ needs.a11y-tests.result == 'success' && '✅ PASS' || '❌ FAIL' }} |
          | Type Check | ${{ needs.typecheck.result == 'success' && '✅ PASS' || '❌ FAIL' }} |
          | Lint | ${{ needs.lint.result == 'success' && '✅ PASS' || '❌ FAIL' }} |

          ## Coverage & Metrics

          - View [Unit Test Results](unit-test-results/)
          - View [A11y Test Results](a11y-test-results/)

          ---
          *Build: ${{ github.run_number }} | Commit: ${{ github.sha }}*
          EOF
```

### 6.2 Package.json Scripts

**File**: `packages/ui/package.json` (additional scripts)

```json
{
  "scripts": {
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
  }
}
```

## 7. Implementation Checklist

### Phase 1: Setup (Day 1)
- [ ] Install dependencies (vitest, @testing-library/react, playwright, axe-core)
- [ ] Create directory structure
- [ ] Configure vitest.config.ts
- [ ] Configure playwright.config.ts
- [ ] Set up test utilities and helpers

### Phase 2: Unit Tests (Days 2-3)
- [ ] Write component unit tests (one per component)
- [ ] Achieve ≥85% coverage
- [ ] Create custom matchers
- [ ] Document test patterns

### Phase 3: Accessibility Tests (Days 4-5)
- [ ] Build UI Sandbox page
- [ ] Write a11y smoke tests
- [ ] Create a11y test utilities
- [ ] Test keyboard navigation
- [ ] Test screen reader compatibility

### Phase 4: CI Integration (Day 6)
- [ ] Create GitHub Actions workflow
- [ ] Configure caching strategies
- [ ] Set up artifact uploads
- [ ] Add PR comment automation
- [ ] Test workflow end-to-end

### Phase 5: Documentation (Day 7)
- [ ] Write testing guidelines
- [ ] Document test patterns
- [ ] Create troubleshooting guide
- [ ] Add contribution guidelines

## 8. Coverage Targets

### Component Coverage Thresholds

| Component | Statements | Branches | Functions | Lines | Priority |
|-----------|------------|----------|-----------|-------|----------|
| FormAccessible | 90% | 90% | 90% | 90% | Critical |
| SkipLinks | 90% | 90% | 90% | 90% | Critical |
| TouchFriendlySlider | 90% | 85% | 85% | 90% | High |
| Button | 85% | 80% | 85% | 85% | High |
| Card | 80% | 75% | 80% | 80% | Medium |
| Tabs | 85% | 80% | 85% | 85% | High |
| Label | 80% | 75% | 80% | 80% | Medium |
| Progress | 80% | 75% | 80% | 80% | Medium |

### WCAG 2.1 AA Compliance

All components must pass:
- ✅ **Level A**: All criteria
- ✅ **Level AA**: All criteria
- 🎯 **Level AAA**: Best effort (color contrast, focus indicators)

## 9. Performance Benchmarks

### Test Execution Targets

| Test Suite | Target Time | Max Time | Parallel |
|------------|-------------|----------|----------|
| Unit Tests (all) | < 30s | 60s | Yes |
| Single Component | < 2s | 5s | N/A |
| A11y Smoke Tests | < 90s | 180s | Yes |
| Full CI Pipeline | < 5min | 10min | Yes |

## 10. Failure Handling

### Automatic Retries
- Playwright tests: 2 retries in CI
- Flaky test detection: Mark tests with `.retry(3)`
- Screenshot on failure for a11y tests

### Failure Notifications
- Failed tests block PR merge
- Accessibility violations create review comments
- Coverage drops trigger warnings

## 11. Maintenance Strategy

### Weekly
- Review flaky tests
- Update snapshots if needed
- Check for new axe-core rules

### Monthly
- Update testing dependencies
- Review coverage trends
- Optimize slow tests

### Quarterly
- Audit test suite health
- Remove obsolete tests
- Update testing guidelines

## Conclusion

This test infrastructure provides:

1. **Comprehensive Coverage**: Unit, integration, and accessibility testing
2. **Developer Experience**: Fast feedback, helpful error messages, easy debugging
3. **Quality Gates**: Automated checks preventing regressions
4. **Accessibility First**: WCAG 2.1 AA compliance built-in
5. **CI/CD Ready**: GitHub Actions integration with caching and parallel execution

**Next Steps**: Implement configurations and sample tests, then expand to cover all components.
