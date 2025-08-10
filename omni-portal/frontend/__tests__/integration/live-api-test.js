/**
 * Live API Integration Tests
 * Tests real API endpoints with actual HTTP requests
 */

const https = require('https');
const http = require('http');

const API_BASE_URL = 'http://localhost:8000/api';
const FRONTEND_URL = 'http://localhost:3000';

class LiveApiTester {
  constructor() {
    this.results = [];
  }

  async makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = `${API_BASE_URL}${path}`;
      const urlObj = new URL(url);
      
      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': FRONTEND_URL,
          'User-Agent': 'API-Integration-Tester/1.0',
          ...options.headers
        }
      };

      const startTime = Date.now();
      
      const req = http.request(requestOptions, (res) => {
        const responseTime = Date.now() - startTime;
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsedData = data ? JSON.parse(data) : null;
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: parsedData,
              responseTime,
              rawData: data
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: null,
              responseTime,
              rawData: data
            });
          }
        });
      });

      req.on('error', (err) => {
        const responseTime = Date.now() - startTime;
        reject({
          error: err.message,
          responseTime
        });
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }

  async testAuthentication() {
    console.log('\n=== Testing Authentication Endpoints ===');
    
    // Test 1: Invalid login
    try {
      const result = await this.makeRequest('/auth/login', {
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'wrongpassword'
        }
      });
      
      console.log('✓ Login Test (Invalid Credentials):');
      console.log(`  Status: ${result.status}`);
      console.log(`  Response Time: ${result.responseTime}ms`);
      console.log(`  CORS Headers: ${result.headers['access-control-allow-origin'] ? 'Present' : 'Missing'}`);
      console.log(`  Response: ${JSON.stringify(result.data, null, 2)}`);
      
      this.results.push({
        test: 'Invalid Login',
        status: result.status,
        success: [401, 422].includes(result.status),
        responseTime: result.responseTime,
        corsHeaders: !!result.headers['access-control-allow-origin']
      });
      
    } catch (error) {
      console.log('✗ Login Test Failed:', error.error);
      this.results.push({
        test: 'Invalid Login',
        status: 0,
        success: false,
        error: error.error,
        responseTime: error.responseTime
      });
    }

    // Test 2: Check email endpoint
    try {
      const result = await this.makeRequest('/auth/check-email', {
        method: 'POST',
        body: {
          email: 'test@example.com'
        }
      });
      
      console.log('\n✓ Email Check Test:');
      console.log(`  Status: ${result.status}`);
      console.log(`  Response Time: ${result.responseTime}ms`);
      console.log(`  CORS Headers: ${result.headers['access-control-allow-origin'] ? 'Present' : 'Missing'}`);
      console.log(`  Response: ${JSON.stringify(result.data, null, 2)}`);
      
      this.results.push({
        test: 'Email Check',
        status: result.status,
        success: result.status === 200,
        responseTime: result.responseTime,
        corsHeaders: !!result.headers['access-control-allow-origin']
      });
      
    } catch (error) {
      console.log('✗ Email Check Test Failed:', error.error);
      this.results.push({
        test: 'Email Check',
        status: 0,
        success: false,
        error: error.error,
        responseTime: error.responseTime
      });
    }

    // Test 3: Check CPF endpoint
    try {
      const result = await this.makeRequest('/auth/check-cpf', {
        method: 'POST',
        body: {
          cpf: '12345678901'
        }
      });
      
      console.log('\n✓ CPF Check Test:');
      console.log(`  Status: ${result.status}`);
      console.log(`  Response Time: ${result.responseTime}ms`);
      console.log(`  CORS Headers: ${result.headers['access-control-allow-origin'] ? 'Present' : 'Missing'}`);
      console.log(`  Response: ${JSON.stringify(result.data, null, 2)}`);
      
      this.results.push({
        test: 'CPF Check',
        status: result.status,
        success: result.status === 200,
        responseTime: result.responseTime,
        corsHeaders: !!result.headers['access-control-allow-origin']
      });
      
    } catch (error) {
      console.log('✗ CPF Check Test Failed:', error.error);
      this.results.push({
        test: 'CPF Check',
        status: 0,
        success: false,
        error: error.error,
        responseTime: error.responseTime
      });
    }
  }

  async testCORS() {
    console.log('\n=== Testing CORS Configuration ===');
    
    // Test CORS preflight
    try {
      const result = await this.makeRequest('/auth/login', {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization'
        }
      });
      
      console.log('✓ CORS Preflight Test:');
      console.log(`  Status: ${result.status}`);
      console.log(`  Response Time: ${result.responseTime}ms`);
      console.log(`  Access-Control-Allow-Origin: ${result.headers['access-control-allow-origin'] || 'Missing'}`);
      console.log(`  Access-Control-Allow-Methods: ${result.headers['access-control-allow-methods'] || 'Missing'}`);
      console.log(`  Access-Control-Allow-Headers: ${result.headers['access-control-allow-headers'] || 'Missing'}`);
      console.log(`  Access-Control-Allow-Credentials: ${result.headers['access-control-allow-credentials'] || 'Missing'}`);
      
      this.results.push({
        test: 'CORS Preflight',
        status: result.status,
        success: [200, 204].includes(result.status),
        responseTime: result.responseTime,
        corsHeaders: !!result.headers['access-control-allow-origin'],
        corsDetails: {
          origin: result.headers['access-control-allow-origin'],
          methods: result.headers['access-control-allow-methods'],
          headers: result.headers['access-control-allow-headers'],
          credentials: result.headers['access-control-allow-credentials']
        }
      });
      
    } catch (error) {
      console.log('✗ CORS Preflight Test Failed:', error.error);
      this.results.push({
        test: 'CORS Preflight',
        status: 0,
        success: false,
        error: error.error,
        responseTime: error.responseTime
      });
    }
  }

  async testHealthEndpoints() {
    console.log('\n=== Testing Health Endpoints ===');
    
    const healthEndpoints = ['/health', '/status', '/metrics'];
    
    for (const endpoint of healthEndpoints) {
      try {
        const result = await this.makeRequest(endpoint);
        
        console.log(`✓ ${endpoint} Test:`);
        console.log(`  Status: ${result.status}`);
        console.log(`  Response Time: ${result.responseTime}ms`);
        console.log(`  CORS Headers: ${result.headers['access-control-allow-origin'] ? 'Present' : 'Missing'}`);
        
        this.results.push({
          test: `Health ${endpoint}`,
          status: result.status,
          success: result.status === 200,
          responseTime: result.responseTime,
          corsHeaders: !!result.headers['access-control-allow-origin']
        });
        
      } catch (error) {
        console.log(`✗ ${endpoint} Test Failed:`, error.error);
        this.results.push({
          test: `Health ${endpoint}`,
          status: 0,
          success: false,
          error: error.error,
          responseTime: error.responseTime
        });
      }
    }
  }

  async testProtectedEndpoints() {
    console.log('\n=== Testing Protected Endpoints ===');
    
    const protectedEndpoints = [
      '/user',
      '/gamification/progress',
      '/documents',
      '/profile'
    ];
    
    for (const endpoint of protectedEndpoints) {
      try {
        const result = await this.makeRequest(endpoint);
        
        console.log(`✓ ${endpoint} Test (Unauthorized):`);
        console.log(`  Status: ${result.status}`);
        console.log(`  Response Time: ${result.responseTime}ms`);
        console.log(`  CORS Headers: ${result.headers['access-control-allow-origin'] ? 'Present' : 'Missing'}`);
        console.log(`  Expected: 401/403, Got: ${result.status}`);
        
        this.results.push({
          test: `Protected ${endpoint}`,
          status: result.status,
          success: [401, 403].includes(result.status),
          responseTime: result.responseTime,
          corsHeaders: !!result.headers['access-control-allow-origin']
        });
        
      } catch (error) {
        console.log(`✗ ${endpoint} Test Failed:`, error.error);
        this.results.push({
          test: `Protected ${endpoint}`,
          status: 0,
          success: false,
          error: error.error,
          responseTime: error.responseTime
        });
      }
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Live API Integration Tests');
    console.log(`Frontend URL: ${FRONTEND_URL}`);
    console.log(`Backend API URL: ${API_BASE_URL}`);
    
    await this.testHealthEndpoints();
    await this.testAuthentication();
    await this.testCORS();
    await this.testProtectedEndpoints();
    
    return this.generateReport();
  }

  generateReport() {
    const totalTests = this.results.length;
    const successfulTests = this.results.filter(r => r.success).length;
    const avgResponseTime = this.results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / totalTests;
    const corsSupport = this.results.filter(r => r.corsHeaders).length;
    
    const report = `
# Live API Integration Test Report

**Generated:** ${new Date().toISOString()}
**Total Tests:** ${totalTests}
**Successful:** ${successfulTests}
**Failed:** ${totalTests - successfulTests}
**Success Rate:** ${((successfulTests / totalTests) * 100).toFixed(1)}%
**Average Response Time:** ${avgResponseTime.toFixed(2)}ms
**CORS Support:** ${corsSupport}/${totalTests} endpoints

## Test Results Summary

${this.results.map(result => `
### ${result.test}
- **Status:** ${result.status} ${result.success ? '✅' : '❌'}
- **Response Time:** ${result.responseTime || 'N/A'}ms
- **CORS Headers:** ${result.corsHeaders ? 'Present' : 'Missing'}
${result.error ? `- **Error:** ${result.error}` : ''}
${result.corsDetails ? `- **CORS Details:** ${JSON.stringify(result.corsDetails, null, 2)}` : ''}
`).join('\n')}

## Analysis

### Connectivity
${totalTests > 0 ? '✅ Backend is accessible' : '❌ Backend connectivity issues'}

### CORS Configuration
${corsSupport > 0 ? `✅ CORS headers present on ${corsSupport}/${totalTests} endpoints` : '❌ No CORS headers detected'}

### Authentication
${this.results.some(r => r.test.includes('Login') && r.success) ? '✅ Authentication endpoints working' : '⚠️ Authentication needs verification'}

### Security
${this.results.some(r => r.test.includes('Protected') && r.success) ? '✅ Protected endpoints properly secured' : '⚠️ Protected endpoints need verification'}

## Recommendations

${successfulTests === totalTests ? 
  '✅ All tests passed - API integration is working correctly' : 
  `⚠️  ${totalTests - successfulTests} tests failed - review specific endpoint issues above`}

${corsSupport < totalTests ? 
  '⚠️  Some endpoints missing CORS headers - verify CORS middleware configuration' : 
  '✅ CORS configuration appears correct'}

${avgResponseTime > 1000 ? 
  `⚠️  Average response time is high (${avgResponseTime.toFixed(2)}ms) - consider performance optimization` : 
  '✅ Response times are acceptable'}
`;

    console.log('\n' + '='.repeat(60));
    console.log(report);
    
    return {
      summary: {
        totalTests,
        successfulTests,
        failedTests: totalTests - successfulTests,
        successRate: (successfulTests / totalTests) * 100,
        avgResponseTime,
        corsSupport
      },
      results: this.results,
      report
    };
  }
}

// Run the tests
async function main() {
  const tester = new LiveApiTester();
  const results = await tester.runAllTests();
  
  // Write results to file
  const fs = require('fs');
  const path = require('path');
  
  try {
    const reportPath = path.join(__dirname, 'live-api-test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Results saved to: ${reportPath}`);
  } catch (error) {
    console.log('Could not save results file:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { LiveApiTester };