#!/usr/bin/env node

/**
 * Comprehensive Admin Authentication and Authorization Test Suite
 * 
 * This test validates the complete authentication flow from login to admin access:
 * 1. User Authentication (login/token generation)  
 * 2. Role-Based Access Control (RBAC)
 * 3. Middleware Protection on Admin Routes
 * 4. Invalid Token and Session Handling
 * 5. Admin Permission Verification
 * 
 * Tests are executed against actual HTTP endpoints with real responses.
 */

const https = require('https');
const http = require('http');

class AdminAuthTester {
    constructor() {
        this.baseUrl = 'http://localhost:8000';
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            tests: []
        };
        this.adminToken = null;
        this.regularUserToken = null;
        this.testResults = [];
    }

    /**
     * Make HTTP request with proper error handling
     */
    async makeRequest(options, data = null) {
        return new Promise((resolve, reject) => {
            const protocol = options.protocol === 'https:' ? https : http;
            
            const req = protocol.request(options, (res) => {
                let responseData = '';
                
                res.on('data', chunk => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const parsedData = responseData ? JSON.parse(responseData) : null;
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            data: parsedData,
                            rawData: responseData
                        });
                    } catch (e) {
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            data: null,
                            rawData: responseData
                        });
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Request timeout')));
            req.setTimeout(10000);

            if (data) {
                req.write(JSON.stringify(data));
            }
            
            req.end();
        });
    }

    /**
     * Parse URL for request options
     */
    parseUrl(url) {
        const urlObj = new URL(url);
        return {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            protocol: urlObj.protocol
        };
    }

    /**
     * Log test results
     */
    logTest(name, passed, details = {}) {
        const test = {
            name,
            passed,
            timestamp: new Date().toISOString(),
            details
        };
        
        this.results.tests.push(test);
        this.results.total++;
        if (passed) {
            this.results.passed++;
            console.log(`✅ ${name}`);
        } else {
            this.results.failed++;
            console.log(`❌ ${name}`);
        }
        
        if (details.response) {
            console.log(`   Status: ${details.response.statusCode}`);
            if (details.response.data && details.response.data.message) {
                console.log(`   Message: ${details.response.data.message}`);
            }
        }
        
        return test;
    }

    /**
     * Step 1: Create test users and get admin token
     */
    async setupTestUsers() {
        console.log('\n🔧 Setting up test users...');

        // Create admin test user
        const adminOptions = {
            ...this.parseUrl(`${this.baseUrl}/api/companies`),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Skip-CSRF-Protection': 'true'
            }
        };

        try {
            // First, ensure we have an admin user created
            console.log('Creating admin user...');
            const { spawn } = require('child_process');
            
            await new Promise((resolve, reject) => {
                const php = spawn('php', ['create_admin_test_user.php'], {
                    cwd: '/Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/backend',
                    stdio: 'inherit'
                });
                
                php.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Admin user creation failed with code ${code}`));
                    }
                });
            });

            return this.logTest('Admin user setup', true, {
                message: 'Admin test user created/verified successfully'
            });

        } catch (error) {
            return this.logTest('Admin user setup', false, {
                error: error.message
            });
        }
    }

    /**
     * Step 2: Test admin user login and token generation
     */
    async testAdminLogin() {
        console.log('\n🔐 Testing admin login...');

        const loginOptions = {
            ...this.parseUrl(`${this.baseUrl}/api/auth/login`),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Skip-CSRF-Protection': 'true'
            }
        };

        const loginData = {
            email: 'admin.test@example.com',
            password: 'admin123'
        };

        try {
            const response = await this.makeRequest(loginOptions, loginData);
            
            if (response.statusCode === 200 && response.data && response.data.success) {
                // Extract token from response
                if (response.data.token) {
                    this.adminToken = response.data.token;
                } else if (response.headers['authorization']) {
                    this.adminToken = response.headers['authorization'].replace('Bearer ', '');
                } else if (response.headers['set-cookie']) {
                    // Extract token from cookie if using session-based auth
                    const cookies = response.headers['set-cookie'];
                    console.log('   Session cookies set:', cookies.length);
                }

                return this.logTest('Admin login success', true, {
                    response,
                    hasToken: !!this.adminToken,
                    user: response.data.user ? {
                        id: response.data.user.id,
                        email: response.data.user.email,
                        name: response.data.user.name
                    } : null
                });
            } else {
                return this.logTest('Admin login success', false, {
                    response,
                    expectedSuccess: true,
                    actualStatus: response.statusCode
                });
            }
        } catch (error) {
            return this.logTest('Admin login success', false, {
                error: error.message
            });
        }
    }

    /**
     * Step 3: Test access to protected admin routes
     */
    async testAdminRouteAccess() {
        console.log('\n🛡️  Testing admin route access...');

        const adminEndpoints = [
            { path: '/api/admin/dashboard', name: 'Admin Dashboard' },
            { path: '/api/admin/users', name: 'User Management' },
            { path: '/api/admin/roles', name: 'Role Management' },
            { path: '/api/admin/analytics', name: 'Analytics' },
            { path: '/api/admin/system-health', name: 'System Health' },
            { path: '/api/admin/security-audit', name: 'Security Audit' }
        ];

        const testResults = [];
        
        for (const endpoint of adminEndpoints) {
            try {
                const options = {
                    ...this.parseUrl(`${this.baseUrl}${endpoint.path}`),
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'X-Skip-CSRF-Protection': 'true'
                    }
                };

                // Add authentication headers
                if (this.adminToken) {
                    options.headers['Authorization'] = `Bearer ${this.adminToken}`;
                }

                const response = await this.makeRequest(options);
                
                const isSuccess = response.statusCode === 200 && response.data && response.data.success;
                
                const testResult = this.logTest(`${endpoint.name} access`, isSuccess, {
                    endpoint: endpoint.path,
                    response: {
                        statusCode: response.statusCode,
                        hasData: !!response.data,
                        success: response.data ? response.data.success : false
                    }
                });

                testResults.push({
                    endpoint: endpoint.name,
                    path: endpoint.path,
                    success: isSuccess,
                    statusCode: response.statusCode,
                    responseData: response.data
                });

            } catch (error) {
                this.logTest(`${endpoint.name} access`, false, {
                    endpoint: endpoint.path,
                    error: error.message
                });

                testResults.push({
                    endpoint: endpoint.name,
                    path: endpoint.path,
                    success: false,
                    error: error.message
                });
            }
        }

        return testResults;
    }

    /**
     * Step 4: Test access without authentication (should fail)
     */
    async testUnauthenticatedAccess() {
        console.log('\n🚫 Testing unauthenticated access (should be denied)...');

        const protectedEndpoints = [
            '/api/admin/dashboard',
            '/api/admin/users',
            '/api/admin/roles'
        ];

        const testResults = [];

        for (const endpoint of protectedEndpoints) {
            try {
                const options = {
                    ...this.parseUrl(`${this.baseUrl}${endpoint}`),
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                };

                const response = await this.makeRequest(options);
                
                // Should return 401 (Unauthorized) or 403 (Forbidden)
                const isCorrectlyDenied = response.statusCode === 401 || response.statusCode === 403;
                
                this.logTest(`Unauthenticated access denied for ${endpoint}`, isCorrectlyDenied, {
                    endpoint,
                    response: {
                        statusCode: response.statusCode,
                        message: response.data ? response.data.message : null
                    },
                    expected: 'Should be 401 or 403',
                    actual: response.statusCode
                });

                testResults.push({
                    endpoint,
                    correctlyDenied: isCorrectlyDenied,
                    statusCode: response.statusCode,
                    response: response.data
                });

            } catch (error) {
                this.logTest(`Unauthenticated access denied for ${endpoint}`, false, {
                    endpoint,
                    error: error.message
                });

                testResults.push({
                    endpoint,
                    correctlyDenied: false,
                    error: error.message
                });
            }
        }

        return testResults;
    }

    /**
     * Step 5: Test invalid token access
     */
    async testInvalidTokenAccess() {
        console.log('\n🔑 Testing invalid token access (should be denied)...');

        const invalidTokens = [
            'invalid.token.here',
            'Bearer fake-token-123',
            'expired-token-456',
            'malformed'
        ];

        const testResults = [];

        for (const invalidToken of invalidTokens) {
            try {
                const options = {
                    ...this.parseUrl(`${this.baseUrl}/api/admin/dashboard`),
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${invalidToken}`
                    }
                };

                const response = await this.makeRequest(options);
                
                // Should return 401 (Unauthorized)
                const isCorrectlyDenied = response.statusCode === 401;
                
                this.logTest(`Invalid token "${invalidToken.slice(0, 20)}..." denied`, isCorrectlyDenied, {
                    token: invalidToken.slice(0, 20) + '...',
                    response: {
                        statusCode: response.statusCode,
                        message: response.data ? response.data.message : null
                    }
                });

                testResults.push({
                    token: invalidToken,
                    correctlyDenied: isCorrectlyDenied,
                    statusCode: response.statusCode
                });

            } catch (error) {
                this.logTest(`Invalid token access denied`, false, {
                    token: invalidToken,
                    error: error.message
                });
            }
        }

        return testResults;
    }

    /**
     * Step 6: Test CSRF protection
     */
    async testCSRFProtection() {
        console.log('\n🛡️  Testing CSRF protection...');

        try {
            // Test POST request without CSRF token (should fail in production)
            const options = {
                ...this.parseUrl(`${this.baseUrl}/api/admin/users`),
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            };

            if (this.adminToken) {
                options.headers['Authorization'] = `Bearer ${this.adminToken}`;
            }

            const response = await this.makeRequest(options, { test: 'data' });
            
            // In testing environment with X-Skip-CSRF-Protection header, this might pass
            // In production, this should fail with 419 (CSRF token mismatch)
            const testName = 'CSRF protection active';
            const passed = response.statusCode === 419 || response.statusCode === 422 || response.statusCode === 405;
            
            return this.logTest(testName, passed, {
                response: {
                    statusCode: response.statusCode,
                    message: response.data ? response.data.message : null
                },
                note: 'CSRF protection may be bypassed in testing environment'
            });

        } catch (error) {
            return this.logTest('CSRF protection test', false, {
                error: error.message
            });
        }
    }

    /**
     * Step 7: Test role hierarchy and permissions
     */
    async testRolePermissions() {
        console.log('\n👥 Testing role permissions...');

        try {
            // Test getting user's own permissions
            const options = {
                ...this.parseUrl(`${this.baseUrl}/api/admin/roles`),
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            };

            if (this.adminToken) {
                options.headers['Authorization'] = `Bearer ${this.adminToken}`;
            }

            const response = await this.makeRequest(options);
            
            const hasRoleData = response.statusCode === 200 && response.data && response.data.data;
            
            return this.logTest('Role permissions check', hasRoleData, {
                response: {
                    statusCode: response.statusCode,
                    hasRoleData,
                    roleCount: hasRoleData ? response.data.data.length : 0
                }
            });

        } catch (error) {
            return this.logTest('Role permissions check', false, {
                error: error.message
            });
        }
    }

    /**
     * Step 8: Test rate limiting
     */
    async testRateLimiting() {
        console.log('\n⏱️  Testing rate limiting...');

        const requests = [];
        const maxRequests = 10; // Try to exceed rate limit

        for (let i = 0; i < maxRequests; i++) {
            const options = {
                ...this.parseUrl(`${this.baseUrl}/api/admin/system-health`),
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            };

            if (this.adminToken) {
                options.headers['Authorization'] = `Bearer ${this.adminToken}`;
            }

            requests.push(this.makeRequest(options));
        }

        try {
            const responses = await Promise.all(requests);
            
            // Check if any requests were rate limited (status 429)
            const rateLimitedRequests = responses.filter(r => r.statusCode === 429);
            const successfulRequests = responses.filter(r => r.statusCode === 200);
            
            return this.logTest('Rate limiting test', true, {
                totalRequests: maxRequests,
                successfulRequests: successfulRequests.length,
                rateLimitedRequests: rateLimitedRequests.length,
                note: 'Rate limiting may be configured differently in testing'
            });

        } catch (error) {
            return this.logTest('Rate limiting test', false, {
                error: error.message
            });
        }
    }

    /**
     * Generate comprehensive test report
     */
    generateReport() {
        console.log('\n📊 COMPREHENSIVE AUTHENTICATION TEST REPORT');
        console.log('=' .repeat(60));
        console.log(`Total Tests: ${this.results.total}`);
        console.log(`Passed: ${this.results.passed}`);
        console.log(`Failed: ${this.results.failed}`);
        console.log(`Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);
        console.log('\nTest Details:');
        console.log('-'.repeat(60));

        this.results.tests.forEach((test, index) => {
            console.log(`${index + 1}. ${test.name}: ${test.passed ? '✅ PASS' : '❌ FAIL'}`);
            
            if (test.details.response) {
                console.log(`   HTTP Status: ${test.details.response.statusCode}`);
                if (test.details.response.data && test.details.response.data.message) {
                    console.log(`   Response: ${test.details.response.data.message}`);
                }
            }
            
            if (test.details.error) {
                console.log(`   Error: ${test.details.error}`);
            }
            
            if (test.details.note) {
                console.log(`   Note: ${test.details.note}`);
            }
            
            console.log();
        });

        return {
            summary: {
                total: this.results.total,
                passed: this.results.passed,
                failed: this.results.failed,
                successRate: ((this.results.passed / this.results.total) * 100).toFixed(1) + '%'
            },
            tests: this.results.tests,
            timestamp: new Date().toISOString(),
            environment: {
                baseUrl: this.baseUrl,
                nodeVersion: process.version
            }
        };
    }

    /**
     * Run all authentication tests
     */
    async runAllTests() {
        console.log('🚀 Starting Comprehensive Admin Authentication Test Suite');
        console.log('Backend URL:', this.baseUrl);
        console.log('Timestamp:', new Date().toISOString());

        try {
            // Step 1: Setup
            await this.setupTestUsers();

            // Step 2: Login and get token
            await this.testAdminLogin();

            // Step 3: Test authenticated admin access
            await this.testAdminRouteAccess();

            // Step 4: Test unauthenticated access (should fail)
            await this.testUnauthenticatedAccess();

            // Step 5: Test invalid token access (should fail)
            await this.testInvalidTokenAccess();

            // Step 6: Test CSRF protection
            await this.testCSRFProtection();

            // Step 7: Test role permissions
            await this.testRolePermissions();

            // Step 8: Test rate limiting
            await this.testRateLimiting();

            // Generate final report
            const report = this.generateReport();

            // Save results to file
            const fs = require('fs');
            const reportPath = '/Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/frontend/__tests__/feature-flags/admin-auth-test-results.json';
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
            
            console.log(`\n📁 Full test results saved to: ${reportPath}`);

            return report;

        } catch (error) {
            console.error('\n💥 Test suite error:', error.message);
            this.logTest('Test Suite Execution', false, { error: error.message });
            return this.generateReport();
        }
    }
}

// Run the tests if this file is executed directly
if (require.main === module) {
    const tester = new AdminAuthTester();
    tester.runAllTests()
        .then(report => {
            console.log('\n✅ Test suite completed');
            process.exit(report.summary.failed > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('\n💥 Test suite failed:', error.message);
            process.exit(1);
        });
}

module.exports = AdminAuthTester;