// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'npm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'vitest',
  testRunnerNodeArgs: ['--experimental-vm-modules'],
  coverageAnalysis: 'perTest',

  // Target the three main components for mutation testing
  mutate: [
    'src/video/VideoConferencing.tsx',
    'src/video/VideoChat.tsx',
    'src/upload/EnhancedDocumentUpload.tsx',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
  ],

  // Ignore certain mutations that are less meaningful
  mutationScore: {
    threshold: 60,
    high: 80,
    low: 60,
  },

  // Test configuration
  vitest: {
    configFile: 'vitest.config.ts',
  },

  // Ignore specific mutants that might cause issues
  ignorers: [
    'node_modules/**/*',
    'dist/**/*',
    'tests/**/*',
  ],

  // Timeout configuration
  timeoutMS: 60000,
  timeoutFactor: 1.5,

  // Logging
  logLevel: 'info',
  fileLogLevel: 'trace',

  // Output directory
  htmlReporter: {
    baseDir: 'reports/mutation',
  },

  // Concurrency
  concurrency: 4,
  maxConcurrentTestRunners: 2,

  // Incremental mode for faster subsequent runs
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
};

export default config;