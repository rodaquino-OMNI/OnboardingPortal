/**
 * Global Setup for UI Tests
 * 
 * Runs once before all test suites
 */

export default async function globalSetup() {
  console.log('🔧 Setting up UI testing environment...');
  
  // Set timezone for consistent date testing
  process.env.TZ = 'UTC';
  
  // Set NODE_ENV for testing
  process.env.NODE_ENV = 'test';
  
  // Disable animations for consistent testing
  process.env.DISABLE_ANIMATIONS = 'true';
  
  // Mock environment variables that might be needed
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000/api';
  
  console.log('✅ UI testing environment ready');
}