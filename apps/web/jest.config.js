module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests', '<rootDir>/lib'],
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
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    '!lib/**/*.d.ts',
    '!lib/**/*.stories.tsx',
    '!lib/**/__tests__/**',
  ],
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Analytics contract tests require 100% schema coverage
    'lib/analytics/**/*.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
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
        '!<rootDir>/tests/analytics/contracts/**/*.test.ts',
      ],
      testEnvironment: 'jsdom',
    },
  ],
};
