const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

// Separate config for performance tests
const perfJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleDirectories: ['node_modules', '<rootDir>/'],
  
  // Performance test specific settings
  testTimeout: 30000, // 30 seconds for performance tests
  maxWorkers: 1, // Run performance tests serially to get accurate measurements
  
  // Cache optimization
  cacheDirectory: '<rootDir>/.jest-cache-perf',
  clearMocks: true,
  
  // Only run performance tests
  testMatch: [
    '**/__tests__/performance/**/*.{js,jsx,ts,tsx}',
  ],
  
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@/styles/(.*)$': '<rootDir>/styles/$1',
  },
  
  // Performance test specific coverage
  collectCoverageFrom: [
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
}

module.exports = createJestConfig(perfJestConfig)