// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Set required environment variables for tests
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000/api';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Optimized Next.js router mock - cache the mock object
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
};

const mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '',
}));

// Optimized global mocks - create once and reuse
const mockIntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockMatchMedia = jest.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

// Apply optimized mocks
global.IntersectionObserver = mockIntersectionObserver;
global.ResizeObserver = mockResizeObserver;
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

// Optimized console error filtering - more specific and performant
const originalError = console.error;
const ignoredWarnings = [
  'Warning: ReactDOM.render',
  'Warning: componentWillReceiveProps',
  'Warning: componentWillMount',
];

beforeAll(() => {
  console.error = (...args) => {
    const message = args[0];
    if (typeof message === 'string' && ignoredWarnings.some(warning => message.includes(warning))) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});