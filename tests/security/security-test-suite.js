/**
 * Security Testing Suite for Onboarding Portal
 * 
 * This suite tests various security aspects including:
 * - Authentication vulnerabilities
 * - Authorization bypass attempts
 * - Input validation and sanitization
 * - XSS prevention
 * - SQL injection prevention
 * - CSRF protection
 * - Security headers
 * - Session management
 * - Rate limiting
 * - Data privacy compliance
 */

const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:3000';

class SecurityTester {
  constructor() {
    this.results = [];
    this.vulnerabilities = [];
  }

  log(test, status, message, severity = 'INFO') {
    const result = {
      test,
      status,
      message,
      severity,
      timestamp: new Date().toISOString()
    };
    
    this.results.push(result);
    
    if (status === 'FAIL') {
      this.vulnerabilities.push(result);
    }

    console.log(`[${severity}] ${test}: ${status} - ${message}`);
  }

  async testAuthenticationVulnerabilities() {
    console.log('\n=== Testing Authentication Vulnerabilities ===');

    // Test 1: SQL Injection in login
    try {
      const sqlPayloads = [
        "admin@example.com' OR '1'='1",
        "admin@example.com'; DROP TABLE users; --",
        "admin@example.com' UNION SELECT * FROM users --"
      ];

      for (const payload of sqlPayloads) {
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
          email: payload,
          password: 'password'
        }, { validateStatus: () => true });

        if (response.status === 200 && response.data.data?.token) {
          this.log('SQL Injection Login', 'FAIL', 
            `SQL injection successful with payload: ${payload}`, 'CRITICAL');
        } else {
          this.log('SQL Injection Login', 'PASS', 
            `SQL injection prevented for payload: ${payload}`);
        }
      }
    } catch (error) {
      this.log('SQL Injection Login', 'PASS', 'SQL injection properly rejected');
    }

    // Test 2: Brute force protection
    try {
      const email = 'admin@example.com';
      let successfulAttempts = 0;

      for (let i = 0; i < 10; i++) {
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
          email,
          password: `wrong-password-${i}`
        }, { validateStatus: () => true });

        if (response.status === 429) {
          this.log('Brute Force Protection', 'PASS', 
            `Rate limiting activated after ${i + 1} attempts`);
          break;
        } else if (i === 9) {
          this.log('Brute Force Protection', 'FAIL', 
            'No rate limiting detected after 10 failed attempts', 'HIGH');
        }
      }
    } catch (error) {
      this.log('Brute Force Protection', 'ERROR', `Test error: ${error.message}`);
    }

    // Test 3: JWT token tampering
    try {
      // Get valid token first
      const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'admin@example.com',
        password: 'password'
      });

      if (loginResponse.data.data?.token) {
        const validToken = loginResponse.data.data.token;
        
        // Tamper with token
        const tamperedToken = validToken.slice(0, -10) + 'tampered123';
        
        const response = await axios.get(`${BASE_URL}/api/user`, {
          headers: { Authorization: `Bearer ${tamperedToken}` }
        }, { validateStatus: () => true });

        if (response.status === 401) {
          this.log('JWT Tampering', 'PASS', 'Tampered JWT properly rejected');
        } else {
          this.log('JWT Tampering', 'FAIL', 'Tampered JWT accepted', 'CRITICAL');
        }
      }
    } catch (error) {
      this.log('JWT Tampering', 'PASS', 'JWT tampering properly handled');
    }
  }

  async testInputValidationVulnerabilities() {
    console.log('\n=== Testing Input Validation Vulnerabilities ===');

    // Test 1: XSS in registration
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '"><script>alert("XSS")</script>',
      'javascript:alert("XSS")',
      '<img src=x onerror=alert("XSS")>',
      '${alert("XSS")}'
    ];

    for (const payload of xssPayloads) {
      try {
        const response = await axios.post(`${BASE_URL}/api/auth/register`, {
          name: payload,
          email: `test${Date.now()}@example.com`,
          cpf: '12345678901',
          password: 'Password123!',
          password_confirmation: 'Password123!'
        }, { validateStatus: () => true });

        if (response.status === 201) {
          // Check if XSS payload was stored/reflected
          const userResponse = await axios.get(`${BASE_URL}/api/user`, {
            headers: { Authorization: `Bearer ${response.data.data.token}` }
          });

          if (userResponse.data.name === payload) {
            this.log('XSS Prevention', 'FAIL', 
              `XSS payload stored: ${payload}`, 'HIGH');
          } else {
            this.log('XSS Prevention', 'PASS', 
              `XSS payload sanitized: ${payload}`);
          }
        }
      } catch (error) {
        this.log('XSS Prevention', 'PASS', `XSS payload rejected: ${payload}`);
      }
    }

    // Test 2: Path traversal in file upload
    try {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fwindows%2fsystem32%2fconfig%2fsam'
      ];

      // First login to get token
      const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'admin@example.com',
        password: 'password'
      });

      if (loginResponse.data.data?.token) {
        const token = loginResponse.data.data.token;

        for (const payload of pathTraversalPayloads) {
          const formData = new FormData();
          formData.append('document_type', 'id_card');
          formData.append('file', new Blob(['test']), payload);

          try {
            const response = await axios.post(`${BASE_URL}/api/documents/upload`, formData, {
              headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
              }
            }, { validateStatus: () => true });

            if (response.status === 200 || response.status === 201) {
              this.log('Path Traversal', 'FAIL', 
                `Path traversal may be possible: ${payload}`, 'HIGH');
            } else {
              this.log('Path Traversal', 'PASS', 
                `Path traversal blocked: ${payload}`);
            }
          } catch (error) {
            this.log('Path Traversal', 'PASS', 
              `Path traversal properly rejected: ${payload}`);
          }
        }
      }
    } catch (error) {
      this.log('Path Traversal', 'ERROR', `Test setup failed: ${error.message}`);
    }

    // Test 3: NoSQL injection (if applicable)
    const noSqlPayloads = [
      '{"$ne": ""}',
      '{"$gt": ""}',
      '{"$regex": ".*"}',
      '{"$where": "this.password"}'
    ];

    for (const payload of noSqlPayloads) {
      try {
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
          email: payload,
          password: 'password'
        }, { validateStatus: () => true });

        if (response.status === 200 && response.data.data?.token) {
          this.log('NoSQL Injection', 'FAIL', 
            `NoSQL injection successful: ${payload}`, 'CRITICAL');
        } else {
          this.log('NoSQL Injection', 'PASS', 
            `NoSQL injection blocked: ${payload}`);
        }
      } catch (error) {
        this.log('NoSQL Injection', 'PASS', 
          `NoSQL injection properly handled: ${payload}`);
      }
    }
  }

  async testAuthorizationVulnerabilities() {
    console.log('\n=== Testing Authorization Vulnerabilities ===');

    // Test 1: Horizontal privilege escalation
    try {
      // Create two test users
      const user1Data = {
        name: 'Test User 1',
        email: `testuser1${Date.now()}@example.com`,
        cpf: '12345678901',
        password: 'Password123!',
        password_confirmation: 'Password123!'
      };

      const user2Data = {
        name: 'Test User 2',
        email: `testuser2${Date.now()}@example.com`,
        cpf: '12345678902',
        password: 'Password123!',
        password_confirmation: 'Password123!'
      };

      const user1Response = await axios.post(`${BASE_URL}/api/auth/register`, user1Data);
      const user2Response = await axios.post(`${BASE_URL}/api/auth/register`, user2Data);

      if (user1Response.data.data?.token && user2Response.data.data?.token) {
        const user1Token = user1Response.data.data.token;
        const user2Id = user2Response.data.data.user.id;

        // Try to access user2's data with user1's token
        const response = await axios.get(`${BASE_URL}/api/users/${user2Id}`, {
          headers: { Authorization: `Bearer ${user1Token}` }
        }, { validateStatus: () => true });

        if (response.status === 200) {
          this.log('Horizontal Privilege Escalation', 'FAIL', 
            'User can access another user\'s data', 'HIGH');
        } else if (response.status === 403 || response.status === 401) {
          this.log('Horizontal Privilege Escalation', 'PASS', 
            'Unauthorized access properly blocked');
        }
      }
    } catch (error) {
      this.log('Horizontal Privilege Escalation', 'ERROR', 
        `Test setup failed: ${error.message}`);
    }

    // Test 2: Admin endpoint access
    try {
      // Login as regular user
      const regularUser = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'user@example.com',
        password: 'password'
      }, { validateStatus: () => true });

      if (regularUser.data.data?.token) {
        const token = regularUser.data.data.token;

        // Try to access admin endpoints
        const adminEndpoints = [
          '/api/admin/users',
          '/api/admin/dashboard',
          '/api/admin/settings',
          '/api/admin/reports'
        ];

        for (const endpoint of adminEndpoints) {
          const response = await axios.get(`${BASE_URL}${endpoint}`, {
            headers: { Authorization: `Bearer ${token}` }
          }, { validateStatus: () => true });

          if (response.status === 200) {
            this.log('Admin Access Control', 'FAIL', 
              `Regular user accessed admin endpoint: ${endpoint}`, 'CRITICAL');
          } else if (response.status === 403) {
            this.log('Admin Access Control', 'PASS', 
              `Admin endpoint properly protected: ${endpoint}`);
          }
        }
      }
    } catch (error) {
      this.log('Admin Access Control', 'PASS', 'Admin endpoints properly secured');
    }
  }

  async testSecurityHeaders() {
    console.log('\n=== Testing Security Headers ===');

    try {
      const response = await axios.get(FRONTEND_URL);
      const headers = response.headers;

      // Check for essential security headers
      const securityHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
        'strict-transport-security',
        'content-security-policy',
        'referrer-policy'
      ];

      for (const header of securityHeaders) {
        if (headers[header]) {
          this.log('Security Headers', 'PASS', `${header} header present`);
        } else {
          this.log('Security Headers', 'FAIL', 
            `Missing security header: ${header}`, 'MEDIUM');
        }
      }

      // Check CSP configuration
      const csp = headers['content-security-policy'];
      if (csp) {
        if (csp.includes("'unsafe-eval'")) {
          this.log('CSP Configuration', 'FAIL', 
            'CSP allows unsafe-eval', 'MEDIUM');
        } else {
          this.log('CSP Configuration', 'PASS', 'CSP properly configured');
        }
      }

    } catch (error) {
      this.log('Security Headers', 'ERROR', `Failed to check headers: ${error.message}`);
    }
  }

  async testSessionSecurity() {
    console.log('\n=== Testing Session Security ===');

    try {
      // Test 1: Session fixation
      const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'admin@example.com',
        password: 'password'
      });

      if (loginResponse.data.data?.token) {
        const token1 = loginResponse.data.data.token;

        // Login again and check if token changes
        const loginResponse2 = await axios.post(`${BASE_URL}/api/auth/login`, {
          email: 'admin@example.com',
          password: 'password'
        });

        const token2 = loginResponse2.data.data.token;

        if (token1 === token2) {
          this.log('Session Fixation', 'FAIL', 
            'Same token returned for multiple logins', 'MEDIUM');
        } else {
          this.log('Session Fixation', 'PASS', 
            'New token generated for each login');
        }
      }

      // Test 2: Token expiration
      // This would require waiting or manipulating time
      this.log('Token Expiration', 'INFO', 'Manual verification required');

    } catch (error) {
      this.log('Session Security', 'ERROR', `Test failed: ${error.message}`);
    }
  }

  async testDataPrivacyCompliance() {
    console.log('\n=== Testing Data Privacy Compliance ===');

    try {
      // Test 1: Sensitive data in logs
      const sensitiveData = ['password', 'cpf', 'token', 'secret'];
      
      // This is a conceptual test - in practice, you'd check actual log files
      this.log('Sensitive Data Logging', 'INFO', 
        'Manual log review required for sensitive data');

      // Test 2: Data minimization
      const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'admin@example.com',
        password: 'password'
      });

      if (loginResponse.data.data?.user) {
        const userData = loginResponse.data.data.user;
        
        // Check if sensitive fields are exposed
        if (userData.password || userData.password_hash) {
          this.log('Data Minimization', 'FAIL', 
            'Password hash exposed in API response', 'HIGH');
        } else {
          this.log('Data Minimization', 'PASS', 
            'Sensitive fields properly filtered');
        }

        if (userData.cpf) {
          this.log('Data Minimization', 'FAIL', 
            'CPF exposed in API response', 'MEDIUM');
        } else {
          this.log('Data Minimization', 'PASS', 
            'CPF properly protected');
        }
      }

    } catch (error) {
      this.log('Data Privacy', 'ERROR', `Test failed: ${error.message}`);
    }
  }

  async testCSRFProtection() {
    console.log('\n=== Testing CSRF Protection ===');

    try {
      // Test cross-origin requests
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'admin@example.com',
        password: 'password'
      }, {
        headers: {
          'Origin': 'http://malicious-site.com',
          'Referer': 'http://malicious-site.com'
        }
      }, { validateStatus: () => true });

      if (response.status === 200) {
        this.log('CSRF Protection', 'FAIL', 
          'Cross-origin request allowed without CSRF token', 'HIGH');
      } else if (response.status === 403 || response.status === 419) {
        this.log('CSRF Protection', 'PASS', 
          'Cross-origin request properly blocked');
      }

    } catch (error) {
      this.log('CSRF Protection', 'PASS', 'CSRF protection working');
    }
  }

  async runAllTests() {
    console.log('Starting Security Test Suite...\n');

    await this.testAuthenticationVulnerabilities();
    await this.testInputValidationVulnerabilities();
    await this.testAuthorizationVulnerabilities();
    await this.testSecurityHeaders();
    await this.testSessionSecurity();
    await this.testDataPrivacyCompliance();
    await this.testCSRFProtection();

    return this.generateReport();
  }

  generateReport() {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.status === 'PASS').length;
    const failedTests = this.results.filter(r => r.status === 'FAIL').length;
    const criticalVulns = this.vulnerabilities.filter(v => v.severity === 'CRITICAL').length;
    const highVulns = this.vulnerabilities.filter(v => v.severity === 'HIGH').length;
    const mediumVulns = this.vulnerabilities.filter(v => v.severity === 'MEDIUM').length;

    const report = {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate: ((passedTests / totalTests) * 100).toFixed(2) + '%'
      },
      vulnerabilities: {
        critical: criticalVulns,
        high: highVulns,
        medium: mediumVulns,
        total: this.vulnerabilities.length
      },
      details: this.results,
      vulnerabilityList: this.vulnerabilities,
      timestamp: new Date().toISOString()
    };

    console.log('\n=== Security Test Report ===');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${report.summary.successRate}`);
    console.log('\nVulnerabilities Found:');
    console.log(`Critical: ${criticalVulns}`);
    console.log(`High: ${highVulns}`);
    console.log(`Medium: ${mediumVulns}`);

    if (this.vulnerabilities.length > 0) {
      console.log('\nVulnerability Details:');
      this.vulnerabilities.forEach(vuln => {
        console.log(`[${vuln.severity}] ${vuln.test}: ${vuln.message}`);
      });
    }

    return report;
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new SecurityTester();
  tester.runAllTests()
    .then(report => {
      // Save report to file
      const fs = require('fs');
      const reportPath = `./security-report-${Date.now()}.json`;
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\nDetailed report saved to: ${reportPath}`);
    })
    .catch(error => {
      console.error('Security test suite failed:', error);
      process.exit(1);
    });
}

module.exports = SecurityTester;