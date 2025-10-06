import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Environment
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
      ],
      thresholds: {
        // Overall thresholds
        global: {
          statements: 85,
          branches: 85,
          functions: 85,
          lines: 85,
        },
      },
    },

    // Test matching
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'tests/accessibility/**'],

    // Performance
    testTimeout: 10000,
    hookTimeout: 10000,

    // Reporting
    reporters: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results/unit-results.json',
      html: './test-results/index.html',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/ui': path.resolve(__dirname, './src/ui'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/tests': path.resolve(__dirname, './tests'),
    },
  },
});
