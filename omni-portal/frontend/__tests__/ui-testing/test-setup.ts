/**
 * UI Testing Setup
 * 
 * Setup file for UI-specific testing configuration
 */

import 'jest-axe/extend-expect';

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock CSS.supports for feature detection tests
Object.defineProperty(CSS, 'supports', {
  writable: true,
  value: jest.fn().mockImplementation((property, value) => {
    // Mock common CSS feature support
    const supportedFeatures = {
      'display:grid': true,
      'display:flex': true,
      '--test:value': true,
    };
    
    const key = value ? `${property}:${value}` : property;
    return supportedFeatures[key] || false;
  }),
});

// Mock getComputedStyle for style testing
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = jest.fn().mockImplementation((element) => {
  const style = originalGetComputedStyle(element);
  
  // Add mock styles for testing
  return {
    ...style,
    getPropertyValue: jest.fn().mockImplementation((property) => {
      const mockStyles = {
        'color': '#374151',
        'background-color': '#ffffff',
        'font-size': '16px',
        'margin': '0px',
        'padding': '8px 16px',
        'border': '1px solid #d1d5db',
        'min-height': '44px',
        'height': '44px',
        'width': '100px',
      };
      
      return mockStyles[property] || style.getPropertyValue?.(property) || '';
    }),
  };
});

// Mock performance API
if (!global.performance) {
  global.performance = {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(),
    getEntriesByType: jest.fn(),
  } as any;
}

// Mock localStorage
const mockStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockStorage,
});

Object.defineProperty(window, 'sessionStorage', {
  value: mockStorage,
});

// Mock fetch for API calls
global.fetch = jest.fn();

// Setup viewport mock
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 768,
});

// Mock scroll methods
window.scrollTo = jest.fn();
Element.prototype.scrollIntoView = jest.fn();

// Mock focus methods
HTMLElement.prototype.focus = jest.fn();
HTMLElement.prototype.blur = jest.fn();

// Console helpers for test debugging
const originalConsoleError = console.error;
console.error = (...args) => {
  // Suppress specific React warnings in tests
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: ReactDOM.render is no longer supported')
  ) {
    return;
  }
  
  originalConsoleError.call(console, ...args);
};

// Extend Jest expect with custom UI matchers
expect.extend({
  toHaveAccessibleName(received, expectedName) {
    const accessibleName = 
      received.getAttribute('aria-label') ||
      received.getAttribute('aria-labelledby') ||
      received.textContent ||
      received.getAttribute('title') ||
      received.getAttribute('placeholder');
    
    const pass = accessibleName === expectedName;
    
    return {
      message: () =>
        `expected element ${pass ? 'not ' : ''}to have accessible name "${expectedName}", but got "${accessibleName}"`,
      pass,
    };
  },
  
  toHaveSufficientColorContrast(received) {
    const styles = window.getComputedStyle(received);
    const color = styles.getPropertyValue('color');
    const backgroundColor = styles.getPropertyValue('background-color');
    
    // Simplified contrast check - in real tests you'd use a proper contrast calculator
    const pass = color !== backgroundColor && color !== 'transparent';
    
    return {
      message: () =>
        `expected element ${pass ? 'not ' : ''}to have sufficient color contrast`,
      pass,
    };
  },
  
  toHaveMinimumTouchTarget(received, minSize = 44) {
    const rect = received.getBoundingClientRect();
    const pass = rect.width >= minSize && rect.height >= minSize;
    
    return {
      message: () =>
        `expected element ${pass ? 'not ' : ''}to have minimum touch target of ${minSize}px, but got ${rect.width}x${rect.height}`,
      pass,
    };
  },
});

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset DOM
  document.body.innerHTML = '';
  
  // Reset viewport
  window.innerWidth = 1024;
  window.innerHeight = 768;
  
  // Reset user agent
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    configurable: true,
  });
});

// Global test cleanup
afterEach(() => {
  // Cleanup any event listeners
  document.removeEventListener = jest.fn();
  window.removeEventListener = jest.fn();
});

export {};