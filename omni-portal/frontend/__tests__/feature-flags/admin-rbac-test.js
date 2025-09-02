#!/usr/bin/env node

/**
 * Role-Based Access Control (RBAC) Testing Suite
 * 
 * This test specifically validates:
 * 1. Admin role detection and validation
 * 2. Unified role system (Spatie + Custom Admin roles)  
 * 3. Permission-based endpoint access
 * 4. Role hierarchy enforcement
 * 5. Admin middleware functionality
 * 
 * Tests different user roles and their access to admin endpoints.
 */

const https = require('https');
const http = require('http');

class RBACTester {
    constructor() {
        this.baseUrl = 'http://localhost:8000';
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            tests: []
        };
        
        // Test scenarios with different user types
        this.testUsers = [
            {
                name: 'Admin User',
                email: 'admin.test@example.com',
                password: 'admin123',
                expectedRole: 'admin',
                shouldHaveAdminAccess: true,
                token: null
            },
            {
                name: 'Regular User',
                email: 'regular.test@example.com', 
                password: 'regular123',
                expectedRole: 'user',
                shouldHaveAdminAccess: false,
                token: null
            }
        ];
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
            if (details.response.data) {
                if (details.response.data.message) {
                    console.log(`   Message: ${details.response.data.message}`);
                }
                if (details.response.data.error) {
                    console.log(`   Error: ${details.response.data.error}`);
                }
            }
        }
        
        return test;
    }

    /**
     * Create regular test user (non-admin)
     */
    async createRegularUser() {
        console.log('\n👤 Creating regular (non-admin) test user...');

        const createUserOptions = {
            ...this.parseUrl(`${this.baseUrl}/api/register/step1`),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Skip-CSRF-Protection': 'true'
            }
        };

        const userData = {
            name: 'Regular Test User',
            email: 'regular.test@example.com',
            password: 'regular123',
            password_confirmation: 'regular123',
            cpf: '12345678901'
        };

        try {
            const response = await this.makeRequest(createUserOptions, userData);
            
            const success = response.statusCode === 201 || response.statusCode === 200 || 
                           (response.data && response.data.success);
            
            return this.logTest('Regular user creation', success, {
                response: {
                    statusCode: response.statusCode,
                    hasData: !!response.data,
                    success: response.data ? response.data.success : false
                }
            });

        } catch (error) {
            return this.logTest('Regular user creation', false, {
                error: error.message
            });
        }
    }

    /**
     * Login user and get authentication token/session
     */
    async loginUser(userConfig) {
        console.log(`\n🔐 Logging in ${userConfig.name}...`);

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
            email: userConfig.email,
            password: userConfig.password
        };

        try {
            const response = await this.makeRequest(loginOptions, loginData);
            
            if (response.statusCode === 200 && response.data && response.data.success) {
                // Extract token from response
                if (response.data.token) {
                    userConfig.token = response.data.token;
                } else if (response.headers['authorization']) {
                    userConfig.token = response.headers['authorization'].replace('Bearer ', '');
                } else if (response.headers['set-cookie']) {
                    // For session-based authentication
                    userConfig.sessionCookies = response.headers['set-cookie'];
                }

                // Extract user role information
                const userData = response.data.user || {};
                userConfig.actualRole = userData.role || 'unknown';
                userConfig.isAdmin = userData.is_admin || false;

                return this.logTest(`${userConfig.name} login`, true, {
                    response: {
                        statusCode: response.statusCode,
                        hasToken: !!userConfig.token,
                        hasCookies: !!userConfig.sessionCookies,
                        userRole: userConfig.actualRole,
                        isAdmin: userConfig.isAdmin
                    }
                });
            } else {
                return this.logTest(`${userConfig.name} login`, false, {
                    response,
                    expectedSuccess: true,
                    actualStatus: response.statusCode
                });
            }
        } catch (error) {
            return this.logTest(`${userConfig.name} login`, false, {
                error: error.message
            });
        }
    }

    /**
     * Test user access to specific admin endpoint
     */
    async testUserAdminAccess(userConfig, endpoint, expectedAccess = null) {
        const shouldHaveAccess = expectedAccess !== null ? expectedAccess : userConfig.shouldHaveAdminAccess;
        
        const options = {
            ...this.parseUrl(`${this.baseUrl}${endpoint}`),
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        };

        // Add authentication
        if (userConfig.token) {
            options.headers['Authorization'] = `Bearer ${userConfig.token}`;
        } else if (userConfig.sessionCookies) {
            options.headers['Cookie'] = userConfig.sessionCookies.join('; ');
        }

        try {
            const response = await this.makeRequest(options);
            
            const hasAccess = response.statusCode === 200;
            const testPassed = hasAccess === shouldHaveAccess;
            
            const testName = `${userConfig.name} access to ${endpoint}`;
            
            return this.logTest(testName, testPassed, {
                user: userConfig.name,
                endpoint,
                expectedAccess: shouldHaveAccess,
                actualAccess: hasAccess,
                response: {
                    statusCode: response.statusCode,
                    message: response.data ? response.data.message || response.data.error : null
                },
                accessCorrect: testPassed
            });

        } catch (error) {
            return this.logTest(`${userConfig.name} access to ${endpoint}`, false, {
                user: userConfig.name,
                endpoint,
                error: error.message
            });
        }
    }

    /**
     * Test admin middleware functionality
     */
    async testAdminMiddleware() {
        console.log('\n🛡️  Testing Admin Middleware Protection...');

        const criticalAdminEndpoints = [
            { path: '/api/admin/dashboard', name: 'Dashboard', critical: true },
            { path: '/api/admin/users', name: 'User Management', critical: true },
            { path: '/api/admin/roles', name: 'Role Management', critical: true },
            { path: '/api/admin/security-audit', name: 'Security Audit', critical: true },
            { path: '/api/admin/system-settings', name: 'System Settings', critical: true }
        ];

        const testResults = [];

        for (const endpoint of criticalAdminEndpoints) {
            for (const user of this.testUsers) {
                const result = await this.testUserAdminAccess(user, endpoint.path);
                testResults.push({
                    endpoint: endpoint.name,
                    user: user.name,
                    result
                });
            }
        }

        return testResults;
    }

    /**
     * Test role hierarchy and permission levels
     */
    async testRoleHierarchy() {
        console.log('\n📊 Testing Role Hierarchy...');

        // Test getting current user info to verify role detection
        for (const user of this.testUsers) {
            if (!user.token && !user.sessionCookies) continue;

            const options = {
                ...this.parseUrl(`${this.baseUrl}/api/auth/user`),
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            };

            // Add authentication
            if (user.token) {
                options.headers['Authorization'] = `Bearer ${user.token}`;
            } else if (user.sessionCookies) {
                options.headers['Cookie'] = user.sessionCookies.join('; ');
            }

            try {
                const response = await this.makeRequest(options);
                
                if (response.statusCode === 200 && response.data) {
                    const userData = response.data.user || response.data;
                    const detectedAdmin = userData.is_admin || userData.role === 'admin' || userData.role === 'super_admin';
                    
                    const roleDetectionCorrect = detectedAdmin === user.shouldHaveAdminAccess;
                    
                    this.logTest(`Role detection for ${user.name}`, roleDetectionCorrect, {
                        user: user.name,
                        expectedAdmin: user.shouldHaveAdminAccess,
                        detectedAdmin,
                        userRole: userData.role,
                        isAdmin: userData.is_admin
                    });
                }

            } catch (error) {
                this.logTest(`Role detection for ${user.name}`, false, {
                    error: error.message
                });
            }
        }
    }

    /**
     * Test unified role system (Spatie + Custom Admin roles)
     */
    async testUnifiedRoleSystem() {
        console.log('\n🔄 Testing Unified Role System...');

        // Get admin user's role information
        const adminUser = this.testUsers.find(u => u.shouldHaveAdminAccess);
        if (!adminUser || (!adminUser.token && !adminUser.sessionCookies)) {
            return this.logTest('Unified role system test', false, {
                reason: 'No authenticated admin user available'
            });
        }

        const options = {
            ...this.parseUrl(`${this.baseUrl}/api/admin/roles`),
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        };

        if (adminUser.token) {
            options.headers['Authorization'] = `Bearer ${adminUser.token}`;
        } else if (adminUser.sessionCookies) {
            options.headers['Cookie'] = adminUser.sessionCookies.join('; ');
        }

        try {
            const response = await this.makeRequest(options);
            
            const hasRoleData = response.statusCode === 200 && response.data && response.data.data;
            
            return this.logTest('Unified role system access', hasRoleData, {
                response: {
                    statusCode: response.statusCode,
                    hasRoleData,
                    roleCount: hasRoleData ? response.data.data.length : 0,
                    hierarchyLevels: response.data ? response.data.hierarchy_levels : null
                }
            });

        } catch (error) {
            return this.logTest('Unified role system access', false, {
                error: error.message
            });
        }
    }

    /**
     * Test specific permission-based access
     */
    async testPermissionBasedAccess() {
        console.log('\n🔐 Testing Permission-Based Access...');

        const permissionEndpoints = [
            { 
                path: '/api/admin/analytics', 
                name: 'Analytics',
                requiredPermission: 'analytics.view'
            },
            { 
                path: '/api/admin/system-health', 
                name: 'System Health',
                requiredPermission: 'system.view'
            },
            { 
                path: '/api/admin/permissions', 
                name: 'Permissions',
                requiredPermission: 'permissions.view'
            }
        ];

        const testResults = [];

        for (const endpoint of permissionEndpoints) {
            // Test with admin user (should have access)
            const adminUser = this.testUsers.find(u => u.shouldHaveAdminAccess);
            if (adminUser) {
                const result = await this.testUserAdminAccess(adminUser, endpoint.path, true);
                testResults.push({
                    endpoint: endpoint.name,
                    permission: endpoint.requiredPermission,
                    user: 'Admin',
                    result
                });
            }

            // Test with regular user (should not have access)
            const regularUser = this.testUsers.find(u => !u.shouldHaveAdminAccess);
            if (regularUser) {
                const result = await this.testUserAdminAccess(regularUser, endpoint.path, false);
                testResults.push({
                    endpoint: endpoint.name,
                    permission: endpoint.requiredPermission,
                    user: 'Regular',
                    result
                });
            }
        }

        return testResults;
    }

    /**
     * Generate RBAC test report
     */
    generateReport() {
        console.log('\n📊 RBAC TEST REPORT');
        console.log('=' .repeat(50));
        console.log(`Total Tests: ${this.results.total}`);
        console.log(`Passed: ${this.results.passed}`);
        console.log(`Failed: ${this.results.failed}`);
        console.log(`Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);

        console.log('\nUser Authentication Summary:');
        console.log('-'.repeat(30));
        this.testUsers.forEach(user => {
            const status = user.token || user.sessionCookies ? '✅ Authenticated' : '❌ Not Authenticated';
            console.log(`${user.name}: ${status}`);
            console.log(`  Expected Role: ${user.expectedRole}`);
            console.log(`  Actual Role: ${user.actualRole || 'Unknown'}`);
            console.log(`  Is Admin: ${user.isAdmin ? 'Yes' : 'No'}`);
            console.log(`  Should Have Admin Access: ${user.shouldHaveAdminAccess ? 'Yes' : 'No'}`);
        });

        console.log('\nDetailed Test Results:');
        console.log('-'.repeat(30));
        this.results.tests.forEach((test, index) => {
            console.log(`${index + 1}. ${test.name}: ${test.passed ? '✅ PASS' : '❌ FAIL'}`);
            
            if (test.details.user && test.details.endpoint) {
                console.log(`   User: ${test.details.user}`);
                console.log(`   Endpoint: ${test.details.endpoint}`);
                console.log(`   Expected Access: ${test.details.expectedAccess ? 'Yes' : 'No'}`);
                console.log(`   Actual Access: ${test.details.actualAccess ? 'Yes' : 'No'}`);
            }
            
            if (test.details.response) {
                console.log(`   HTTP Status: ${test.details.response.statusCode}`);
                if (test.details.response.message) {
                    console.log(`   Message: ${test.details.response.message}`);
                }
            }
            
            if (test.details.error) {
                console.log(`   Error: ${test.details.error}`);
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
            users: this.testUsers,
            tests: this.results.tests,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Run all RBAC tests
     */
    async runAllTests() {
        console.log('🚀 Starting RBAC Test Suite');
        console.log('Backend URL:', this.baseUrl);
        console.log('Timestamp:', new Date().toISOString());

        try {
            // Step 1: Setup admin user (should already exist)
            console.log('\n🔧 Setting up admin user...');
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

            // Step 2: Create regular user
            await this.createRegularUser();

            // Step 3: Login all test users
            for (const user of this.testUsers) {
                await this.loginUser(user);
            }

            // Step 4: Test admin middleware
            await this.testAdminMiddleware();

            // Step 5: Test role hierarchy
            await this.testRoleHierarchy();

            // Step 6: Test unified role system
            await this.testUnifiedRoleSystem();

            // Step 7: Test permission-based access
            await this.testPermissionBasedAccess();

            // Generate final report
            const report = this.generateReport();

            // Save results to file
            const fs = require('fs');
            const reportPath = '/Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/frontend/__tests__/feature-flags/rbac-test-results.json';
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
            
            console.log(`\n📁 Full RBAC test results saved to: ${reportPath}`);

            return report;

        } catch (error) {
            console.error('\n💥 RBAC test suite error:', error.message);
            this.logTest('RBAC Test Suite Execution', false, { error: error.message });
            return this.generateReport();
        }
    }
}

// Run the tests if this file is executed directly
if (require.main === module) {
    const tester = new RBACTester();
    tester.runAllTests()
        .then(report => {
            console.log('\n✅ RBAC test suite completed');
            process.exit(report.summary.failed > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('\n💥 RBAC test suite failed:', error.message);
            process.exit(1);
        });
}

module.exports = RBACTester;