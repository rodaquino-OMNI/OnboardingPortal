#!/usr/bin/env node

/**
 * Runtime Auth Loop Prevention Testing
 * Tests actual auth behavior in live environment
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class AuthLoopTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.testResults = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };
    this.consoleMessages = [];
    this.networkRequests = [];
    this.redirectHistory = [];
  }

  async setup() {
    console.log('🚀 Setting up browser for auth loop testing...');
    
    this.browser = await puppeteer.launch({
      headless: false, // Show browser for debugging
      devtools: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--allow-running-insecure-content'
      ]
    });

    this.page = await this.browser.newPage();
    
    // Setup console monitoring
    this.page.on('console', (msg) => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString(),
        location: msg.location()
      };
      this.consoleMessages.push(message);
      console.log(`📝 Console [${msg.type()}]:`, msg.text());
    });

    // Setup network monitoring
    this.page.on('request', (request) => {
      this.networkRequests.push({
        url: request.url(),
        method: request.method(),
        timestamp: new Date().toISOString()
      });
    });

    // Setup redirect monitoring
    this.page.on('response', (response) => {
      if ([301, 302, 303, 307, 308].includes(response.status())) {
        this.redirectHistory.push({
          from: response.url(),
          to: response.headers()['location'],
          status: response.status(),
          timestamp: new Date().toISOString()
        });
      }
    });

    await this.page.setViewport({ width: 1280, height: 720 });
    
    // Enable request interception for cookie manipulation
    await this.page.setRequestInterception(true);
    this.page.on('request', (request) => {
      request.continue();
    });

    console.log('✅ Browser setup complete');
  }

  async testDashboardNavigation() {
    console.log('\n🔍 Test 1: Dashboard Navigation Auth Flow');
    const testStart = Date.now();
    
    try {
      // Navigate to dashboard
      console.log('Navigating to http://localhost:3001/dashboard...');
      const response = await this.page.goto('http://localhost:3001/dashboard', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      console.log(`Response status: ${response.status()}`);
      
      // Wait for auth checks to complete
      await this.page.waitForTimeout(3000);
      
      // Check current URL
      const currentUrl = this.page.url();
      console.log(`Current URL: ${currentUrl}`);
      
      // Look for auth recursion warnings
      const authWarnings = this.consoleMessages.filter(msg => 
        msg.text.includes('auth check recursion') || 
        msg.text.includes('circuit breaker') ||
        msg.text.includes('useAuth hook accessed')
      );

      const testResult = {
        name: 'Dashboard Navigation',
        duration: Date.now() - testStart,
        status: 'passed',
        details: {
          finalUrl: currentUrl,
          authWarnings: authWarnings.length,
          redirects: this.redirectHistory.length,
          consoleMessages: this.consoleMessages.length
        },
        warnings: authWarnings
      };

      // Check for infinite redirects
      if (this.redirectHistory.length > 5) {
        testResult.status = 'warning';
        testResult.issue = 'Excessive redirects detected';
        this.testResults.summary.warnings++;
      } else {
        this.testResults.summary.passed++;
      }

      this.testResults.tests.push(testResult);
      console.log(`✅ Test completed: ${testResult.status}`);
      
    } catch (error) {
      const testResult = {
        name: 'Dashboard Navigation',
        duration: Date.now() - testStart,
        status: 'failed',
        error: error.message,
        details: {
          redirects: this.redirectHistory.length,
          consoleMessages: this.consoleMessages.length
        }
      };
      this.testResults.tests.push(testResult);
      this.testResults.summary.failed++;
      console.error(`❌ Test failed: ${error.message}`);
    }
  }

  async testCircuitBreaker() {
    console.log('\n🔍 Test 2: Circuit Breaker Activation');
    const testStart = Date.now();
    
    try {
      // Clear previous state
      this.consoleMessages = [];
      this.redirectHistory = [];
      
      // Simulate rapid auth checks by refreshing multiple times
      console.log('Triggering multiple rapid auth checks...');
      
      for (let i = 0; i < 5; i++) {
        console.log(`Attempt ${i + 1}/5...`);
        await this.page.reload({ waitUntil: 'networkidle2' });
        await this.page.waitForTimeout(1000);
      }

      // Look for circuit breaker activation
      const circuitBreakerMessages = this.consoleMessages.filter(msg => 
        msg.text.includes('circuit breaker activated') ||
        msg.text.includes('auth check limit exceeded') ||
        msg.text.includes('preventing infinite loop')
      );

      const testResult = {
        name: 'Circuit Breaker',
        duration: Date.now() - testStart,
        status: circuitBreakerMessages.length > 0 ? 'passed' : 'warning',
        details: {
          attempts: 5,
          circuitBreakerTriggers: circuitBreakerMessages.length,
          totalMessages: this.consoleMessages.length
        },
        circuitBreakerMessages
      };

      if (testResult.status === 'passed') {
        this.testResults.summary.passed++;
      } else {
        this.testResults.summary.warnings++;
        testResult.issue = 'Circuit breaker may not be activating properly';
      }

      this.testResults.tests.push(testResult);
      console.log(`✅ Test completed: ${testResult.status}`);
      
    } catch (error) {
      const testResult = {
        name: 'Circuit Breaker',
        duration: Date.now() - testStart,
        status: 'failed',
        error: error.message
      };
      this.testResults.tests.push(testResult);
      this.testResults.summary.failed++;
      console.error(`❌ Test failed: ${error.message}`);
    }
  }

  async testMalformedCookies() {
    console.log('\n🔍 Test 3: Malformed Cookies Validation');
    const testStart = Date.now();
    
    try {
      // Set malformed cookies
      const malformedCookies = [
        { name: 'auth_token', value: 'malformed_token_123' },
        { name: 'session_id', value: 'invalid-session-data' },
        { name: 'user_data', value: '{"invalid":json}' }
      ];

      console.log('Setting malformed cookies...');
      for (const cookie of malformedCookies) {
        await this.page.setCookie({
          name: cookie.name,
          value: cookie.value,
          domain: 'localhost',
          path: '/'
        });
      }

      // Clear previous messages
      this.consoleMessages = [];
      
      // Navigate with malformed cookies
      await this.page.goto('http://localhost:3001/dashboard', {
        waitUntil: 'networkidle2'
      });

      await this.page.waitForTimeout(3000);

      // Look for validation errors
      const validationErrors = this.consoleMessages.filter(msg => 
        msg.text.includes('token validation failed') ||
        msg.text.includes('invalid session') ||
        msg.text.includes('cookie validation error') ||
        msg.type === 'error'
      );

      const testResult = {
        name: 'Malformed Cookies',
        duration: Date.now() - testStart,
        status: validationErrors.length > 0 ? 'passed' : 'warning',
        details: {
          malformedCookiesSet: malformedCookies.length,
          validationErrors: validationErrors.length,
          finalUrl: this.page.url()
        },
        validationErrors
      };

      if (testResult.status === 'passed') {
        this.testResults.summary.passed++;
      } else {
        this.testResults.summary.warnings++;
        testResult.issue = 'Malformed cookie validation may be missing';
      }

      this.testResults.tests.push(testResult);
      console.log(`✅ Test completed: ${testResult.status}`);
      
    } catch (error) {
      const testResult = {
        name: 'Malformed Cookies',
        duration: Date.now() - testStart,
        status: 'failed',
        error: error.message
      };
      this.testResults.tests.push(testResult);
      this.testResults.summary.failed++;
      console.error(`❌ Test failed: ${error.message}`);
    }
  }

  async testAuthStateOscillation() {
    console.log('\n🔍 Test 4: Auth State Oscillation Detection');
    const testStart = Date.now();
    
    try {
      this.consoleMessages = [];
      
      // Monitor auth state changes over time
      console.log('Monitoring auth state changes...');
      
      await this.page.goto('http://localhost:3001/dashboard');
      
      // Wait and collect auth state messages
      for (let i = 0; i < 10; i++) {
        await this.page.waitForTimeout(1000);
        await this.page.evaluate(() => {
          // Try to trigger auth state check
          if (window.location.pathname === '/dashboard') {
            window.location.reload();
          }
        });
      }

      // Analyze auth state changes
      const authStateMessages = this.consoleMessages.filter(msg => 
        msg.text.includes('useAuth hook accessed') ||
        msg.text.includes('auth state changed') ||
        msg.text.includes('isAuthenticated')
      );

      // Look for rapid oscillations (more than 5 state changes per second)
      const oscillationThreshold = 5;
      const timeWindow = 1000; // 1 second
      let maxOscillations = 0;
      
      for (let i = 0; i < authStateMessages.length; i++) {
        const currentTime = new Date(authStateMessages[i].timestamp).getTime();
        let oscillationCount = 1;
        
        for (let j = i + 1; j < authStateMessages.length; j++) {
          const nextTime = new Date(authStateMessages[j].timestamp).getTime();
          if (nextTime - currentTime <= timeWindow) {
            oscillationCount++;
          } else {
            break;
          }
        }
        
        if (oscillationCount > maxOscillations) {
          maxOscillations = oscillationCount;
        }
      }

      const testResult = {
        name: 'Auth State Oscillation',
        duration: Date.now() - testStart,
        status: maxOscillations > oscillationThreshold ? 'warning' : 'passed',
        details: {
          totalAuthStateChanges: authStateMessages.length,
          maxOscillationsPerSecond: maxOscillations,
          threshold: oscillationThreshold
        },
        authStateMessages: authStateMessages.slice(0, 10) // First 10 for brevity
      };

      if (testResult.status === 'passed') {
        this.testResults.summary.passed++;
      } else {
        this.testResults.summary.warnings++;
        testResult.issue = `Rapid auth state oscillation detected: ${maxOscillations} changes/second`;
      }

      this.testResults.tests.push(testResult);
      console.log(`✅ Test completed: ${testResult.status}`);
      
    } catch (error) {
      const testResult = {
        name: 'Auth State Oscillation',
        duration: Date.now() - testStart,
        status: 'failed',
        error: error.message
      };
      this.testResults.tests.push(testResult);
      this.testResults.summary.failed++;
      console.error(`❌ Test failed: ${error.message}`);
    }
  }

  async runAllTests() {
    try {
      await this.setup();
      
      console.log('🔥 Starting Auth Loop Prevention Runtime Tests\n');
      
      await this.testDashboardNavigation();
      await this.testCircuitBreaker();
      await this.testMalformedCookies();
      await this.testAuthStateOscillation();
      
      // Generate final report
      console.log('\n📊 Test Results Summary:');
      console.log(`✅ Passed: ${this.testResults.summary.passed}`);
      console.log(`⚠️  Warnings: ${this.testResults.summary.warnings}`);
      console.log(`❌ Failed: ${this.testResults.summary.failed}`);
      
      // Save results
      const resultsPath = path.join(__dirname, 'auth-loop-test-results.json');
      await fs.writeFile(resultsPath, JSON.stringify(this.testResults, null, 2));
      console.log(`📝 Full results saved to: ${resultsPath}`);
      
      return this.testResults;
      
    } catch (error) {
      console.error('💥 Test suite failed:', error);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new AuthLoopTester();
  tester.runAllTests()
    .then(results => {
      console.log('\n🎉 Auth loop testing completed successfully!');
      process.exit(results.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('\n💥 Auth loop testing failed:', error);
      process.exit(1);
    });
}

module.exports = AuthLoopTester;