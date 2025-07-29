const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleDirectories: ['node_modules', '<rootDir>/'],
  
  // Performance optimizations
  testTimeout: 15000, // 15 seconds max per test (was unlimited)
  maxWorkers: '50%', // Use half of available CPU cores for parallel execution
  
  // Cache optimization
  cacheDirectory: '<rootDir>/.jest-cache',
  clearMocks: true, // Clear mocks automatically between tests
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@/styles/(.*)$': '<rootDir>/styles/$1',
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'hooks/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  testMatch: [
    '**/__tests__/**/*.{js,jsx,ts,tsx}',
    '**/*.{spec,test}.{js,jsx,ts,tsx}',
  ],
  
  // Combined ignore patterns for better performance
  testPathIgnorePatterns: [
    '<rootDir>/.next/', 
    '<rootDir>/node_modules/', 
    '<rootDir>/e2e/', // Exclude Playwright e2e tests
    '<rootDir>/__tests__/utils/', // Exclude utility files without tests
    '<rootDir>/__tests__/setup/',
    '<rootDir>/tests/', // Exclude separate tests folder
    '<rootDir>/__tests__/performance/', // Exclude performance tests from regular runs
    '\\.spec\\.(ts|tsx|js|jsx)$', // Exclude .spec files (Playwright convention)
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)