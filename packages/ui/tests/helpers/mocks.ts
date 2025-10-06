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
