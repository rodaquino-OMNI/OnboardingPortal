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
  
  // Performance optimizations
  testTimeout: 15000, // 15 seconds max per test
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
    '^@/services/(.*)$': '<rootDir>/services/$1',
    '^@/types/(.*)$': '<rootDir>/types/$1',
    // Mock lucide-react and individual icons for tests
    '^lucide-react$': '<rootDir>/__mocks__/lucide-react.js',
    '^lucide-react/dist/esm/icons/(.*)$': '<rootDir>/__mocks__/lucide-react.js',
    '^lodash-es$': 'lodash',
    '^lodash-es/(.*)$': 'lodash/$1',
    // Mock missing dependencies
    '^framer-motion$': '<rootDir>/__mocks__/framer-motion.js',
    '^@radix-ui/(.*)$': '<rootDir>/__mocks__/@radix-ui.js',
    '^react-router-dom$': '<rootDir>/__mocks__/react-router-dom.js',
    // Handle CSS imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'hooks/**/*.{js,jsx,ts,tsx}',
    'services/**/*.{js,jsx,ts,tsx}',
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
  ],
  
  // Transform patterns for ES modules - let Next.js handle all transformations
  transformIgnorePatterns: [
    'node_modules/(?!(msw|@mswjs|react-error-boundary|@radix-ui|class-variance-authority|clsx|tailwind-merge|framer-motion|zustand|@tanstack|@hookform|lodash-es|sonner|date-fns|prom-client|tesseract\\.js|react-router-dom)/)',
  ],
  
  // Additional MSW v2 configuration
  resolver: undefined, // Use default Jest resolver
  fakeTimers: {
    enableGlobally: false // Prevent MSW timing conflicts
  }
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)