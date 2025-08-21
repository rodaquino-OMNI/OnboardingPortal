const nextJest = require('next/jest')
const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})
// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testEnvironmentOptions: {
    customExportConditions: [''], // Fix MSW v2 node import issues
  },
  moduleDirectories: ['node_modules', '<rootDir>/'],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  
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
    // Mock lucide-react for tests
    '^lucide-react$': '<rootDir>/__mocks__/lucide-react.js',
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
    '<rootDir>/__tests__/setup/',
    '<rootDir>/tests/', // Exclude separate tests folder
    '\\.spec\\.(ts|tsx|js|jsx)$', // Exclude .spec files (Playwright convention)
  ],
  
  // Transform patterns for ES modules
  transformIgnorePatterns: [
    'node_modules/(?!(msw|@mswjs|react-error-boundary|lucide-react)/)',
  ],
  
  // TypeScript configuration - simplified for basic functionality
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        skipLibCheck: true,
        noImplicitAny: false,
        strict: false,
        noUnusedLocals: false,
        noUnusedParameters: false,
        exactOptionalPropertyTypes: false
      }
    }]
  },
}
// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)