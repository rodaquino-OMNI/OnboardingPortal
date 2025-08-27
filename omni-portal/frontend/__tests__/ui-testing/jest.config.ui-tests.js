/**
 * Jest Configuration for UI Testing
 * 
 * Specialized configuration for UI tests with optimized settings
 */

const path = require('path');

module.exports = {
  // Extend base Jest config
  ...require('../../jest.config.js'),
  
  // Test environment optimized for UI testing
  testEnvironment: 'jsdom',
  
  // Only run UI tests
  testMatch: [
    '<rootDir>/__tests__/ui-testing/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/__tests__/accessibility/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/__tests__/mobile/**/*.test.{js,jsx,ts,tsx}',
  ],
  
  // Setup files for UI testing
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/__tests__/ui-testing/test-setup.ts',
  ],
  
  // Optimized for visual testing
  testTimeout: 20000, // Longer timeout for visual tests
  
  // Coverage settings for UI components
  collectCoverageFrom: [
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/utils/accessibility.ts',
    'lib/hooks/useViewport.ts',
    'app/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/__tests__/**',
  ],
  
  // Coverage thresholds for UI components
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './components/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './lib/utils/accessibility.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  
  // Module name mapping for UI tests
  moduleNameMapper: {
    ...require('../../jest.config.js').moduleNameMapper,
    '^@/test-utils$': '<rootDir>/__tests__/ui-testing/test-utilities.tsx',
  },
  
  // Reporters for UI testing
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './coverage/ui-tests',
      filename: 'ui-test-report.html',
      expand: true,
      hideIcon: false,
    }],
  ],
  
  // Transform ignore patterns for UI libraries
  transformIgnorePatterns: [
    'node_modules/(?!(msw|@mswjs|react-error-boundary|lucide-react|@radix-ui|class-variance-authority|clsx|tailwind-merge|framer-motion|zustand|@tanstack|@testing-library)/)',
  ],
  
  // Global setup for UI testing
  globalSetup: '<rootDir>/__tests__/ui-testing/global-setup.ts',
  globalTeardown: '<rootDir>/__tests__/ui-testing/global-teardown.ts',
  
  // Snapshot serializer for better snapshots
  snapshotSerializers: ['jest-serializer-html'],
  
  // Mock settings for UI tests
  clearMocks: true,
  restoreMocks: true,
};