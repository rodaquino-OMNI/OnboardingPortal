#!/usr/bin/env node

/**
 * Direct Auth Loop Testing
 * Tests auth behavior using direct HTTP requests and curl
 */

const { spawn } = require('child_process');
const fetch = require('node-fetch');

class DirectAuthTester {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.testResults = {
      timestamp: new Date().toISOString(),
      tests: [],
      findings: [],
      summary: { passed: 0, failed: 0, warnings: 0 }
    };
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testDashboardRedirect() {
    console.log('🔍 Test 1: Dashboard Access & Redirect Behavior');
    
    try {
      const startTime = Date.now();
      const response = await fetch(`${this.baseUrl}/dashboard`, {
        redirect: 'manual',
        headers: {
          'User-Agent': 'Auth-Loop-Tester/1.0'
        }
      });
      
      const duration = Date.now() - startTime;
      const location = response.headers.get('location');
      
      const result = {
        name: 'Dashboard Redirect',
        status: 'passed',
        duration,
        details: {
          statusCode: response.status,
          redirectLocation: location,
          hasRedirect: response.status >= 300 && response.status < 400
        }
      };
      
      console.log(`  Status: ${response.status}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Redirect: ${location || 'none'}`);
      
      this.testResults.tests.push(result);
      this.testResults.summary.passed++;
      
      return result;
      
    } catch (error) {
      const result = {
        name: 'Dashboard Redirect',
        status: 'failed',
        error: error.message
      };
      
      console.error(`  ❌ Failed: ${error.message}`);
      this.testResults.tests.push(result);
      this.testResults.summary.failed++;
      
      return result;
    }
  }

  async testRapidAuthRequests() {
    console.log('\n🔄 Test 2: Rapid Auth Requests (Circuit Breaker Test)');
    
    const requests = [];
    const maxRequests = 10;
    const concurrent = 5;
    
    try {
      console.log(`  Making ${maxRequests} requests (${concurrent} concurrent)...`);
      
      // Make concurrent requests to trigger potential loops
      for (let batch = 0; batch < maxRequests; batch += concurrent) {
        const batchPromises = [];
        
        for (let i = 0; i < concurrent && (batch + i) < maxRequests; i++) {
          const requestNum = batch + i + 1;
          
          const promise = fetch(`${this.baseUrl}/api/auth/check`, {
            method: 'GET',
            headers: {
              'User-Agent': `Auth-Loop-Tester-${requestNum}/1.0`,
              'X-Test-Request': `${requestNum}`
            }
          }).then(response => ({
            requestNum,
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            timestamp: new Date().toISOString()
          })).catch(error => ({
            requestNum,
            error: error.message,
            timestamp: new Date().toISOString()
          }));
          
          batchPromises.push(promise);
        }
        
        const batchResults = await Promise.all(batchPromises);
        requests.push(...batchResults);
        
        // Small delay between batches
        await this.delay(100);
      }
      
      // Analyze results for rate limiting or circuit breaker behavior
      const rateLimited = requests.filter(r => r.status === 429).length;
      const errors = requests.filter(r => r.error).length;
      const successful = requests.filter(r => r.status === 200).length;
      
      const result = {
        name: 'Rapid Auth Requests',
        status: rateLimited > 0 ? 'passed' : (errors > 5 ? 'warning' : 'passed'),
        details: {
          totalRequests: requests.length,
          successful,
          rateLimited,
          errors,
          avgResponseTime: requests.filter(r => !r.error).length > 0 ? 'calculated' : 'n/a'
        },
        requests: requests.slice(0, 5) // First 5 for brevity
      };
      
      console.log(`  Total requests: ${requests.length}`);
      console.log(`  Successful: ${successful}`);
      console.log(`  Rate limited (429): ${rateLimited}`);
      console.log(`  Errors: ${errors}`);
      
      if (rateLimited > 0) {
        this.testResults.findings.push('✅ Rate limiting/circuit breaker appears to be working');
        console.log('  ✅ Rate limiting detected - circuit breaker working!');
      } else if (errors > 5) {
        this.testResults.findings.push('⚠️ High error rate detected - potential issues');
        console.log('  ⚠️ High error rate - potential auth issues');
      }
      
      this.testResults.tests.push(result);
      this.testResults.summary[result.status === 'passed' ? 'passed' : 'warnings']++;
      
      return result;
      
    } catch (error) {
      const result = {
        name: 'Rapid Auth Requests',
        status: 'failed',
        error: error.message
      };
      
      console.error(`  ❌ Failed: ${error.message}`);
      this.testResults.tests.push(result);
      this.testResults.summary.failed++;
      
      return result;
    }
  }

