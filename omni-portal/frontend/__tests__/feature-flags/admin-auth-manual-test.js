#!/usr/bin/env node

/**
 * Manual Admin Authentication Test
 * 
 * Direct testing of authentication flow with actual HTTP responses
 * Tests the complete admin authentication and authorization pipeline
 */

const https = require('https');
const http = require('http');

class ManualAuthTester {
    constructor() {
        this.baseUrl = 'http://localhost:8000';
        this.results = [];
    }

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
            req.setTimeout(10000);

            if (data) {
                req.write(JSON.stringify(data));
            }
            
            req.end();
        });
    }

    parseUrl(url) {
        const urlObj = new URL(url);
        return {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            protocol: urlObj.protocol
        };
    }

    log(message, data = null) {
        console.log(`${new Date().toISOString()} - ${message}`);
        if (data) {
            console.log('  Data:', JSON.stringify(data, null, 2));
        }
        this.results.push({
            timestamp: new Date().toISOString(),
            message,
            data
        });
    }

    async testStep(stepName, testFunction) {
        console.log(`\n🧪 ${stepName}`);
        console.log('-'.repeat(50));
        
        try {
            const result = await testFunction();
            this.log(`✅ ${stepName} - SUCCESS`, result);
            return result;
        } catch (error) {
            this.log(`❌ ${stepName} - FAILED`, { error: error.message });
            throw error;
        }
    }

    async runTests() {
        console.log('🚀 Manual Admin Authentication Test Suite');
        console.log('=' .repeat(60));
        console.log(`Backend URL: ${this.baseUrl}`);
        console.log(`Test Start: ${new Date().toISOString()}\n`);

        let adminToken = null;
        let sessionCookies = null;

        // Test 1: Get CSRF Cookie first
        await this.testStep('Get CSRF Cookie', async () => {
            const options = {
                ...this.parseUrl(`${this.baseUrl}/sanctum/csrf-cookie`),
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            };

            const response = await this.makeRequest(options);
            
            if (response.headers['set-cookie']) {
                sessionCookies = response.headers['set-cookie'];
                console.log(`   CSRF Cookie received: ${sessionCookies.length} cookies`);
            }

            return {
                statusCode: response.statusCode,
                hasCookies: !!sessionCookies,
                cookieCount: sessionCookies ? sessionCookies.length : 0
            };
        });

        // Test 2: Admin Login
        await this.testStep('Admin User Login', async () => {
            const options = {
                ...this.parseUrl(`${this.baseUrl}/api/auth/login`),
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            // Add CSRF cookie if we have it
            if (sessionCookies) {
                options.headers['Cookie'] = sessionCookies.join('; ');
                
                // Extract XSRF token from cookies for header
                const xsrfCookie = sessionCookies.find(c => c.includes('XSRF-TOKEN'));
                if (xsrfCookie) {
                    const tokenMatch = xsrfCookie.match(/XSRF-TOKEN=([^;]+)/);
                    if (tokenMatch) {
                        options.headers['X-XSRF-TOKEN'] = decodeURIComponent(tokenMatch[1]);
                    }
                }
            }

            const loginData = {
                email: 'admin.test@example.com',
                password: 'admin123'
            };

            const response = await this.makeRequest(options, loginData);
            
            console.log(`   Login Status: ${response.statusCode}`);
            console.log(`   Response Data:`, response.data);
            
            if (response.data && response.data.success) {
                // Update session cookies if new ones are provided
                if (response.headers['set-cookie']) {
                    sessionCookies = [...(sessionCookies || []), ...response.headers['set-cookie']];
                }
                
                console.log(`   Login successful!`);
                console.log(`   User:`, response.data.user);
                
                return {
                    statusCode: response.statusCode,
                    success: true,
                    user: response.data.user,
                    hasNewCookies: !!response.headers['set-cookie']
                };
            }

            throw new Error(`Login failed: ${response.data ? response.data.message : 'Unknown error'}`);
        });

        // Test 3: Test Admin Dashboard Access
        await this.testStep('Admin Dashboard Access', async () => {
            const options = {
                ...this.parseUrl(`${this.baseUrl}/api/admin/dashboard`),
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            if (sessionCookies) {
                options.headers['Cookie'] = sessionCookies.join('; ');
            }

            const response = await this.makeRequest(options);
            
            console.log(`   Dashboard Access Status: ${response.statusCode}`);
            
            if (response.statusCode === 200 && response.data && response.data.success) {
                console.log(`   Dashboard data received:`, Object.keys(response.data.data || {}));
                return {
                    statusCode: response.statusCode,
                    success: true,
                    hasData: !!response.data.data,
                    permissions: response.data.permissions || [],
                    roleHierarchy: response.data.role_hierarchy || []
                };
            }

            throw new Error(`Dashboard access failed: Status ${response.statusCode}, Message: ${response.data ? response.data.message : 'Unknown'}`);
        });

        // Test 4: Test Admin User Management
        await this.testStep('Admin User Management Access', async () => {
            const options = {
                ...this.parseUrl(`${this.baseUrl}/api/admin/users`),
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            if (sessionCookies) {
                options.headers['Cookie'] = sessionCookies.join('; ');
            }

            const response = await this.makeRequest(options);
            
            console.log(`   User Management Status: ${response.statusCode}`);
            
            if (response.statusCode === 200 && response.data && response.data.success) {
                console.log(`   Users found: ${response.data.data ? response.data.data.length : 0}`);
                return {
                    statusCode: response.statusCode,
                    success: true,
                    userCount: response.data.data ? response.data.data.length : 0,
                    hasPagination: !!response.data.pagination
                };
            }

            throw new Error(`User management access failed: Status ${response.statusCode}`);
        });

        // Test 5: Test Role Management
        await this.testStep('Admin Role Management Access', async () => {
            const options = {
                ...this.parseUrl(`${this.baseUrl}/api/admin/roles`),
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            if (sessionCookies) {
                options.headers['Cookie'] = sessionCookies.join('; ');
            }

            const response = await this.makeRequest(options);
            
            console.log(`   Role Management Status: ${response.statusCode}`);
            
            if (response.statusCode === 200 && response.data && response.data.success) {
                console.log(`   Roles found: ${response.data.data ? response.data.data.length : 0}`);
                return {
                    statusCode: response.statusCode,
                    success: true,
                    roleCount: response.data.data ? response.data.data.length : 0,
                    hierarchyLevels: response.data.hierarchy_levels || {}
                };
            }

            throw new Error(`Role management access failed: Status ${response.statusCode}`);
        });

        // Test 6: Test System Health (Admin Only)
        await this.testStep('Admin System Health Access', async () => {
            const options = {
                ...this.parseUrl(`${this.baseUrl}/api/admin/system-health`),
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            if (sessionCookies) {
                options.headers['Cookie'] = sessionCookies.join('; ');
            }

            const response = await this.makeRequest(options);
            
            console.log(`   System Health Status: ${response.statusCode}`);
            
            if (response.statusCode === 200 && response.data && response.data.success) {
                console.log(`   System status: ${response.data.data ? response.data.data.status : 'unknown'}`);
                return {
                    statusCode: response.statusCode,
                    success: true,
                    systemStatus: response.data.data ? response.data.data.status : null,
                    uptime: response.data.data ? response.data.data.uptime : null
                };
            }

            throw new Error(`System health access failed: Status ${response.statusCode}`);
        });

        // Test 7: Test Unauthorized Access (without cookies)
        await this.testStep('Unauthorized Access Test', async () => {
            const options = {
                ...this.parseUrl(`${this.baseUrl}/api/admin/dashboard`),
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
                // Deliberately omit cookies
            };

            const response = await this.makeRequest(options);
            
            console.log(`   Unauthorized Access Status: ${response.statusCode}`);
            
            if (response.statusCode === 401 || response.statusCode === 403) {
                console.log(`   ✅ Correctly denied unauthorized access`);
                return {
                    statusCode: response.statusCode,
                    correctlyDenied: true,
                    message: response.data ? response.data.message : null
                };
            }

            throw new Error(`Expected 401/403 but got: ${response.statusCode}`);
        });

        // Test 8: Test Current User Info
        await this.testStep('Current User Authentication Info', async () => {
            const options = {
                ...this.parseUrl(`${this.baseUrl}/api/auth/user`),
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            if (sessionCookies) {
                options.headers['Cookie'] = sessionCookies.join('; ');
            }

            const response = await this.makeRequest(options);
            
            console.log(`   User Info Status: ${response.statusCode}`);
            
            if (response.statusCode === 200 && response.data) {
                const user = response.data.user || response.data;
                console.log(`   Authenticated User:`, {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    is_admin: user.is_admin,
                    role: user.role
                });
                
                return {
                    statusCode: response.statusCode,
                    success: true,
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        is_admin: user.is_admin,
                        role: user.role
                    }
                };
            }

            throw new Error(`User info access failed: Status ${response.statusCode}`);
        });

        console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
        console.log('=' .repeat(60));
        console.log('✅ Admin authentication flow is working correctly');
        console.log('✅ Role-based access control is functioning');
        console.log('✅ Admin middleware is protecting endpoints');
        console.log('✅ Unauthorized access is properly denied');
        
        return this.results;
    }
}

// Run the tests
const tester = new ManualAuthTester();
tester.runTests()
    .then(results => {
        console.log('\n📊 TEST SUMMARY');
        console.log('-'.repeat(30));
        console.log(`Total Steps: ${results.length}`);
        console.log(`Successful: ${results.filter(r => !r.data || !r.data.error).length}`);
        console.log(`Failed: ${results.filter(r => r.data && r.data.error).length}`);
        
        // Save results
        const fs = require('fs');
        const reportPath = '/Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/frontend/__tests__/feature-flags/manual-auth-test-results.json';
        fs.writeFileSync(reportPath, JSON.stringify({
            summary: {
                timestamp: new Date().toISOString(),
                totalSteps: results.length,
                successful: results.filter(r => !r.data || !r.data.error).length,
                failed: results.filter(r => r.data && r.data.error).length
            },
            results
        }, null, 2));
        
        console.log(`\n📁 Results saved to: ${reportPath}`);
        process.exit(0);
    })
    .catch(error => {
        console.error('\n💥 Test suite failed:', error.message);
        
        // Save error results
        const fs = require('fs');
        const errorPath = '/Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/frontend/__tests__/feature-flags/manual-auth-error-results.json';
        fs.writeFileSync(errorPath, JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString(),
            results: tester.results
        }, null, 2));
        
        console.log(`📁 Error results saved to: ${errorPath}`);
        process.exit(1);
    });