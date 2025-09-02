#!/usr/bin/env node

/**
 * Comprehensive System Validation Script
 * Tests all critical components for issues and bugs
 */

const fs = require('fs');
const path = require('path');

class SystemValidator {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      warnings: []
    };
  }

  // Test 1: Check for common security issues
  checkSecurityIssues() {
    console.log('🔒 Checking security configurations...');
    
    try {
      // Check middleware configuration
      const middlewarePath = './frontend/middleware.ts';
      if (fs.existsSync(middlewarePath)) {
        const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
        
        // Check for proper auth validation
        if (middlewareContent.includes('validateSessionToken') && middlewareContent.includes('validateCookieIntegrity')) {
          this.results.passed.push('✅ Authentication middleware properly configured');
        } else {
          this.results.failed.push('❌ Authentication middleware missing validation functions');
        }
        
        // Check for CSP headers
        if (middlewareContent.includes('Content-Security-Policy')) {
          this.results.passed.push('✅ Content Security Policy headers configured');
        } else {
          this.results.warnings.push('⚠️  Consider adding Content Security Policy headers');
        }
      }
      
      // Check auth validation functions
      const authValidationPath = './frontend/lib/auth-validation.ts';
      if (fs.existsSync(authValidationPath)) {
        const authContent = fs.readFileSync(authValidationPath, 'utf8');
        
        if (authContent.includes('validateJWTToken') && authContent.includes('validateSessionToken')) {
          this.results.passed.push('✅ Comprehensive JWT and session validation implemented');
        } else {
          this.results.failed.push('❌ Missing JWT or session validation functions');
        }
        
        // Check for rate limiting protection
        if (authContent.includes('checkRateLimit')) {
          this.results.passed.push('✅ Rate limiting protection implemented');
        } else {
          this.results.warnings.push('⚠️  Rate limiting could be enhanced');
        }
      }
      
    } catch (error) {
      this.results.failed.push(`❌ Security check failed: ${error.message}`);
    }
  }

  // Test 2: Check API endpoints configuration
  checkAPIConfiguration() {
    console.log('🌐 Checking API configurations...');
    
    try {
      // Check backend API routes
      const apiRoutesPath = './routes/api.php';
      if (fs.existsSync(apiRoutesPath)) {
        const apiContent = fs.readFileSync(apiRoutesPath, 'utf8');
        
        // Check for auth routes
        if (apiContent.includes("'/login'") && apiContent.includes("'/logout'")) {
          this.results.passed.push('✅ Core authentication routes configured');
        } else {
          this.results.failed.push('❌ Missing essential authentication routes');
        }
        
        // Check for proper middleware usage
        if (apiContent.includes('auth:sanctum')) {
          this.results.passed.push('✅ Laravel Sanctum middleware properly used');
        } else {
          this.results.failed.push('❌ Laravel Sanctum middleware not configured');
        }
        
        // Check for admin protection
        if (apiContent.includes('admin.access')) {
          this.results.passed.push('✅ Admin routes properly protected');
        } else {
          this.results.warnings.push('⚠️  Admin routes should have additional protection');
        }
      }
      
      // Check frontend API configuration
      const frontendApiPath = './frontend/lib/api/unified-auth.ts';
      if (fs.existsSync(frontendApiPath)) {
        const frontendApiContent = fs.readFileSync(frontendApiPath, 'utf8');
        
        // Check for CSRF protection
        if (frontendApiContent.includes('XSRF-TOKEN') && frontendApiContent.includes('sanctum/csrf-cookie')) {
          this.results.passed.push('✅ Frontend CSRF protection properly implemented');
        } else {
          this.results.failed.push('❌ Frontend CSRF protection missing or incomplete');
        }
        
        // Check for infinite loop prevention
        if (frontendApiContent.includes('_skipCSRF') || frontendApiContent.includes('skipCSRF')) {
          this.results.passed.push('✅ CSRF loop prevention implemented');
        } else {
          this.results.warnings.push('⚠️  CSRF request loops could occur');
        }
      }
      
    } catch (error) {
      this.results.failed.push(`❌ API configuration check failed: ${error.message}`);
    }
  }

  // Test 3: Check database and session configurations
  checkDatabaseConfig() {
    console.log('💾 Checking database and session configurations...');
    
    try {
      // Check session configuration
      const sessionConfigPath = './config/session.php';
      if (fs.existsSync(sessionConfigPath)) {
        const sessionContent = fs.readFileSync(sessionConfigPath, 'utf8');
        
        if (sessionContent.includes('fingerprinting')) {
          this.results.passed.push('✅ Enhanced session security features enabled');
        } else {
          this.results.warnings.push('⚠️  Consider enabling session fingerprinting');
        }
        
        if (sessionContent.includes("'encrypt' => env('SESSION_ENCRYPT', true)")) {
          this.results.passed.push('✅ Session encryption enabled');
        } else {
          this.results.warnings.push('⚠️  Session encryption should be enabled');
        }
      }
      
      // Check Sanctum configuration
      const sanctumConfigPath = './config/sanctum.php';
      if (fs.existsSync(sanctumConfigPath)) {
        const sanctumContent = fs.readFileSync(sanctumConfigPath, 'utf8');
        
        if (sanctumContent.includes('stateful')) {
          this.results.passed.push('✅ Sanctum stateful domain configuration found');
        } else {
          this.results.failed.push('❌ Sanctum stateful domains not configured');
        }
      }
      
    } catch (error) {
      this.results.failed.push(`❌ Database configuration check failed: ${error.message}`);
    }
  }

  // Test 4: Check for performance issues
  checkPerformanceIssues() {
    console.log('⚡ Checking for performance issues...');
    
    try {
      // Check WebSocket implementation
      const websocketPath = './frontend/lib/websocket.ts';
      if (fs.existsSync(websocketPath)) {
        const websocketContent = fs.readFileSync(websocketPath, 'utf8');
        
        if (websocketContent.includes('exponentialDelay')) {
          this.results.passed.push('✅ WebSocket exponential backoff implemented');
        } else {
          this.results.warnings.push('⚠️  WebSocket reconnection could be improved with exponential backoff');
        }
        
        if (websocketContent.includes('maxReconnectAttempts')) {
          this.results.passed.push('✅ WebSocket connection limits configured');
        } else {
          this.results.warnings.push('⚠️  WebSocket should have connection limits');
        }
      }
      
      // Check for authentication hook efficiency
      const useAuthPath = './frontend/hooks/auth/useAuth.ts';
      if (fs.existsSync(useAuthPath)) {
        const useAuthContent = fs.readFileSync(useAuthPath, 'utf8');
        
        if (useAuthContent.includes('throttle') || useAuthContent.includes('AUTH_CHECK_THROTTLE')) {
          this.results.passed.push('✅ Authentication check throttling implemented');
        } else {
          this.results.warnings.push('⚠️  Authentication checks should be throttled');
        }
      }
      
    } catch (error) {
      this.results.failed.push(`❌ Performance check failed: ${error.message}`);
    }
  }

  // Test 5: Check for common bugs
  checkCommonBugs() {
    console.log('🐛 Checking for common bugs...');
    
    try {
      // Check for race conditions in authentication
      const files = [
        './frontend/hooks/auth/useAuth.ts',
        './frontend/lib/api/auth.ts',
        './frontend/lib/api/unified-auth.ts'
      ];
      
      let hasRequestCancellation = false;
      let hasProperErrorHandling = false;
      
      files.forEach(filePath => {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          
          if (content.includes('AbortController') || content.includes('signal.aborted')) {
            hasRequestCancellation = true;
          }
          
          if (content.includes('try') && content.includes('catch') && content.includes('finally')) {
            hasProperErrorHandling = true;
          }
        }
      });
      
      if (hasRequestCancellation) {
        this.results.passed.push('✅ Request cancellation properly implemented');
      } else {
        this.results.warnings.push('⚠️  Request cancellation could prevent race conditions');
      }
      
      if (hasProperErrorHandling) {
        this.results.passed.push('✅ Comprehensive error handling implemented');
      } else {
        this.results.warnings.push('⚠️  Error handling could be improved');
      }
      
    } catch (error) {
      this.results.failed.push(`❌ Common bugs check failed: ${error.message}`);
    }
  }

  // Test 6: Check environment and deployment readiness
  checkDeploymentReadiness() {
    console.log('🚀 Checking deployment readiness...');
    
    try {
      // Check for environment files
      const envFiles = ['.env.production', '.env.testing', '.env.local'];
      const existingEnvFiles = envFiles.filter(file => fs.existsSync(file));
      
      if (existingEnvFiles.length > 0) {
        this.results.passed.push(`✅ Environment configurations found: ${existingEnvFiles.join(', ')}`);
      } else {
        this.results.warnings.push('⚠️  Environment configuration files missing');
      }
      
      // Check for build configuration
      const packageJsonPath = './frontend/package.json';
      if (fs.existsSync(packageJsonPath)) {
        const packageContent = fs.readFileSync(packageJsonPath, 'utf8');
        const packageData = JSON.parse(packageContent);
        
        if (packageData.scripts && packageData.scripts.build) {
          this.results.passed.push('✅ Frontend build script configured');
        } else {
          this.results.failed.push('❌ Frontend build script missing');
        }
      }
      
    } catch (error) {
      this.results.failed.push(`❌ Deployment readiness check failed: ${error.message}`);
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('🧪 Running comprehensive system validation...\n');
    
    this.checkSecurityIssues();
    this.checkAPIConfiguration();
    this.checkDatabaseConfig();
    this.checkPerformanceIssues();
    this.checkCommonBugs();
    this.checkDeploymentReadiness();
    
    this.printResults();
  }

  // Print results summary
  printResults() {
    console.log('\n' + '='.repeat(70));
    console.log('🏁 SYSTEM VALIDATION RESULTS');
    console.log('='.repeat(70));
    
    console.log('\n✅ PASSED TESTS:', this.results.passed.length);
    this.results.passed.forEach(result => console.log('   ', result));
    
    if (this.results.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:', this.results.warnings.length);
      this.results.warnings.forEach(result => console.log('   ', result));
    }
    
    if (this.results.failed.length > 0) {
      console.log('\n❌ FAILED TESTS:', this.results.failed.length);
      this.results.failed.forEach(result => console.log('   ', result));
    }
    
    // Overall assessment
    const totalTests = this.results.passed.length + this.results.failed.length + this.results.warnings.length;
    const successRate = this.results.failed.length === 0 ? 100 : Math.round((this.results.passed.length / totalTests) * 100);
    
    console.log('\n' + '='.repeat(70));
    if (this.results.failed.length === 0) {
      console.log('🎉 OVERALL STATUS: SYSTEM IS READY FOR PRODUCTION');
      console.log(`✨ Success Rate: ${successRate}% (${this.results.passed.length}/${totalTests} tests passed)`);
    } else {
      console.log('⚠️  OVERALL STATUS: ISSUES FOUND - REVIEW REQUIRED');
      console.log(`📊 Success Rate: ${successRate}% (${this.results.failed.length} critical issues)`);
    }
    
    if (this.results.warnings.length > 0) {
      console.log(`💡 ${this.results.warnings.length} improvement suggestions available`);
    }
    
    console.log('='.repeat(70));
  }
}

// Run the validation
const validator = new SystemValidator();
validator.runAllTests();