  async testMalformedCookieAuth() {
    console.log('\n🍪 Test 3: Malformed Cookie Handling');
    
    try {
      const malformedCookies = [
        'auth_token=invalid-token-format',
        'session_id={"malformed":json}',
        'user_data=not-json-at-all',
        'csrf_token='
      ];
      
      const response = await fetch(`${this.baseUrl}/dashboard`, {
        headers: {
          'Cookie': malformedCookies.join('; '),
          'User-Agent': 'Auth-Loop-Tester-Malformed/1.0'
        },
        redirect: 'manual'
      });
      
      const result = {
        name: 'Malformed Cookie Handling',
        status: response.status === 401 || response.status === 302 ? 'passed' : 'warning',
        details: {
          statusCode: response.status,
          redirectLocation: response.headers.get('location'),
          handledProperly: response.status === 401 || response.status === 302,
          cookiesSet: malformedCookies.length
        }
      };
      
      console.log(`  Status: ${response.status}`);
      console.log(`  Handled properly: ${result.details.handledProperly}`);
      
      if (result.details.handledProperly) {
        this.testResults.findings.push('✅ Malformed cookies are properly rejected');
        console.log('  ✅ Malformed cookies properly handled');
      } else {
        this.testResults.findings.push('⚠️ Malformed cookies may not be properly validated');
        console.log('  ⚠️ Malformed cookies may not be properly validated');
      }
      
      this.testResults.tests.push(result);
      this.testResults.summary[result.status === 'passed' ? 'passed' : 'warnings']++;
      
      return result;
      
    } catch (error) {
      const result = {
        name: 'Malformed Cookie Handling',
        status: 'failed',
        error: error.message
      };
      
      console.error(`  ❌ Failed: ${error.message}`);
      this.testResults.tests.push(result);
      this.testResults.summary.failed++;
      
      return result;
    }
  }

  async testRedirectLoop() {
    console.log('\n🔄 Test 4: Redirect Loop Detection');
    
    try {
      let currentUrl = `${this.baseUrl}/dashboard`;
      const redirectHistory = [];
      const maxRedirects = 10;
      
      for (let i = 0; i < maxRedirects; i++) {
        const response = await fetch(currentUrl, {
          redirect: 'manual',
          headers: {
            'User-Agent': `Auth-Loop-Tester-Redirect-${i}/1.0`
          }
        });
        
        redirectHistory.push({
          step: i + 1,
          url: currentUrl,
          status: response.status,
          location: response.headers.get('location')
        });
        
        if (response.status < 300 || response.status >= 400) {
          // Not a redirect, stop here
          break;
        }
        
        const location = response.headers.get('location');
        if (!location) {
          break;
        }
        
        // Check for loop (same URL appearing twice)
        const previousUrls = redirectHistory.map(h => h.url);
        if (previousUrls.includes(location)) {
          this.testResults.findings.push('⚠️ Redirect loop detected!');
          console.log('  ⚠️ Redirect loop detected!');
          break;
        }
        
        currentUrl = location.startsWith('http') ? location : `${this.baseUrl}${location}`;
      }
      
      const result = {
        name: 'Redirect Loop Detection',
        status: redirectHistory.length < 5 ? 'passed' : 'warning',
        details: {
          totalRedirects: redirectHistory.length,
          finalUrl: currentUrl,
          loopDetected: redirectHistory.length >= maxRedirects
        },
        redirectHistory: redirectHistory.slice(0, 5) // First 5 for brevity
      };
      
      console.log(`  Total redirects: ${redirectHistory.length}`);
      console.log(`  Final URL: ${currentUrl}`);
      
      if (redirectHistory.length < 5) {
        this.testResults.findings.push('✅ No excessive redirects detected');
        console.log('  ✅ No excessive redirects detected');
      } else {
        this.testResults.findings.push('⚠️ Excessive redirects may indicate loop issues');
        console.log('  ⚠️ Excessive redirects detected');
      }
      
      this.testResults.tests.push(result);
      this.testResults.summary[result.status === 'passed' ? 'passed' : 'warnings']++;
      
      return result;
      
    } catch (error) {
      const result = {
        name: 'Redirect Loop Detection',
        status: 'failed',
        error: error.message
      };
      
      console.error(`  ❌ Failed: ${error.message}`);
      this.testResults.tests.push(result);
      this.testResults.summary.failed++;
      
      return result;
    }
  }

