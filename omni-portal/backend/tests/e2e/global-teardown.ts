import { FullConfig } from '@playwright/test';

/**
 * Global teardown for E2E tests
 * Runs once after all tests
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test environment cleanup...');
  
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    // Clean up test data
    console.log('📁 Cleaning up test database...');
    await execAsync('php artisan migrate:rollback --env=testing');
    
    // Clear all caches
    console.log('🧹 Clearing all caches...');
    await execAsync('php artisan cache:clear');
    await execAsync('php artisan config:clear');
    await execAsync('php artisan route:clear');
    
    console.log('✅ E2E test environment cleanup complete!');
  } catch (error) {
    console.error('❌ E2E cleanup failed:', error);
    // Don't throw here as cleanup failures shouldn't fail the test run
  }
}

export default globalTeardown;