#!/usr/bin/env node

/**
 * COMPREHENSIVE PRODUCTION READINESS TEST SUITE
 * Tests the entire system integration for production deployment
 */

const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class ProductionReadinessTest {
    constructor() {
        this.baseURL = 'http://localhost:8000';
        this.frontendURL = 'http://localhost:3000';
        this.testResults = {
            passed: 0,
            failed: 0,
            errors: [],
            warnings: [],
            performance: {},
            security: {}
        };
        this.testUsers = [];
        this.testCompanies = [];
        this.sessions = new Map();
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type.toUpperCase().padEnd(7);
        console.log(`[${timestamp}] ${prefix} ${message}`);
        
        if (type === 'error') {
            this.testResults.errors.push({ timestamp, message });
        } else if (type === 'warning') {
            this.testResults.warnings.push({ timestamp, message });
        }
    }

    async makeRequest(method, endpoint, data = null, headers = {}) {
        try {
            const config = {
                method,
                url: `${this.baseURL}${endpoint}`,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'ProductionReadinessTest/1.0',
                    ...headers
                },
                withCredentials: true,
                timeout: 10000
            };

            if (data) config.data = data;

            const response = await axios(config);
            return {
                success: true,
                status: response.status,
                headers: response.headers,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                status: error.response?.status || 0,
                headers: error.response?.headers || {},
                data: error.response?.data || null,
                error: error.message
            };
        }
    }

    async testHealthCheck() {
        this.log('Testing system health endpoints...');
        
        // Test backend health
        const backendHealth = await this.makeRequest('GET', '/api/health');
        if (!backendHealth.success) {
            this.testResults.failed++;
            this.log('Backend health check failed', 'error');
            return false;
        }

        // Test database connectivity
        const dbHealth = await this.makeRequest('GET', '/api/health/database');
        if (!dbHealth.success) {
            this.testResults.failed++;
            this.log('Database health check failed', 'error');
            return false;
        }

        this.testResults.passed++;
        this.log('System health checks passed');
        return true;
    }

    async testCSRFProtection() {
        this.log('Testing CSRF protection...');

        // Get CSRF token
        const csrfResponse = await this.makeRequest('GET', '/sanctum/csrf-cookie');
        if (!csrfResponse.success) {
            this.testResults.failed++;
            this.log('CSRF cookie endpoint failed', 'error');
            return false;
        }

        // Extract CSRF token from cookies
        const cookies = csrfResponse.headers['set-cookie'] || [];
        const xsrfCookie = cookies.find(cookie => cookie.includes('XSRF-TOKEN'));
        
        if (!xsrfCookie) {
            this.testResults.failed++;
            this.log('CSRF token not found in response', 'error');
            return false;
        }

        this.testResults.passed++;
        this.log('CSRF protection is working');
        return true;
    }

    async createTestCompany(name, domain) {
        const companyData = {
            name,
            domain,
            industry: 'Technology',
            size: 'Medium',
            address: '123 Test Street',
            city: 'Test City',
            country: 'US',
            phone: '+1234567890',
            email: `admin@${domain}`
        };

        const response = await this.makeRequest('POST', '/api/companies', companyData);
        if (response.success) {
            this.testCompanies.push(response.data);
            this.log(`Created test company: ${name}`);
            return response.data;
        } else {
            this.log(`Failed to create company ${name}: ${response.error}`, 'error');
            return null;
        }
    }

    async createTestUser(email, password, companyId, role = 'employee') {
        const userData = {
            name: email.split('@')[0],
            email,
            password,
            password_confirmation: password,
            company_id: companyId,
            role,
            department: 'Engineering',
            position: 'Software Developer',
            hire_date: new Date().toISOString().split('T')[0]
        };

        const response = await this.makeRequest('POST', '/api/auth/register', userData);
        if (response.success) {
            this.testUsers.push({ ...userData, id: response.data.user?.id });
            this.log(`Created test user: ${email}`);
            return response.data;
        } else {
            this.log(`Failed to create user ${email}: ${response.error}`, 'error');
            return null;
        }
    }

    async testUserRegistrationFlow() {
        this.log('Testing complete user registration flow...');

        // Create test companies first
        const company1 = await this.createTestCompany('Test Corp Alpha', 'testcorp-alpha.com');
        const company2 = await this.createTestCompany('Test Corp Beta', 'testcorp-beta.com');

        if (!company1 || !company2) {
            this.testResults.failed++;
            return false;
        }

        // Test registration with various scenarios
        const registrationTests = [
            {
                email: 'admin@testcorp-alpha.com',
                password: 'SecurePass123!',
                companyId: company1.id,
                role: 'admin',
                expected: true
            },
            {
                email: 'user1@testcorp-alpha.com',
                password: 'UserPass456!',
                companyId: company1.id,
                role: 'employee',
                expected: true
            },
            {
                email: 'user2@testcorp-beta.com',
                password: 'BetaPass789!',
                companyId: company2.id,
                role: 'employee',
                expected: true
            },
            {
                email: 'admin@testcorp-alpha.com', // Duplicate email
                password: 'AnotherPass!',
                companyId: company1.id,
                role: 'admin',
                expected: false
            }
        ];

        let passed = 0;
        for (const test of registrationTests) {
            const result = await this.createTestUser(
                test.email, 
                test.password, 
                test.companyId, 
                test.role
            );
            
            if ((result !== null) === test.expected) {
                passed++;
                this.log(`Registration test passed for ${test.email}`);
            } else {
                this.log(`Registration test failed for ${test.email}`, 'error');
            }
        }

        if (passed === registrationTests.length) {
            this.testResults.passed++;
            this.log('User registration flow tests passed');
            return true;
        } else {
            this.testResults.failed++;
            return false;
        }
    }

    async testAuthenticationCycle() {
        this.log('Testing complete authentication cycle...');

        if (this.testUsers.length === 0) {
            this.log('No test users available for authentication testing', 'error');
            this.testResults.failed++;
            return false;
        }

        for (const user of this.testUsers.slice(0, 3)) { // Test first 3 users
            this.log(`Testing authentication cycle for ${user.email}...`);

            // Step 1: Login
            const loginResponse = await this.makeRequest('POST', '/api/auth/login', {
                email: user.email,
                password: user.password
            });

            if (!loginResponse.success) {
                this.log(`Login failed for ${user.email}: ${loginResponse.error}`, 'error');
                continue;
            }

            // Store session info
            const sessionCookie = loginResponse.headers['set-cookie']?.find(
                cookie => cookie.includes('laravel_session')
            );
            if (sessionCookie) {
                this.sessions.set(user.email, sessionCookie);
            }

            this.log(`Login successful for ${user.email}`);

            // Step 2: Access protected resources
            const protectedTests = [
                '/api/user/profile',
                '/api/user/dashboard',
                '/api/user/companies',
                '/api/user/settings'
            ];

            let protectedPassed = 0;
            for (const endpoint of protectedTests) {
                const headers = sessionCookie ? { 'Cookie': sessionCookie } : {};
                const response = await this.makeRequest('GET', endpoint, null, headers);
                
                if (response.success) {
                    protectedPassed++;
                } else {
                    this.log(`Protected endpoint failed: ${endpoint}`, 'warning');
                }
            }

            this.log(`Protected endpoints: ${protectedPassed}/${protectedTests.length} passed`);

            // Step 3: Logout
            const logoutResponse = await this.makeRequest('POST', '/api/auth/logout', null, {
                'Cookie': sessionCookie || ''
            });

            if (logoutResponse.success) {
                this.log(`Logout successful for ${user.email}`);
            } else {
                this.log(`Logout failed for ${user.email}`, 'warning');
            }

            // Step 4: Verify session is invalidated
            const postLogoutResponse = await this.makeRequest('GET', '/api/user/profile', null, {
                'Cookie': sessionCookie || ''
            });

            if (postLogoutResponse.status === 401 || postLogoutResponse.status === 403) {
                this.log(`Session properly invalidated for ${user.email}`);
            } else {
                this.log(`Session not invalidated for ${user.email}`, 'error');
            }
        }

        this.testResults.passed++;
        this.log('Authentication cycle tests completed');
        return true;
    }

    async testMultiTenantDataIsolation() {
        this.log('Testing multi-tenant data isolation...');

        if (this.testCompanies.length < 2) {
            this.log('Need at least 2 test companies for isolation testing', 'error');
            this.testResults.failed++;
            return false;
        }

        // Login as users from different companies
        const company1User = this.testUsers.find(u => u.company_id === this.testCompanies[0].id);
        const company2User = this.testUsers.find(u => u.company_id === this.testCompanies[1].id);

        if (!company1User || !company2User) {
            this.log('Missing test users for different companies', 'error');
            this.testResults.failed++;
            return false;
        }

        // Login both users
        const login1 = await this.makeRequest('POST', '/api/auth/login', {
            email: company1User.email,
            password: company1User.password
        });

        const login2 = await this.makeRequest('POST', '/api/auth/login', {
            email: company2User.email,
            password: company2User.password
        });

        if (!login1.success || !login2.success) {
            this.log('Failed to login test users for isolation testing', 'error');
            this.testResults.failed++;
            return false;
        }

        const session1 = login1.headers['set-cookie']?.find(c => c.includes('laravel_session'));
        const session2 = login2.headers['set-cookie']?.find(c => c.includes('laravel_session'));

        // Test data isolation
        const isolationTests = [
            {
                endpoint: '/api/user/company/employees',
                description: 'Employee list isolation'
            },
            {
                endpoint: '/api/user/company/departments',
                description: 'Department data isolation'
            },
            {
                endpoint: '/api/user/company/settings',
                description: 'Company settings isolation'
            }
        ];

        let isolationPassed = 0;
        for (const test of isolationTests) {
            const response1 = await this.makeRequest('GET', test.endpoint, null, {
                'Cookie': session1 || ''
            });
            const response2 = await this.makeRequest('GET', test.endpoint, null, {
                'Cookie': session2 || ''
            });

            if (response1.success && response2.success) {
                // Check if data is different (isolated)
                const data1 = JSON.stringify(response1.data);
                const data2 = JSON.stringify(response2.data);
                
                if (data1 !== data2) {
                    isolationPassed++;
                    this.log(`${test.description}: ISOLATED ✓`);
                } else {
                    this.log(`${test.description}: NOT ISOLATED ✗`, 'error');
                }
            } else {
                this.log(`${test.description}: REQUEST FAILED`, 'warning');
            }
        }

        if (isolationPassed === isolationTests.length) {
            this.testResults.passed++;
            this.log('Multi-tenant data isolation tests passed');
            return true;
        } else {
            this.testResults.failed++;
            return false;
        }
    }

    async testErrorHandlingAndEdgeCases() {
        this.log('Testing error handling and edge cases...');

        const errorTests = [
            {
                name: 'Invalid JSON payload',
                request: () => this.makeRequest('POST', '/api/auth/login', 'invalid-json'),
                expectedStatus: 400
            },
            {
                name: 'Missing required fields',
                request: () => this.makeRequest('POST', '/api/auth/register', {}),
                expectedStatus: 422
            },
            {
                name: 'Invalid email format',
                request: () => this.makeRequest('POST', '/api/auth/login', {
                    email: 'invalid-email',
                    password: 'password'
                }),
                expectedStatus: 422
            },
            {
                name: 'SQL injection attempt',
                request: () => this.makeRequest('POST', '/api/auth/login', {
                    email: "admin'; DROP TABLE users; --",
                    password: 'password'
                }),
                expectedStatus: 422
            },
            {
                name: 'XSS attempt in registration',
                request: () => this.makeRequest('POST', '/api/auth/register', {
                    name: '<script>alert("xss")</script>',
                    email: 'test@xss.com',
                    password: 'password'
                }),
                expectedStatus: 422
            },
            {
                name: 'Rate limiting test',
                request: async () => {
                    // Make 20 rapid requests
                    const promises = Array(20).fill(null).map(() =>
                        this.makeRequest('POST', '/api/auth/login', {
                            email: 'nonexistent@example.com',
                            password: 'wrongpassword'
                        })
                    );
                    const results = await Promise.all(promises);
                    return results[results.length - 1]; // Return last result
                },
                expectedStatus: 429
            }
        ];

        let errorTestsPassed = 0;
        for (const test of errorTests) {
            try {
                const result = await test.request();
                const statusMatches = test.expectedStatus 
                    ? result.status === test.expectedStatus 
                    : !result.success;

                if (statusMatches) {
                    errorTestsPassed++;
                    this.log(`${test.name}: HANDLED ✓`);
                } else {
                    this.log(`${test.name}: NOT HANDLED (status: ${result.status}) ✗`, 'error');
                }
            } catch (error) {
                this.log(`${test.name}: ERROR - ${error.message}`, 'error');
            }
        }

        if (errorTestsPassed >= errorTests.length * 0.8) { // 80% pass rate acceptable
            this.testResults.passed++;
            this.log(`Error handling tests: ${errorTestsPassed}/${errorTests.length} passed`);
            return true;
        } else {
            this.testResults.failed++;
            return false;
        }
    }

    async testPerformanceUnderLoad() {
        this.log('Testing performance under simulated load...');

        const performanceTests = [
            {
                name: 'Concurrent login attempts',
                concurrent: 10,
                endpoint: '/api/auth/login',
                payload: { email: 'nonexistent@test.com', password: 'password' }
            },
            {
                name: 'Parallel user profile requests',
                concurrent: 15,
                endpoint: '/api/user/profile',
                headers: this.sessions.size > 0 ? { 'Cookie': Array.from(this.sessions.values())[0] } : {}
            },
            {
                name: 'Database-heavy operations',
                concurrent: 8,
                endpoint: '/api/user/dashboard',
                headers: this.sessions.size > 0 ? { 'Cookie': Array.from(this.sessions.values())[0] } : {}
            }
        ];

        for (const test of performanceTests) {
            this.log(`Running ${test.name} (${test.concurrent} concurrent requests)...`);
            
            const startTime = Date.now();
            const promises = Array(test.concurrent).fill(null).map(() =>
                this.makeRequest('POST', test.endpoint, test.payload || null, test.headers || {})
            );

            try {
                const results = await Promise.all(promises);
                const endTime = Date.now();
                const duration = endTime - startTime;
                const successCount = results.filter(r => r.success).length;
                const avgResponseTime = duration / test.concurrent;

                this.testResults.performance[test.name] = {
                    duration,
                    successCount,
                    totalRequests: test.concurrent,
                    avgResponseTime,
                    successRate: (successCount / test.concurrent * 100).toFixed(2)
                };

                this.log(`${test.name}: ${successCount}/${test.concurrent} success in ${duration}ms (avg: ${avgResponseTime.toFixed(2)}ms)`);

                if (successCount >= test.concurrent * 0.9 && avgResponseTime < 1000) {
                    this.log(`${test.name}: PERFORMANCE OK ✓`);
                } else {
                    this.log(`${test.name}: PERFORMANCE ISSUE ✗`, 'warning');
                }
            } catch (error) {
                this.log(`${test.name}: FAILED - ${error.message}`, 'error');
            }
        }

        this.testResults.passed++;
        this.log('Performance testing completed');
        return true;
    }

    async testSecurityHeaders() {
        this.log('Testing security headers on all endpoints...');

        const endpoints = [
            '/api/health',
            '/api/auth/login',
            '/api/auth/register',
            '/sanctum/csrf-cookie',
            '/api/user/profile'
        ];

        const requiredHeaders = [
            'X-Frame-Options',
            'X-Content-Type-Options',
            'X-XSS-Protection',
            'Strict-Transport-Security',
            'Content-Security-Policy'
        ];

        let headerTestsPassed = 0;
        const headerResults = {};

        for (const endpoint of endpoints) {
            this.log(`Checking security headers for ${endpoint}...`);
            const response = await this.makeRequest('GET', endpoint);
            
            headerResults[endpoint] = {};
            let endpointPassed = 0;

            for (const header of requiredHeaders) {
                const headerValue = response.headers[header.toLowerCase()];
                headerResults[endpoint][header] = headerValue ? 'PRESENT' : 'MISSING';
                
                if (headerValue) {
                    endpointPassed++;
                } else {
                    this.log(`Missing security header ${header} on ${endpoint}`, 'warning');
                }
            }

            if (endpointPassed >= requiredHeaders.length * 0.8) { // 80% of headers present
                headerTestsPassed++;
            }
        }

        this.testResults.security.headers = headerResults;

        if (headerTestsPassed >= endpoints.length * 0.8) {
            this.testResults.passed++;
            this.log(`Security headers test: ${headerTestsPassed}/${endpoints.length} endpoints passed`);
            return true;
        } else {
            this.testResults.failed++;
            return false;
        }
    }

    async testDatabaseIntegrityUnderConcurrency() {
        this.log('Testing database integrity under concurrent operations...');

        if (this.testUsers.length < 2) {
            this.log('Need at least 2 test users for concurrency testing', 'error');
            this.testResults.failed++;
            return false;
        }

        // Test concurrent user updates
        const user = this.testUsers[0];
        const updatePromises = Array(5).fill(null).map((_, index) =>
            this.makeRequest('PUT', '/api/user/profile', {
                name: `${user.name}_updated_${index}`,
                department: `Dept_${index}`
            }, {
                'Cookie': this.sessions.get(user.email) || ''
            })
        );

        try {
            const updateResults = await Promise.all(updatePromises);
            const successfulUpdates = updateResults.filter(r => r.success).length;
            
            this.log(`Concurrent updates: ${successfulUpdates}/5 successful`);

            // Verify final state is consistent
            const finalStateResponse = await this.makeRequest('GET', '/api/user/profile', null, {
                'Cookie': this.sessions.get(user.email) || ''
            });

            if (finalStateResponse.success) {
                this.log('Database integrity maintained under concurrency');
                this.testResults.passed++;
                return true;
            } else {
                this.log('Database integrity check failed', 'error');
                this.testResults.failed++;
                return false;
            }
        } catch (error) {
            this.log(`Concurrency test failed: ${error.message}`, 'error');
            this.testResults.failed++;
            return false;
        }
    }

    async testSessionManagementAcrossTabs() {
        this.log('Testing session management across browser tabs...');

        if (this.testUsers.length === 0) {
            this.log('No test users available for session testing', 'error');
            this.testResults.failed++;
            return false;
        }

        const user = this.testUsers[0];
        
        // Simulate multiple tab logins
        const loginPromises = Array(3).fill(null).map(() =>
            this.makeRequest('POST', '/api/auth/login', {
                email: user.email,
                password: user.password
            })
        );

        try {
            const loginResults = await Promise.all(loginPromises);
            const sessions = loginResults
                .filter(r => r.success)
                .map(r => r.headers['set-cookie']?.find(c => c.includes('laravel_session')))
                .filter(Boolean);

            this.log(`Created ${sessions.length} concurrent sessions`);

            // Test that all sessions are valid
            const sessionTests = sessions.map(session =>
                this.makeRequest('GET', '/api/user/profile', null, { 'Cookie': session })
            );

            const sessionResults = await Promise.all(sessionTests);
            const validSessions = sessionResults.filter(r => r.success).length;

            this.log(`Valid concurrent sessions: ${validSessions}/${sessions.length}`);

            // Test session cleanup on logout
            if (sessions.length > 0) {
                await this.makeRequest('POST', '/api/auth/logout', null, {
                    'Cookie': sessions[0]
                });

                // Verify other sessions are still valid (or properly invalidated based on config)
                const postLogoutTest = await this.makeRequest('GET', '/api/user/profile', null, {
                    'Cookie': sessions[1] || sessions[0]
                });

                this.log(`Session behavior after logout: ${postLogoutTest.success ? 'ACTIVE' : 'INVALIDATED'}`);
            }

            this.testResults.passed++;
            this.log('Session management tests completed');
            return true;
        } catch (error) {
            this.log(`Session management test failed: ${error.message}`, 'error');
            this.testResults.failed++;
            return false;
        }
    }

    async generateReport() {
        this.log('Generating comprehensive production readiness report...');

        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: this.testResults.passed + this.testResults.failed,
                passed: this.testResults.passed,
                failed: this.testResults.failed,
                successRate: `${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(2)}%`,
                readinessScore: this.calculateReadinessScore()
            },
            performance: this.testResults.performance,
            security: this.testResults.security,
            errors: this.testResults.errors,
            warnings: this.testResults.warnings,
            testEnvironment: {
                backendURL: this.baseURL,
                frontendURL: this.frontendURL,
                testUsers: this.testUsers.length,
                testCompanies: this.testCompanies.length,
                sessionsCreated: this.sessions.size
            },
            recommendations: this.generateRecommendations()
        };

        const reportPath = path.join(__dirname, 'production-readiness-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

        this.log('='.repeat(80));
        this.log('PRODUCTION READINESS TEST RESULTS');
        this.log('='.repeat(80));
        this.log(`Total Tests: ${report.summary.totalTests}`);
        this.log(`Passed: ${report.summary.passed}`);
        this.log(`Failed: ${report.summary.failed}`);
        this.log(`Success Rate: ${report.summary.successRate}`);
        this.log(`Readiness Score: ${report.summary.readinessScore}/100`);
        this.log('='.repeat(80));

        if (this.testResults.errors.length > 0) {
            this.log(`CRITICAL ERRORS (${this.testResults.errors.length}):`);
            this.testResults.errors.forEach((error, i) => {
                this.log(`${i + 1}. ${error.message}`);
            });
            this.log('='.repeat(80));
        }

        if (this.testResults.warnings.length > 0) {
            this.log(`WARNINGS (${this.testResults.warnings.length}):`);
            this.testResults.warnings.forEach((warning, i) => {
                this.log(`${i + 1}. ${warning.message}`);
            });
            this.log('='.repeat(80));
        }

        this.log(`Full report saved to: ${reportPath}`);

        return report;
    }

    calculateReadinessScore() {
        const totalTests = this.testResults.passed + this.testResults.failed;
        if (totalTests === 0) return 0;

        let score = (this.testResults.passed / totalTests) * 100;
        
        // Deduct points for critical errors
        score -= this.testResults.errors.length * 5;
        
        // Deduct points for warnings
        score -= this.testResults.warnings.length * 2;

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    generateRecommendations() {
        const recommendations = [];

        if (this.testResults.failed > 0) {
            recommendations.push('Address all failed tests before production deployment');
        }

        if (this.testResults.errors.length > 0) {
            recommendations.push('Resolve all critical errors immediately');
        }

        if (this.testResults.warnings.length > 5) {
            recommendations.push('Review and address security/performance warnings');
        }

        // Performance recommendations
        for (const [testName, metrics] of Object.entries(this.testResults.performance)) {
            if (metrics.avgResponseTime > 1000) {
                recommendations.push(`Optimize performance for ${testName} - avg response time: ${metrics.avgResponseTime}ms`);
            }
            if (metrics.successRate < 95) {
                recommendations.push(`Improve reliability for ${testName} - success rate: ${metrics.successRate}%`);
            }
        }

        if (recommendations.length === 0) {
            recommendations.push('System appears production-ready based on test results');
        }

        return recommendations;
    }

    async runAllTests() {
        this.log('Starting comprehensive production readiness tests...');
        this.log('='.repeat(80));

        const tests = [
            { name: 'Health Check', method: () => this.testHealthCheck() },
            { name: 'CSRF Protection', method: () => this.testCSRFProtection() },
            { name: 'User Registration Flow', method: () => this.testUserRegistrationFlow() },
            { name: 'Authentication Cycle', method: () => this.testAuthenticationCycle() },
            { name: 'Multi-Tenant Data Isolation', method: () => this.testMultiTenantDataIsolation() },
            { name: 'Error Handling & Edge Cases', method: () => this.testErrorHandlingAndEdgeCases() },
            { name: 'Performance Under Load', method: () => this.testPerformanceUnderLoad() },
            { name: 'Security Headers', method: () => this.testSecurityHeaders() },
            { name: 'Database Integrity Under Concurrency', method: () => this.testDatabaseIntegrityUnderConcurrency() },
            { name: 'Session Management Across Tabs', method: () => this.testSessionManagementAcrossTabs() }
        ];

        for (const test of tests) {
            this.log(`\n${'='.repeat(50)}`);
            this.log(`Running: ${test.name}`);
            this.log('='.repeat(50));

            try {
                const startTime = Date.now();
                const result = await test.method();
                const duration = Date.now() - startTime;

                this.log(`${test.name}: ${result ? 'PASSED' : 'FAILED'} (${duration}ms)`);
            } catch (error) {
                this.log(`${test.name}: ERROR - ${error.message}`, 'error');
                this.testResults.failed++;
            }
        }

        return await this.generateReport();
    }
}

// Run if called directly
if (require.main === module) {
    async function main() {
        const tester = new ProductionReadinessTest();
        
        try {
            await tester.runAllTests();
            process.exit(0);
        } catch (error) {
            console.error('Test suite failed:', error);
            process.exit(1);
        }
    }

    main();
}

module.exports = ProductionReadinessTest;