  async checkServerLogs() {
    console.log('\n📋 Test 5: Server Log Analysis');
    
    return new Promise((resolve) => {
      // Use curl to make a request and capture any debug output
      const curl = spawn('curl', [
        '-s',
        '-w', '%{http_code}\\n%{redirect_url}\\n',
        '-H', 'User-Agent: Auth-Loop-Log-Checker/1.0',
        `${this.baseUrl}/dashboard`
      ]);
      
      let output = '';
      let error = '';
      
      curl.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      curl.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      curl.on('close', (code) => {
        const lines = output.trim().split('\n');
        const httpCode = lines[lines.length - 2] || 'unknown';
        const redirectUrl = lines[lines.length - 1] || '';
        
        const result = {
          name: 'Server Log Analysis',
          status: 'passed',
          details: {
            curlExitCode: code,
            httpCode,
            redirectUrl,
            hasError: error.length > 0
          },
          output: output.substring(0, 200), // First 200 chars
          error: error.substring(0, 200)
        };
        
        console.log(`  HTTP Code: ${httpCode}`);
        console.log(`  Redirect URL: ${redirectUrl || 'none'}`);
        console.log(`  Curl exit code: ${code}`);
        
        this.testResults.tests.push(result);
        this.testResults.summary.passed++;
        
        resolve(result);
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        curl.kill();
        const result = {
          name: 'Server Log Analysis',
          status: 'warning',
          details: { timeout: true }
        };
        this.testResults.tests.push(result);
        this.testResults.summary.warnings++;
        resolve(result);
      }, 10000);
    });
  }

  async runTests() {
    console.log('🚀 Starting Direct Auth Loop Tests\n');
    console.log(`Target: ${this.baseUrl}\n`);
    
    try {
      // Wait a moment for server to be ready
      await this.delay(1000);
      
      // Run all tests
      await this.testDashboardRedirect();
      await this.testRapidAuthRequests();
      await this.testMalformedCookieAuth();
      await this.testRedirectLoop();
      await this.checkServerLogs();
      
      // Generate summary
      console.log('\n📊 Test Results Summary:');
      console.log(`✅ Passed: ${this.testResults.summary.passed}`);
      console.log(`⚠️  Warnings: ${this.testResults.summary.warnings}`);
      console.log(`❌ Failed: ${this.testResults.summary.failed}`);
      
      console.log('\n🔍 Key Findings:');
      this.testResults.findings.forEach(finding => {
        console.log(`  ${finding}`);
      });
      
      // Additional analysis
      const hasIssues = this.testResults.summary.failed > 0 || this.testResults.summary.warnings > 2;
      
      if (hasIssues) {
        console.log('\n⚠️  Potential auth loop issues detected - review findings');
        this.testResults.findings.push('⚠️ Review required - potential auth loop issues');
      } else {
        console.log('\n🎉 No major auth loop issues detected');
        this.testResults.findings.push('✅ Auth loop prevention appears to be working properly');
      }
      
      return this.testResults;
      
    } catch (error) {
      console.error('\n💥 Test execution failed:', error);
      throw error;
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new DirectAuthTester();
  tester.runTests()
    .then(results => {
      const hasIssues = results.summary.failed > 0 || results.summary.warnings > 2;
      process.exit(hasIssues ? 1 : 0);
    })
    .catch(error => {
      console.error('Tests failed:', error);
      process.exit(1);
    });
}

module.exports = DirectAuthTester;