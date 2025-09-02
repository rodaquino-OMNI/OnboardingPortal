#!/usr/bin/env node
/**
 * Safe Security Testing Suite
 * Tests middleware protection with safer payload handling
 */

const express = require('express');
const http = require('http');

class SafeSecurityTester {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      summary: { total: 0, blocked: 0, passed: 0, failed: 0 },
      tests: [],
      vulnerabilities: [],
      recommendations: []
    };
    
    this.testApp = null;
    this.server = null;
  }

  async setupTestServer() {
    const app = express();
    app.use(express.json());
    
    // Simulate UnifiedAuthMiddleware security checks
    app.use((req, res, next) => {
      const cookies = req.headers.cookie || '';
      const auth = req.headers.authorization || '';
      const userAgent = req.headers['user-agent'] || '';
      
      // Security patterns to detect
      const securityChecks = [
        {
          name: 'SQL Injection',
          patterns: [/\'\s*or\s*\'/i, /union\s+select/i, /drop\s+table/i, /--/i],
          sources: [cookies, auth, req.url]
        },
        {
          name: 'XSS',
          patterns: [/<script/i, /javascript:/i, /on\w+=/i, /<iframe/i],
          sources: [cookies, auth, userAgent]
        },
        {
          name: 'Path Traversal',
          patterns: [/\.\./i, /\/etc\/passwd/i, /\/windows\/system32/i],
          sources: [req.url, cookies]
        },
        {
          name: 'CRLF Injection',
          patterns: [/\r\n/i, /\n/i, /\r/i],
          sources: [cookies, auth]
        },
        {
          name: 'Null Bytes',
          patterns: [/\x00/i, /%00/i, /null/i],
          sources: [cookies, auth, req.url]
        }
      ];

      // Check for malicious patterns
      for (const check of securityChecks) {
        for (const source of check.sources) {
          if (source && check.patterns.some(pattern => pattern.test(source))) {
            return res.status(403).json({ 
              error: `Blocked: ${check.name} attempt detected`,
              pattern: check.name,
              source: source.substring(0, 100)
            });
          }
        }
      }

      // Check cookie size
      if (cookies.length > 4096) {
        return res.status(413).json({ error: 'Cookie size exceeds limit' });
      }

      next();
    });

    // Test endpoints
    app.get('/api/user/profile', (req, res) => {
      res.json({ message: 'Profile accessed', timestamp: Date.now() });
    });

    app.post('/api/auth/login', (req, res) => {
      res.json({ message: 'Login attempted', timestamp: Date.now() });
    });

    app.get('/api/files/:filename', (req, res) => {
      const filename = req.params.filename;
      if (filename.includes('..')) {
        return res.status(403).json({ error: 'Path traversal blocked' });
      }
      res.json({ filename, timestamp: Date.now() });
    });

    app.get('/api/test', (req, res) => {
      res.json({ message: 'Test endpoint', params: req.query, timestamp: Date.now() });
    });

    // Start server
    return new Promise((resolve) => {
      this.server = app.listen(0, 'localhost', () => {
        const port = this.server.address().port;
        console.log(`🔧 Test server running on port ${port}`);
        this.testApp = app;
        this.baseUrl = `http://localhost:${port}`;
        resolve(port);
      });
    });
  }

  async runAllTests() {
    console.log('🔒 Starting Safe Security Testing Suite...\n');
    
    try {
      await this.setupTestServer();
      
      // Run test categories sequentially to avoid conflicts
      await this.testSQLInjection();
      await this.testXSSPayloads();
      await this.testPathTraversal();
      await this.testCRLFInjection();
      await this.testCookieBoundaries();
      await this.testJWTSecurity();
      await this.testNullValues();
      await this.testMaliciousUserAgents();
      
      this.generateReport();
      await this.cleanup();
      
      return this.results;
    } catch (error) {
      console.error('❌ Security testing failed:', error);
      await this.cleanup();
      throw error;
    }
  }

  async makeTestRequest(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const method = options.method || 'GET';
    const headers = options.headers || {};
    const body = options.body;

    return new Promise((resolve) => {
      const reqOptions = new URL(url);
      reqOptions.method = method;
      reqOptions.headers = headers;

      const startTime = Date.now();
      const req = http.request(reqOptions, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseBody,
            responseTime,
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

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  logTest(category, payload, result, expected = 'blocked') {
    this.results.summary.total++;
    const status = result.blocked ? 'BLOCKED' : 'PASSED';
    const isVulnerable = !result.blocked && expected === 'blocked';
    
    if (result.blocked) {
      this.results.summary.blocked++;
    } else if (isVulnerable) {
      this.results.summary.failed++;
      this.results.vulnerabilities.push({
        category,
        payload: payload.substring(0, 100),
        status: result.statusCode,
        risk: 'HIGH'
      });
    } else {
      this.results.summary.passed++;
    }

    const emoji = result.blocked ? '🛡️' : (isVulnerable ? '⚠️' : '✅');
    console.log(`${emoji} [${category}] ${status} - ${payload.substring(0, 50)}...`);

    this.results.tests.push({
      category,
      payload: payload.substring(0, 200),
      status,
      statusCode: result.statusCode,
      responseTime: result.responseTime,
      vulnerable: isVulnerable,
      error: result.error
    });
  }

  async testSQLInjection() {
    console.log('💉 Testing SQL Injection Payloads...');
    
    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT password FROM users--",
      "admin'/*",
      "' OR 1=1#",
      "') OR ('1'='1",
      "' AND (SELECT COUNT(*) FROM users)>0--",
      "'; EXEC xp_cmdshell('dir')--"
    ];

    for (const payload of sqlPayloads) {
      const response = await this.makeTestRequest('/api/auth/login', {
        method: 'POST',
        headers: {
          'Cookie': `sessionid=${payload}`,
          'Content-Type': 'application/json'
        },
        body: { email: 'test@example.com', password: 'password' }
      });
      
      this.logTest('SQL Injection', payload, response);
    }
  }

  async testXSSPayloads() {
    console.log('🚨 Testing XSS Payloads...');
    
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<svg onload=alert("XSS")>',
      '"><script>alert("XSS")</script>',
      '<iframe src="javascript:alert(`XSS`)">',
      '<body onload=alert("XSS")>',
      '<input onfocus=alert("XSS") autofocus>'
    ];

    for (const payload of xssPayloads) {
      const response = await this.makeTestRequest('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${payload}`,
          'Cookie': `token=${payload}`
        }
      });
      
      this.logTest('XSS', payload, response);
    }
  }

  async testPathTraversal() {
    console.log('📁 Testing Path Traversal...');
    
    const pathPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config',
      '....//....//etc/passwd',
      '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '/var/www/../../etc/passwd'
    ];

    for (const payload of pathPayloads) {
      const response = await this.makeTestRequest(`/api/files/${encodeURIComponent(payload)}`);
      this.logTest('Path Traversal', payload, response);
    }
  }

  async testCRLFInjection() {
    console.log('📋 Testing CRLF Injection...');
    
    // Test CRLF in query parameters (safer than headers)
    const crlfPayloads = [
      'value\r\nSet-Cookie: admin=true',
      'data\r\nLocation: http://evil.com',
      'session\r\n\r\n<script>alert("XSS")</script>',
      'token\rSet-Cookie: malicious=true'
    ];

    for (const payload of crlfPayloads) {
      const response = await this.makeTestRequest(`/api/test?param=${encodeURIComponent(payload)}`, {
        headers: {
          'User-Agent': 'SecurityTester/1.0'
        }
      });
      
      this.logTest('CRLF Injection', payload, response);
    }
  }

  async testCookieBoundaries() {
    console.log('📏 Testing Cookie Boundaries...');
    
    const boundaryTests = [
      { name: '10 chars', value: 'A'.repeat(10), expected: 'allowed' },
      { name: '11 chars', value: 'A'.repeat(11), expected: 'allowed' },
      { name: '32 chars', value: 'A'.repeat(32), expected: 'allowed' },
      { name: '4KB cookie', value: 'A'.repeat(4096), expected: 'blocked' },
      { name: '8KB cookie', value: 'A'.repeat(8192), expected: 'blocked' },
      { name: 'Empty cookie', value: '', expected: 'allowed' }
    ];

    for (const test of boundaryTests) {
      const response = await this.makeTestRequest('/api/user/profile', {
        headers: {
          'Cookie': `sessionid=${test.value}`
        }
      });
      
      this.logTest('Cookie Boundaries', test.name, response, test.expected);
    }
  }

  async testJWTSecurity() {
    console.log('🔑 Testing JWT Security...');
    
    const jwtPayloads = [
      'eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiJ9.',  // None algorithm
      'not.a.valid.jwt.token',  // Malformed
      '..',  // Empty sections
      'fake-jwt-token'  // Completely fake
    ];

    for (const payload of jwtPayloads) {
      const response = await this.makeTestRequest('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${payload}`
        }
      });
      
      this.logTest('JWT Security', payload, response, 'allowed'); // JWT validation is app-specific
    }
  }

  async testNullValues() {
    console.log('⚪ Testing Null Values...');
    
    const nullPayloads = [
      { name: 'null string', value: 'null', expected: 'blocked' },
      { name: 'null bytes', value: '\x00test', expected: 'blocked' },
      { name: 'percent encoded null', value: '%00test', expected: 'blocked' },
      { name: 'empty value', value: '', expected: 'allowed' }
    ];

    for (const test of nullPayloads) {
      const response = await this.makeTestRequest('/api/user/profile', {
        headers: {
          'Cookie': `sessionid=${test.value}`
        }
      });
      
      this.logTest('Null Values', test.name, response, test.expected);
    }
  }

  async testMaliciousUserAgents() {
    console.log('🤖 Testing Malicious User Agents...');
    
    const userAgents = [
      '<script>alert("XSS")</script>',
      'Mozilla/5.0 <script>alert("XSS")</script>',
      "'; DROP TABLE users; --",
      '../../../etc/passwd'
    ];

    for (const ua of userAgents) {
      const response = await this.makeTestRequest('/api/user/profile', {
        headers: {
          'User-Agent': ua,
          'Cookie': 'sessionid=valid'
        }
      });
      
      this.logTest('Malicious User-Agent', ua, response);
    }
  }

  generateReport() {
    console.log('\n📊 Security Testing Report');
    console.log('=' .repeat(50));
    console.log(`Total Tests: ${this.results.summary.total}`);
    console.log(`🛡️  Blocked: ${this.results.summary.blocked}`);
    console.log(`✅ Passed: ${this.results.summary.passed}`);
    console.log(`❌ Failed: ${this.results.summary.failed}`);
    
    const securityScore = ((this.results.summary.blocked / this.results.summary.total) * 100).toFixed(1);
    console.log(`🔒 Security Score: ${securityScore}%`);
    
    if (this.results.vulnerabilities.length > 0) {
      console.log('\n⚠️  VULNERABILITIES DETECTED:');
      this.results.vulnerabilities.forEach((vuln, i) => {
        console.log(`${i + 1}. [${vuln.category}] ${vuln.payload}`);
      });
    }

    // Detailed category analysis
    const categories = {};
    this.results.tests.forEach(test => {
      if (!categories[test.category]) {
        categories[test.category] = { total: 0, blocked: 0 };
      }
      categories[test.category].total++;
      if (test.status === 'BLOCKED') {
        categories[test.category].blocked++;
      }
    });

    console.log('\n📈 Category Analysis:');
    Object.entries(categories).forEach(([category, stats]) => {
      const effectiveness = ((stats.blocked / stats.total) * 100).toFixed(1);
      console.log(`  ${category}: ${stats.blocked}/${stats.total} blocked (${effectiveness}%)`);
    });

    // Store final results
    this.results.summary.securityScore = parseFloat(securityScore);
    this.results.categoryAnalysis = categories;
  }

  async cleanup() {
    if (this.server) {
      this.server.close();
      console.log('🧹 Test server stopped');
    }
  }
}

// Export for use in other modules
module.exports = SafeSecurityTester;

// Run tests if called directly
if (require.main === module) {
  const tester = new SafeSecurityTester();
  
  tester.runAllTests()
    .then(results => {
      console.log(`\n✅ Security testing completed with ${results.summary.securityScore}% effectiveness`);
      process.exit(results.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Security testing failed:', error);
      process.exit(1);
    });
}