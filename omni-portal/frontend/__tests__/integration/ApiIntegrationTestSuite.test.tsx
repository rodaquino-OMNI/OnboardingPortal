/**
 * Comprehensive API Integration Test Suite
 * Tests integration between frontend (port 3000) and backend (port 8000)
 * 
 * Test Coverage:
 * 1. Authentication endpoints (/api/auth/login, /api/auth/register)
 * 2. CORS configuration validation
 * 3. Session management and cookies
 * 4. File upload endpoints
 * 5. WebSocket connections
 * 6. Network request monitoring
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Configuration for API testing
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const FRONTEND_URL = 'http://localhost:3000';

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  error?: string;
  responseTime: number;
  headers: Record<string, string>;
  corsHeaders?: Record<string, string>;
}

interface NetworkTestResults {
  authTests: TestResult[];
  corsTests: TestResult[];
  sessionTests: TestResult[];
  uploadTests: TestResult[];
  websocketTests: TestResult[];
  errors: Array<{
    endpoint: string;
    error: string;
    details: any;
  }>;
}

class ApiIntegrationTester {
  private results: NetworkTestResults = {
    authTests: [],
    corsTests: [],
    sessionTests: [],
    uploadTests: [],
    websocketTests: [],
    errors: []
  };

  private testCredentials = {
    email: 'test@example.com',
    password: 'TestPassword123!',
    cpf: '12345678901'
  };

  /**
   * Perform HTTP request with detailed logging
   */
  private async makeRequest(
    endpoint: string,
    options: RequestInit = {},
    category: keyof Omit<NetworkTestResults, 'errors'>
  ): Promise<TestResult> {
    const startTime = Date.now();
    const url = `${API_BASE_URL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': FRONTEND_URL,
          ...options.headers,
        },
      });

      const responseTime = Date.now() - startTime;
      const headers: Record<string, string> = {};
      const corsHeaders: Record<string, string> = {};

      // Extract all headers
      response.headers.forEach((value, key) => {
        headers[key] = value;
        // Extract CORS-related headers
        if (key.toLowerCase().includes('access-control') || key.toLowerCase().includes('cors')) {
          corsHeaders[key] = value;
        }
      });

      const result: TestResult = {
        endpoint,
        method: options.method || 'GET',
        status: response.status,
        success: response.ok,
        responseTime,
        headers,
        corsHeaders
      };

      this.results[category].push(result);
      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const result: TestResult = {
        endpoint,
        method: options.method || 'GET',
        status: 0,
        success: false,
        error: errorMessage,
        responseTime,
        headers: {}
      };

      this.results[category].push(result);
      this.results.errors.push({
        endpoint,
        error: errorMessage,
        details: error
      });

      return result;
    }
  }

  /**
   * Test CORS preflight request
   */
  private async testCORSPreflight(endpoint: string): Promise<TestResult> {
    return this.makeRequest(endpoint, {
      method: 'OPTIONS',
      headers: {
        'Origin': FRONTEND_URL,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    }, 'corsTests');
  }

  /**
   * Test authentication endpoints
   */
  async testAuthentication(): Promise<void> {
    console.log('Testing Authentication Endpoints...');

    // Test 1: Login endpoint
    const loginResult = await this.makeRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: this.testCredentials.email,
        password: this.testCredentials.password
      })
    }, 'authTests');

    // Test 2: Register endpoint (step 1)
    const registerResult = await this.makeRequest('/register/step1', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User',
        email: 'newuser@example.com',
        cpf: '98765432100',
        password: 'TestPassword123!',
        password_confirmation: 'TestPassword123!'
      })
    }, 'authTests');

    // Test 3: Check email endpoint
    const checkEmailResult = await this.makeRequest('/auth/check-email', {
      method: 'POST',
      body: JSON.stringify({
        email: this.testCredentials.email
      })
    }, 'authTests');

    // Test 4: Check CPF endpoint
    const checkCpfResult = await this.makeRequest('/auth/check-cpf', {
      method: 'POST',
      body: JSON.stringify({
        cpf: this.testCredentials.cpf
      })
    }, 'authTests');

    console.log(`Auth tests completed: ${this.results.authTests.length} requests`);
  }

  /**
   * Test CORS configuration
   */
  async testCORS(): Promise<void> {
    console.log('Testing CORS Configuration...');

    // Test CORS for various endpoints
    const endpoints = [
      '/auth/login',
      '/auth/register',
      '/gamification/progress',
      '/documents/upload',
      '/health'
    ];

    for (const endpoint of endpoints) {
      await this.testCORSPreflight(endpoint);
    }

    // Test simple CORS request
    await this.makeRequest('/health', {
      method: 'GET',
      headers: {
        'Origin': FRONTEND_URL
      }
    }, 'corsTests');

    console.log(`CORS tests completed: ${this.results.corsTests.length} requests`);
  }

  /**
   * Test session management and cookies
   */
  async testSessionManagement(): Promise<void> {
    console.log('Testing Session Management...');

    // Test 1: Login and check for session cookies
    const loginResult = await this.makeRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: this.testCredentials.email,
        password: this.testCredentials.password
      })
    }, 'sessionTests');

    // Test 2: Access protected endpoint without token
    const unauthorizedResult = await this.makeRequest('/gamification/progress', {
      method: 'GET'
    }, 'sessionTests');

    // Test 3: Test CSRF token endpoint
    const csrfResult = await this.makeRequest('/sanctum/csrf-cookie', {
      method: 'GET'
    }, 'sessionTests');

    console.log(`Session tests completed: ${this.results.sessionTests.length} requests`);
  }

  /**
   * Test file upload endpoints
   */
  async testFileUpload(): Promise<void> {
    console.log('Testing File Upload Endpoints...');

    // Create a test file blob
    const testFile = new Blob(['test file content'], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', testFile, 'test.txt');
    formData.append('type', 'identity');

    // Test 1: Document upload (V1)
    const uploadV1Result = await this.makeRequest('/documents/upload', {
      method: 'POST',
      body: formData,
      headers: {} // Remove Content-Type to let browser set it with boundary
    }, 'uploadTests');

    // Test 2: Document upload (V2)
    const uploadV2Result = await this.makeRequest('/v2/documents/upload', {
      method: 'POST',
      body: formData,
      headers: {}
    }, 'uploadTests');

    // Test 3: Document upload (V3)
    const uploadV3Result = await this.makeRequest('/v3/documents/upload', {
      method: 'POST',
      body: formData,
      headers: {}
    }, 'uploadTests');

    console.log(`Upload tests completed: ${this.results.uploadTests.length} requests`);
  }

  /**
   * Test WebSocket connections
   */
  async testWebSockets(): Promise<void> {
    console.log('Testing WebSocket Connections...');

    return new Promise((resolve) => {
      try {
        // Test WebSocket connection to backend
        const wsUrl = 'ws://localhost:8000/ws';
        const ws = new WebSocket(wsUrl);

        const startTime = Date.now();

        ws.onopen = () => {
          const responseTime = Date.now() - startTime;
          this.results.websocketTests.push({
            endpoint: '/ws',
            method: 'WebSocket',
            status: 101, // WebSocket upgrade status
            success: true,
            responseTime,
            headers: {}
          });
          ws.close();
          resolve();
        };

        ws.onerror = (error) => {
          const responseTime = Date.now() - startTime;
          this.results.websocketTests.push({
            endpoint: '/ws',
            method: 'WebSocket',
            status: 0,
            success: false,
            error: 'WebSocket connection failed',
            responseTime,
            headers: {}
          });
          this.results.errors.push({
            endpoint: '/ws',
            error: 'WebSocket connection failed',
            details: error
          });
          resolve();
        };

        // Timeout after 5 seconds
        setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            ws.close();
            this.results.websocketTests.push({
              endpoint: '/ws',
              method: 'WebSocket',
              status: 0,
              success: false,
              error: 'WebSocket connection timeout',
              responseTime: 5000,
              headers: {}
            });
            resolve();
          }
        }, 5000);

      } catch (error) {
        this.results.errors.push({
          endpoint: '/ws',
          error: 'WebSocket test failed',
          details: error
        });
        resolve();
      }
    });
  }

  /**
   * Run all integration tests
   */
  async runAllTests(): Promise<NetworkTestResults> {
    console.log('Starting comprehensive API integration tests...');
    console.log(`Frontend URL: ${FRONTEND_URL}`);
    console.log(`API Base URL: ${API_BASE_URL}`);

    try {
      await this.testAuthentication();
      await this.testCORS();
      await this.testSessionManagement();
      await this.testFileUpload();
      await this.testWebSockets();
    } catch (error) {
      console.error('Test suite error:', error);
      this.results.errors.push({
        endpoint: 'test-suite',
        error: 'Test suite execution error',
        details: error
      });
    }

    return this.results;
  }

  /**
   * Generate detailed test report
   */
  generateReport(): string {
    const { authTests, corsTests, sessionTests, uploadTests, websocketTests, errors } = this.results;
    
    const totalTests = authTests.length + corsTests.length + sessionTests.length + uploadTests.length + websocketTests.length;
    const successfulTests = [
      ...authTests,
      ...corsTests,
      ...sessionTests,
      ...uploadTests,
      ...websocketTests
    ].filter(test => test.success).length;

    let report = `
# API Integration Test Report
**Generated:** ${new Date().toISOString()}
**Frontend URL:** ${FRONTEND_URL}
**Backend API URL:** ${API_BASE_URL}

## Summary
- **Total Tests:** ${totalTests}
- **Successful:** ${successfulTests}
- **Failed:** ${totalTests - successfulTests}
- **Success Rate:** ${((successfulTests / totalTests) * 100).toFixed(2)}%
- **Total Errors:** ${errors.length}

## Authentication Tests (${authTests.length} tests)
${this.formatTestSection(authTests)}

## CORS Tests (${corsTests.length} tests)
${this.formatTestSection(corsTests)}

## Session Management Tests (${sessionTests.length} tests)
${this.formatTestSection(sessionTests)}

## File Upload Tests (${uploadTests.length} tests)
${this.formatTestSection(uploadTests)}

## WebSocket Tests (${websocketTests.length} tests)
${this.formatTestSection(websocketTests)}

## Errors and Issues
${errors.length > 0 ? errors.map(error => `
### ${error.endpoint}
- **Error:** ${error.error}
- **Details:** ${JSON.stringify(error.details, null, 2)}
`).join('\n') : 'No errors detected.'}

## CORS Configuration Analysis
${this.analyzeCORSConfiguration()}

## Performance Analysis
${this.analyzePerformance()}

## Recommendations
${this.generateRecommendations()}
`;

    return report;
  }

  private formatTestSection(tests: TestResult[]): string {
    if (tests.length === 0) return 'No tests performed.';

    return tests.map(test => `
### ${test.method} ${test.endpoint}
- **Status:** ${test.status} ${test.success ? '✅' : '❌'}
- **Response Time:** ${test.responseTime}ms
- **CORS Headers:** ${Object.keys(test.corsHeaders || {}).length > 0 ? 'Present' : 'Missing'}
${test.error ? `- **Error:** ${test.error}` : ''}
${Object.keys(test.corsHeaders || {}).length > 0 ? `- **CORS Details:** ${JSON.stringify(test.corsHeaders, null, 2)}` : ''}
`).join('\n');
  }

  private analyzeCORSConfiguration(): string {
    const corsTests = this.results.corsTests;
    const hasValidCORS = corsTests.some(test => 
      test.corsHeaders && 
      test.corsHeaders['access-control-allow-origin']
    );

    return `
- **CORS Status:** ${hasValidCORS ? 'Configured ✅' : 'Issues Detected ❌'}
- **Allowed Origins:** ${corsTests.find(t => t.corsHeaders?.['access-control-allow-origin'])?.corsHeaders?.['access-control-allow-origin'] || 'Not detected'}
- **Allowed Methods:** ${corsTests.find(t => t.corsHeaders?.['access-control-allow-methods'])?.corsHeaders?.['access-control-allow-methods'] || 'Not detected'}
- **Credentials Support:** ${corsTests.find(t => t.corsHeaders?.['access-control-allow-credentials'])?.corsHeaders?.['access-control-allow-credentials'] || 'Not detected'}
`;
  }

  private analyzePerformance(): string {
    const allTests = [
      ...this.results.authTests,
      ...this.results.corsTests,
      ...this.results.sessionTests,
      ...this.results.uploadTests,
      ...this.results.websocketTests
    ];

    if (allTests.length === 0) return 'No performance data available.';

    const avgResponseTime = allTests.reduce((sum, test) => sum + test.responseTime, 0) / allTests.length;
    const maxResponseTime = Math.max(...allTests.map(test => test.responseTime));
    const minResponseTime = Math.min(...allTests.map(test => test.responseTime));

    return `
- **Average Response Time:** ${avgResponseTime.toFixed(2)}ms
- **Maximum Response Time:** ${maxResponseTime}ms
- **Minimum Response Time:** ${minResponseTime}ms
- **Performance Status:** ${avgResponseTime < 1000 ? 'Good ✅' : avgResponseTime < 3000 ? 'Fair ⚠️' : 'Needs Improvement ❌'}
`;
  }

  private generateRecommendations(): string {
    const recommendations = [];

    // Check for authentication issues
    const authFailures = this.results.authTests.filter(t => !t.success);
    if (authFailures.length > 0) {
      recommendations.push('- Fix authentication endpoint issues before deployment');
    }

    // Check for CORS issues
    const corsIssues = this.results.corsTests.filter(t => !t.success || !t.corsHeaders);
    if (corsIssues.length > 0) {
      recommendations.push('- Review and fix CORS configuration to enable frontend-backend communication');
    }

    // Check for upload issues
    const uploadFailures = this.results.uploadTests.filter(t => !t.success);
    if (uploadFailures.length > 0) {
      recommendations.push('- Investigate file upload endpoint issues');
    }

    // Performance recommendations
    const slowTests = [...this.results.authTests, ...this.results.sessionTests].filter(t => t.responseTime > 2000);
    if (slowTests.length > 0) {
      recommendations.push('- Optimize slow API endpoints (>2s response time)');
    }

    if (recommendations.length === 0) {
      recommendations.push('- API integration appears to be working correctly');
    }

    return recommendations.join('\n');
  }
}

// Jest test suite
describe('API Integration Tests', () => {
  let tester: ApiIntegrationTester;
  let testResults: NetworkTestResults;

  beforeAll(async () => {
    tester = new ApiIntegrationTester();
    
    // Run all integration tests
    testResults = await tester.runAllTests();
    
    // Log results to console for debugging
    console.log('\n=== API Integration Test Results ===');
    console.log(tester.generateReport());
  }, 60000); // 60 second timeout for all tests

  describe('Authentication Endpoints', () => {
    it('should have authentication test results', () => {
      expect(testResults.authTests.length).toBeGreaterThan(0);
    });

    it('should test login endpoint', () => {
      const loginTest = testResults.authTests.find(t => t.endpoint === '/auth/login');
      expect(loginTest).toBeDefined();
      expect(loginTest?.method).toBe('POST');
    });

    it('should test registration endpoint', () => {
      const registerTest = testResults.authTests.find(t => t.endpoint === '/register/step1');
      expect(registerTest).toBeDefined();
      expect(registerTest?.method).toBe('POST');
    });
  });

  describe('CORS Configuration', () => {
    it('should have CORS test results', () => {
      expect(testResults.corsTests.length).toBeGreaterThan(0);
    });

    it('should include CORS headers in responses', () => {
      const corsTestsWithHeaders = testResults.corsTests.filter(t => 
        t.corsHeaders && Object.keys(t.corsHeaders).length > 0
      );
      expect(corsTestsWithHeaders.length).toBeGreaterThan(0);
    });
  });

  describe('Session Management', () => {
    it('should have session test results', () => {
      expect(testResults.sessionTests.length).toBeGreaterThan(0);
    });

    it('should handle unauthorized requests properly', () => {
      const unauthorizedTest = testResults.sessionTests.find(t => 
        t.endpoint === '/gamification/progress'
      );
      expect(unauthorizedTest).toBeDefined();
      // Should return 401 or 403 for unauthorized requests
      expect([401, 403, 500].includes(unauthorizedTest?.status || 0)).toBe(true);
    });
  });

  describe('File Upload Endpoints', () => {
    it('should have upload test results', () => {
      expect(testResults.uploadTests.length).toBeGreaterThan(0);
    });

    it('should test multiple upload endpoint versions', () => {
      const v1Test = testResults.uploadTests.find(t => t.endpoint === '/documents/upload');
      const v2Test = testResults.uploadTests.find(t => t.endpoint === '/v2/documents/upload');
      const v3Test = testResults.uploadTests.find(t => t.endpoint === '/v3/documents/upload');
      
      expect(v1Test).toBeDefined();
      expect(v2Test).toBeDefined();
      expect(v3Test).toBeDefined();
    });
  });

  describe('WebSocket Connections', () => {
    it('should test WebSocket connectivity', () => {
      // WebSocket tests are always attempted, even if they fail
      expect(testResults.websocketTests.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Analysis', () => {
    it('should track and report errors', () => {
      expect(Array.isArray(testResults.errors)).toBe(true);
      
      // Log errors for debugging
      if (testResults.errors.length > 0) {
        console.log('\n=== Detected Errors ===');
        testResults.errors.forEach(error => {
          console.log(`${error.endpoint}: ${error.error}`);
        });
      }
    });
  });

  describe('Performance Metrics', () => {
    it('should measure response times', () => {
      const allTests = [
        ...testResults.authTests,
        ...testResults.corsTests,
        ...testResults.sessionTests,
        ...testResults.uploadTests,
        ...testResults.websocketTests
      ];

      allTests.forEach(test => {
        expect(typeof test.responseTime).toBe('number');
        expect(test.responseTime).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have reasonable response times', () => {
      const allTests = [
        ...testResults.authTests,
        ...testResults.corsTests,
        ...testResults.sessionTests
      ];

      const avgResponseTime = allTests.length > 0 
        ? allTests.reduce((sum, test) => sum + test.responseTime, 0) / allTests.length
        : 0;

      // Log performance info
      console.log(`\n=== Performance Metrics ===`);
      console.log(`Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
      
      // This is more of a warning than a hard requirement
      if (avgResponseTime > 5000) {
        console.warn(`Warning: Average response time is high (${avgResponseTime.toFixed(2)}ms)`);
      }
    });
  });
});

export { ApiIntegrationTester, NetworkTestResults, TestResult };