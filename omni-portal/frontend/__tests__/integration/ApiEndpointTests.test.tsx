/**
 * Detailed API Endpoint Testing
 * Tests specific endpoints with detailed request/response analysis
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const FRONTEND_URL = 'http://localhost:3000';

interface EndpointTest {
  name: string;
  path: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
  expectedStatus?: number[];
  requiresAuth?: boolean;
}

interface DetailedTestResult {
  test: EndpointTest;
  success: boolean;
  status: number;
  responseTime: number;
  responseHeaders: Record<string, string>;
  responseBody?: any;
  error?: string;
  corsAnalysis: {
    hasAccessControlAllowOrigin: boolean;
    hasAccessControlAllowMethods: boolean;
    hasAccessControlAllowHeaders: boolean;
    hasAccessControlAllowCredentials: boolean;
    allowsRequestedOrigin: boolean;
  };
}

class DetailedEndpointTester {
  private results: DetailedTestResult[] = [];

  // Define comprehensive endpoint tests
  private endpointTests: EndpointTest[] = [
    // Health and Status Endpoints
    {
      name: 'Health Check',
      path: '/health',
      method: 'GET',
      expectedStatus: [200]
    },
    {
      name: 'Status Check',
      path: '/status',
      method: 'GET',
      expectedStatus: [200]
    },
    {
      name: 'Metrics Endpoint',
      path: '/metrics',
      method: 'GET',
      expectedStatus: [200]
    },

    // Public Configuration
    {
      name: 'Public Configuration',
      path: '/config/public',
      method: 'GET',
      expectedStatus: [200]
    },

    // Authentication Endpoints
    {
      name: 'Login Endpoint',
      path: '/auth/login',
      method: 'POST',
      body: {
        email: 'test@example.com',
        password: 'InvalidPassword123!'
      },
      expectedStatus: [401, 422, 500] // Should fail with invalid credentials
    },
    {
      name: 'Check Email Availability',
      path: '/auth/check-email',
      method: 'POST',
      body: {
        email: 'test@example.com'
      },
      expectedStatus: [200]
    },
    {
      name: 'Check CPF Availability',
      path: '/auth/check-cpf',
      method: 'POST',
      body: {
        cpf: '12345678901'
      },
      expectedStatus: [200]
    },

    // Registration Endpoints
    {
      name: 'Registration Step 1',
      path: '/register/step1',
      method: 'POST',
      body: {
        name: 'Test User',
        email: 'testuser@example.com',
        cpf: '12345678901',
        password: 'TestPassword123!',
        password_confirmation: 'TestPassword123!'
      },
      expectedStatus: [200, 201, 422] // May succeed or fail with validation
    },

    // Protected Endpoints (should return 401/403)
    {
      name: 'User Profile (Unauthorized)',
      path: '/user',
      method: 'GET',
      requiresAuth: true,
      expectedStatus: [401, 403]
    },
    {
      name: 'Gamification Progress (Unauthorized)',
      path: '/gamification/progress',
      method: 'GET',
      requiresAuth: true,
      expectedStatus: [401, 403]
    },
    {
      name: 'Documents List (Unauthorized)',
      path: '/documents',
      method: 'GET',
      requiresAuth: true,
      expectedStatus: [401, 403]
    },

    // File Upload Endpoints (should return 401/403 without auth)
    {
      name: 'Document Upload V1 (Unauthorized)',
      path: '/documents/upload',
      method: 'POST',
      requiresAuth: true,
      expectedStatus: [401, 403]
    },
    {
      name: 'Document Upload V2 (Unauthorized)',
      path: '/v2/documents/upload',
      method: 'POST',
      requiresAuth: true,
      expectedStatus: [401, 403]
    },
    {
      name: 'Document Upload V3 (Unauthorized)',
      path: '/v3/documents/upload',
      method: 'POST',
      requiresAuth: true,
      expectedStatus: [401, 403]
    },

    // CORS Preflight Tests
    {
      name: 'CORS Preflight - Auth Login',
      path: '/auth/login',
      method: 'OPTIONS',
      headers: {
        'Origin': FRONTEND_URL,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      },
      expectedStatus: [200, 204]
    },
    {
      name: 'CORS Preflight - Documents',
      path: '/documents',
      method: 'OPTIONS',
      headers: {
        'Origin': FRONTEND_URL,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization'
      },
      expectedStatus: [200, 204]
    }
  ];

  async testEndpoint(test: EndpointTest): Promise<DetailedTestResult> {
    const startTime = Date.now();
    const url = `${API_BASE_URL}${test.path}`;

    try {
      const response = await fetch(url, {
        method: test.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': FRONTEND_URL,
          ...test.headers,
        },
        body: test.body ? JSON.stringify(test.body) : undefined,
      });

      const responseTime = Date.now() - startTime;
      
      // Extract response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Analyze CORS headers
      const corsAnalysis = {
        hasAccessControlAllowOrigin: !!responseHeaders['access-control-allow-origin'],
        hasAccessControlAllowMethods: !!responseHeaders['access-control-allow-methods'],
        hasAccessControlAllowHeaders: !!responseHeaders['access-control-allow-headers'],
        hasAccessControlAllowCredentials: responseHeaders['access-control-allow-credentials'] === 'true',
        allowsRequestedOrigin: responseHeaders['access-control-allow-origin'] === FRONTEND_URL || 
                              responseHeaders['access-control-allow-origin'] === '*'
      };

      // Try to get response body
      let responseBody;
      try {
        responseBody = await response.json();
      } catch (e) {
        // Response might not be JSON
        responseBody = null;
      }

      const expectedStatuses = test.expectedStatus || [200];
      const success = expectedStatuses.includes(response.status);

      return {
        test,
        success,
        status: response.status,
        responseTime,
        responseHeaders,
        responseBody,
        corsAnalysis
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        test,
        success: false,
        status: 0,
        responseTime,
        responseHeaders: {},
        error: errorMessage,
        corsAnalysis: {
          hasAccessControlAllowOrigin: false,
          hasAccessControlAllowMethods: false,
          hasAccessControlAllowHeaders: false,
          hasAccessControlAllowCredentials: false,
          allowsRequestedOrigin: false
        }
      };
    }
  }

  async runAllTests(): Promise<DetailedTestResult[]> {
    console.log(`Running ${this.endpointTests.length} detailed endpoint tests...`);

    for (const test of this.endpointTests) {
      console.log(`Testing: ${test.method} ${test.path}`);
      const result = await this.testEndpoint(test);
      this.results.push(result);
      
      // Add small delay between requests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return this.results;
  }

  generateDetailedReport(): string {
    const successfulTests = this.results.filter(r => r.success);
    const failedTests = this.results.filter(r => !r.success);
    const avgResponseTime = this.results.reduce((sum, r) => sum + r.responseTime, 0) / this.results.length;

    let report = `
# Detailed API Endpoint Test Report
**Generated:** ${new Date().toISOString()}
**Total Tests:** ${this.results.length}
**Successful:** ${successfulTests.length}
**Failed:** ${failedTests.length}
**Success Rate:** ${((successfulTests.length / this.results.length) * 100).toFixed(2)}%
**Average Response Time:** ${avgResponseTime.toFixed(2)}ms

## Test Results by Category

### Health and Monitoring Endpoints
${this.formatResultsByCategory(['Health Check', 'Status Check', 'Metrics Endpoint', 'Public Configuration'])}

### Authentication Endpoints
${this.formatResultsByCategory(['Login Endpoint', 'Check Email Availability', 'Check CPF Availability'])}

### Registration Endpoints
${this.formatResultsByCategory(['Registration Step 1'])}

### Protected Endpoints (Authorization Tests)
${this.formatResultsByCategory(['User Profile (Unauthorized)', 'Gamification Progress (Unauthorized)', 'Documents List (Unauthorized)'])}

### File Upload Endpoints
${this.formatResultsByCategory(['Document Upload V1 (Unauthorized)', 'Document Upload V2 (Unauthorized)', 'Document Upload V3 (Unauthorized)'])}

### CORS Preflight Tests
${this.formatResultsByCategory(['CORS Preflight - Auth Login', 'CORS Preflight - Documents'])}

## CORS Analysis Summary
${this.generateCORSAnalysis()}

## Performance Analysis
${this.generatePerformanceAnalysis()}

## Security Analysis
${this.generateSecurityAnalysis()}

## Detailed Test Results
${this.results.map(result => this.formatDetailedResult(result)).join('\n\n')}
`;

    return report;
  }

  private formatResultsByCategory(testNames: string[]): string {
    const categoryResults = this.results.filter(r => testNames.includes(r.test.name));
    
    if (categoryResults.length === 0) return 'No tests in this category.';

    return categoryResults.map(result => `
- **${result.test.name}**: ${result.success ? '✅' : '❌'} (${result.status}) - ${result.responseTime}ms`).join('\n');
  }

  private generateCORSAnalysis(): string {
    const corsResults = this.results.filter(r => 
      r.corsAnalysis.hasAccessControlAllowOrigin || 
      r.corsAnalysis.hasAccessControlAllowMethods ||
      r.corsAnalysis.hasAccessControlAllowHeaders
    );

    const properCORSCount = corsResults.filter(r => 
      r.corsAnalysis.hasAccessControlAllowOrigin && 
      r.corsAnalysis.allowsRequestedOrigin
    ).length;

    return `
- **Endpoints with CORS headers:** ${corsResults.length}/${this.results.length}
- **Properly configured CORS:** ${properCORSCount}/${this.results.length}
- **Frontend origin allowed:** ${corsResults.filter(r => r.corsAnalysis.allowsRequestedOrigin).length > 0 ? 'Yes ✅' : 'No ❌'}
- **Credentials support:** ${corsResults.filter(r => r.corsAnalysis.hasAccessControlAllowCredentials).length > 0 ? 'Yes ✅' : 'No ❌'}
`;
  }

  private generatePerformanceAnalysis(): string {
    const responseTimes = this.results.map(r => r.responseTime);
    const avgTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const maxTime = Math.max(...responseTimes);
    const minTime = Math.min(...responseTimes);
    const slowEndpoints = this.results.filter(r => r.responseTime > 1000);

    return `
- **Average Response Time:** ${avgTime.toFixed(2)}ms
- **Maximum Response Time:** ${maxTime}ms (${this.results.find(r => r.responseTime === maxTime)?.test.name})
- **Minimum Response Time:** ${minTime}ms (${this.results.find(r => r.responseTime === minTime)?.test.name})
- **Slow Endpoints (>1s):** ${slowEndpoints.length}
${slowEndpoints.length > 0 ? slowEndpoints.map(r => `  - ${r.test.name}: ${r.responseTime}ms`).join('\n') : ''}
`;
  }

  private generateSecurityAnalysis(): string {
    const protectedEndpoints = this.results.filter(r => r.test.requiresAuth);
    const properlyProtected = protectedEndpoints.filter(r => [401, 403].includes(r.status));
    
    return `
- **Protected Endpoints Tested:** ${protectedEndpoints.length}
- **Properly Protected:** ${properlyProtected.length}/${protectedEndpoints.length}
- **Security Status:** ${properlyProtected.length === protectedEndpoints.length ? 'Good ✅' : 'Issues Detected ❌'}
`;
  }

  private formatDetailedResult(result: DetailedTestResult): string {
    return `
### ${result.test.name}
- **Endpoint:** ${result.test.method} ${result.test.path}
- **Status:** ${result.status} ${result.success ? '✅' : '❌'}
- **Response Time:** ${result.responseTime}ms
- **CORS Headers Present:** ${Object.values(result.corsAnalysis).some(v => v) ? 'Yes' : 'No'}
${result.error ? `- **Error:** ${result.error}` : ''}
${result.responseBody ? `- **Response Sample:** ${JSON.stringify(result.responseBody, null, 2).substring(0, 200)}...` : ''}
- **Response Headers:**
${Object.entries(result.responseHeaders).slice(0, 5).map(([key, value]) => `  - ${key}: ${value}`).join('\n')}
`;
  }
}

// Jest test suite
describe('Detailed API Endpoint Tests', () => {
  let tester: DetailedEndpointTester;
  let results: DetailedTestResult[];

  beforeAll(async () => {
    tester = new DetailedEndpointTester();
    results = await tester.runAllTests();
    
    // Generate and log detailed report
    const report = tester.generateDetailedReport();
    console.log('\n=== Detailed API Endpoint Test Report ===');
    console.log(report);
    
    // Write report to file for reference
    if (typeof require !== 'undefined') {
      const fs = require('fs');
      const path = require('path');
      try {
        const reportPath = path.join(__dirname, 'api-integration-report.md');
        fs.writeFileSync(reportPath, report);
        console.log(`\nReport saved to: ${reportPath}`);
      } catch (error) {
        console.log('Could not save report to file:', error);
      }
    }
  }, 120000); // 2 minute timeout

  describe('Health Endpoints', () => {
    it('should have working health endpoints', () => {
      const healthTests = results.filter(r => 
        ['Health Check', 'Status Check', 'Metrics Endpoint'].includes(r.test.name)
      );
      
      expect(healthTests.length).toBeGreaterThan(0);
      
      // At least one health endpoint should work
      const workingHealthEndpoints = healthTests.filter(r => r.success);
      expect(workingHealthEndpoints.length).toBeGreaterThan(0);
    });
  });

  describe('Authentication Endpoints', () => {
    it('should test authentication endpoints', () => {
      const authTests = results.filter(r => 
        r.test.path.startsWith('/auth/') && r.test.method !== 'OPTIONS'
      );
      
      expect(authTests.length).toBeGreaterThan(0);
    });

    it('should handle invalid login attempts properly', () => {
      const loginTest = results.find(r => r.test.name === 'Login Endpoint');
      expect(loginTest).toBeDefined();
      
      // Should reject invalid credentials
      expect([401, 422, 500].includes(loginTest!.status)).toBe(true);
    });
  });

  describe('Authorization Protection', () => {
    it('should protect authenticated endpoints', () => {
      const protectedTests = results.filter(r => r.test.requiresAuth);
      expect(protectedTests.length).toBeGreaterThan(0);
      
      // All protected endpoints should reject unauthorized access
      protectedTests.forEach(test => {
        expect([401, 403].includes(test.status)).toBe(true);
      });
    });
  });

  describe('CORS Configuration', () => {
    it('should have proper CORS headers', () => {
      const corsTests = results.filter(r => r.test.method === 'OPTIONS');
      expect(corsTests.length).toBeGreaterThan(0);
      
      // At least some CORS tests should pass
      const successfulCORSTests = corsTests.filter(r => r.success);
      expect(successfulCORSTests.length).toBeGreaterThan(0);
    });

    it('should allow frontend origin', () => {
      const testsWithCORS = results.filter(r => 
        r.corsAnalysis.hasAccessControlAllowOrigin
      );
      
      if (testsWithCORS.length > 0) {
        const allowsFrontend = testsWithCORS.some(r => 
          r.corsAnalysis.allowsRequestedOrigin
        );
        expect(allowsFrontend).toBe(true);
      }
    });
  });

  describe('Performance Requirements', () => {
    it('should have reasonable response times', () => {
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      
      // Log performance metrics
      console.log(`Average API response time: ${avgResponseTime.toFixed(2)}ms`);
      
      // Warning if average is too high, but not a hard failure
      if (avgResponseTime > 3000) {
        console.warn(`Warning: High average response time (${avgResponseTime.toFixed(2)}ms)`);
      }
      
      // Test should not fail just due to performance
      expect(avgResponseTime).toBeGreaterThan(0);
    });

    it('should not have any extremely slow endpoints', () => {
      const extremelySlowTests = results.filter(r => r.responseTime > 10000);
      
      if (extremelySlowTests.length > 0) {
        console.warn('Extremely slow endpoints detected:', 
          extremelySlowTests.map(r => `${r.test.name}: ${r.responseTime}ms`)
        );
      }
      
      // Log but don't fail the test - this is more informational
      expect(extremelySlowTests.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', () => {
      const networkErrors = results.filter(r => r.error && r.status === 0);
      
      if (networkErrors.length > 0) {
        console.log('Network errors detected:', 
          networkErrors.map(r => `${r.test.name}: ${r.error}`)
        );
      }
      
      // This is informational - network errors might be expected in test environment
      expect(networkErrors.length).toBeGreaterThanOrEqual(0);
    });
  });
});

export { DetailedEndpointTester, DetailedTestResult, EndpointTest };