module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests', '<rootDir>/lib', '<rootDir>/src/__tests__'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'src/components/**/*.{ts,tsx}',
    'src/hooks/**/*.{ts,tsx}',
    'src/containers/**/*.{ts,tsx}',
    '!lib/**/*.d.ts',
    '!lib/**/*.stories.tsx',
    '!lib/**/__tests__/**',
    '!src/**/__tests__/**',
  ],
  coverageThresholds: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    // Analytics contract tests require 100% schema coverage
    'lib/analytics/**/*.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    // Critical containers require 90% coverage
    'src/containers/**/*.tsx': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    // Health questionnaire components require 85% coverage
    'src/components/health/**/*.tsx': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    // Health hooks require 85% coverage
    'src/hooks/useQuestionnaire*.ts': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  // Separate test projects for different test types
  projects: [
    {
      displayName: 'analytics-contracts',
      testMatch: ['<rootDir>/tests/analytics/contracts/**/*.test.ts'],
      testEnvironment: 'node',
    },
    {
      displayName: 'unit',
      testMatch: [
        '<rootDir>/tests/**/*.test.ts?(x)',
        '<rootDir>/src/__tests__/**/*.test.ts?(x)',
        '!<rootDir>/tests/analytics/contracts/**/*.test.ts',
        '!<rootDir>/src/__tests__/health/questionnaire-a11y.test.tsx',
      ],
      testEnvironment: 'jsdom',
    },
    {
      displayName: 'accessibility',
      testMatch: ['<rootDir>/src/__tests__/health/questionnaire-a11y.test.tsx'],
      testEnvironment: 'jsdom',
    },
  ],
};
