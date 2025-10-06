/**
 * Jest Test Setup
 * Configures global test environment
 */

import '@testing-library/jest-dom';

// Suppress console errors in tests unless explicitly needed
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.ANALYTICS_SALT = 'test_salt_for_hashing';
