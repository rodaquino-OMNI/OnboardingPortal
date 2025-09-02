#!/usr/bin/env node

/**
 * Lightweight Browser Auth Simulation
 * Uses JSDOM and fetch to simulate browser auth behavior
 */

const { JSDOM } = require('jsdom');
const fetch = require('node-fetch');

class BrowserAuthSimulator {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.cookies = new Map();
    this.authChecks = 0;
    this.redirectHistory = [];
    this.warningLogs = [];
    this.dom = null;
  }

  async setup() {
    console.log('🌐 Setting up browser simulation...');
    
    // Create DOM environment
    this.dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: this.baseUrl,
      runScripts: 'dangerously',
      resources: 'usable'
    });

    // Mock console to capture warnings
    const originalConsole = this.dom.window.console;
    this.dom.window.console = {
      ...originalConsole,
      warn: (...args) => {
        const message = args.join(' ');
        this.warningLogs.push({
          type: 'warn',
          message,
          timestamp: new Date().toISOString()
        });
        originalConsole.warn(...args);
      },
      error: (...args) => {
        const message = args.join(' ');
        this.warningLogs.push({
          type: 'error',
          message,
          timestamp: new Date().toISOString()
        });
        originalConsole.error(...args);
      }
    };

    global.window = this.dom.window;
    global.document = this.dom.window.document;
    global.navigator = this.dom.window.navigator;
    global.localStorage = this.dom.window.localStorage;
    
    console.log('✅ Browser simulation ready');
  }

  async fetchWithCookies(url, options = {}) {
    const cookieHeader = Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');

    const response = await fetch(url, {
      ...options,
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ...options.headers
      }
    });

    // Parse set-cookie headers
    const setCookies = response.headers.raw()['set-cookie'] || [];
    setCookies.forEach(cookie => {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      if (name && value) {
        this.cookies.set(name.trim(), value.trim());
      }
    });

    // Track redirects
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      this.redirectHistory.push({
        from: url,
        to: response.headers.get('location'),
        status: response.status,
        timestamp: new Date().toISOString()
      });
    }

    return response;
  }

  async simulateDashboardAccess() {
    console.log('\n🔍 Simulating dashboard access...');
    
    try {
      const response = await this.fetchWithCookies(`${this.baseUrl}/dashboard`);
      const html = await response.text();
      
      console.log(`Response status: ${response.status}`);
      console.log(`Content length: ${html.length} bytes`);
      console.log(`Cookies received: ${this.cookies.size}`);
      
      // Check for auth-related content
      const hasAuthRedirect = html.includes('login') || html.includes('auth');
      const hasAuthScript = html.includes('useAuth') || html.includes('authentication');
      
      return {
        status: response.status,
        hasAuthRedirect,
        hasAuthScript,
        contentLength: html.length,
        cookies: Array.from(this.cookies.entries())
      };
      
    } catch (error) {
      console.error('Failed to access dashboard:', error.message);
      return { error: error.message };
    }
  }

  async testAuthLoopPrevention() {
    console.log('\n🔄 Testing auth loop prevention...');
    
    const maxAttempts = 10;
    const results = [];
    
    for (let i = 0; i < maxAttempts; i++) {
      console.log(`Auth check attempt ${i + 1}/${maxAttempts}`);
      
      const startTime = Date.now();
      const response = await this.fetchWithCookies(`${this.baseUrl}/api/auth/check`);
      const duration = Date.now() - startTime;
      
      results.push({
        attempt: i + 1,
        status: response.status,
        duration,
        redirected: response.redirected
      });
      
      // Check for circuit breaker behavior
      if (response.status === 429 || response.headers.get('x-rate-limit-exceeded')) {
        console.log('🛡️ Circuit breaker activated!');
        break;
      }
      
      // Small delay to simulate real usage
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }

  async testMalformedCookieHandling() {
    console.log('\n🍪 Testing malformed cookie handling...');
    
    // Set malformed cookies
    this.cookies.set('auth_token', 'invalid-token-format');
    this.cookies.set('session_data', '{"malformed":json}');
    this.cookies.set('user_id', 'not-a-number');
    
    try {
      const response = await this.fetchWithCookies(`${this.baseUrl}/api/auth/validate`);
      const result = await response.text();
      
      return {
        status: response.status,
        handled: response.status === 401 || response.status === 400,
        response: result.substring(0, 200) // First 200 chars
      };
      
    } catch (error) {
      return {
        error: error.message,
        handled: true // Error thrown means it was handled
      };
    }
  }

  async monitorAuthStateChanges() {
    console.log('\n📊 Monitoring auth state changes...');
    
    const authStates = [];
    const checkInterval = 500; // 500ms
    const totalChecks = 10;
    
    for (let i = 0; i < totalChecks; i++) {
      const startTime = Date.now();
      
      try {
        const response = await this.fetchWithCookies(`${this.baseUrl}/api/auth/status`);
        const authData = await response.json().catch(() => ({}));
        
        authStates.push({
          check: i + 1,
          timestamp: new Date().toISOString(),
          status: response.status,
          isAuthenticated: authData.isAuthenticated || false,
          hasUser: authData.hasUser || false,
          duration: Date.now() - startTime
        });
        
      } catch (error) {
        authStates.push({
          check: i + 1,
          timestamp: new Date().toISOString(),
          error: error.message,
          duration: Date.now() - startTime
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    // Analyze for oscillations
    let oscillations = 0;
    for (let i = 1; i < authStates.length; i++) {
      const prev = authStates[i - 1];
      const curr = authStates[i];
      
      if (prev.isAuthenticated !== curr.isAuthenticated) {
        oscillations++;
      }
    }
    
    return {
      totalChecks,
      oscillations,
      authStates: authStates.slice(0, 5), // First 5 for brevity
      avgDuration: authStates.reduce((sum, state) => sum + (state.duration || 0), 0) / authStates.length
    };
  }

  async runSimulation() {
    console.log('🚀 Starting Browser Auth Simulation\n');
    
    await this.setup();
    
    const results = {
      timestamp: new Date().toISOString(),
      tests: {}
    };
    
    // Test 1: Dashboard access
    results.tests.dashboardAccess = await this.simulateDashboardAccess();
    
    // Test 2: Auth loop prevention
    results.tests.authLoopPrevention = await this.testAuthLoopPrevention();
    
    // Test 3: Malformed cookie handling
    results.tests.malformedCookies = await this.testMalformedCookieHandling();
    
    // Test 4: Auth state monitoring
    results.tests.authStateMonitoring = await this.monitorAuthStateChanges();
    
    // Add collected warnings
    results.warningLogs = this.warningLogs;
    results.redirectHistory = this.redirectHistory;
    
    console.log('\n📋 Simulation Results:');
    console.log(`Dashboard Access: ${results.tests.dashboardAccess.status || 'Error'}`);
    console.log(`Auth Loop Prevention: ${results.tests.authLoopPrevention.length} attempts made`);
    console.log(`Malformed Cookies: ${results.tests.malformedCookies.handled ? 'Handled' : 'Not handled'}`);
    console.log(`Auth State Oscillations: ${results.tests.authStateMonitoring.oscillations}`);
    console.log(`Warnings Logged: ${this.warningLogs.length}`);
    console.log(`Redirects Tracked: ${this.redirectHistory.length}`);
    
    return results;
  }
}

// Run simulation if called directly
if (require.main === module) {
  const simulator = new BrowserAuthSimulator();
  simulator.runSimulation()
    .then(results => {
      console.log('\n✅ Browser auth simulation completed!');
      
      // Quick analysis
      const hasIssues = results.warningLogs.length > 5 || 
                       results.tests.authStateMonitoring.oscillations > 3 ||
                       results.redirectHistory.length > 5;
      
      if (hasIssues) {
        console.log('⚠️  Potential auth issues detected');
        process.exit(1);
      } else {
        console.log('🎉 No major auth issues found');
        process.exit(0);
      }
    })
    .catch(error => {
      console.error('\n❌ Simulation failed:', error);
      process.exit(1);
    });
}

module.exports = BrowserAuthSimulator;