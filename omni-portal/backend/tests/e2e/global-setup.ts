import { FullConfig } from '@playwright/test';

/**
 * Global setup for E2E tests
 * Runs once before all tests
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test environment setup...');
  
  // Setup test database
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    // Run Laravel migrations for testing
    console.log('📁 Setting up test database...');
    await execAsync('php artisan migrate:fresh --env=testing --seed');
    
    // Create test users
    console.log('👤 Creating test users...');
    await execAsync('php artisan db:seed --class=DemoUserSeeder --env=testing');
    
    // Clear caches
    console.log('🧹 Clearing caches...');
    await execAsync('php artisan cache:clear');
    await execAsync('php artisan config:clear');
    
    console.log('✅ E2E test environment setup complete!');
  } catch (error) {
    console.error('❌ E2E setup failed:', error);
    throw error;
  }
}

export default globalSetup;