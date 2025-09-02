#!/usr/bin/env node

/**
 * Authentication Flow Tester - Final Integration Test
 * Tests complete authentication flow with port 3001 frontend
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class AuthenticationFlowTester {
    constructor() {
        this.frontendUrl = 'http://localhost:3001';
        this.backendUrl = 'http://localhost:8000';
        this.results = [];
        this.cookies = new Map();
    }

    async test() {
        console.log('🚀 Starting Authentication Flow Test');
        console.log(`Frontend: ${this.frontendUrl}`);
        console.log(`Backend: ${this.backendUrl}`);
        console.log('═══════════════════════════════════════════════');

        try {
            await this.testFrontendHealth();
            await this.testBackendHealth();
            await this.testCORSConfiguration();
            await this.testCSRFCookie();
            await this.testLoginEndpoint();
            await this.testAuthenticationHeaders();
            await this.generateReport();
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            process.exit(1);
        }
    }

    async testFrontendHealth() {
        console.log('\n1️⃣ Testing Frontend Health (localhost:3001)');
        
        try {
            const response = await this.makeRequest(`${this.frontendUrl}/`, 'GET');
            
            if (response.statusCode === 200) {
                console.log('✅ Frontend is running on localhost:3001');
                this.results.push({
                    test: 'Frontend Health',
                    status: 'PASS',
                    details: `Frontend responding on port 3001`
                });
            } else {
                throw new Error(`Frontend returned status ${response.statusCode}`);
            }
        } catch (error) {
            console.log('❌ Frontend health check failed:', error.message);
            this.results.push({
                test: 'Frontend Health',
                status: 'FAIL',
                details: error.message
            });
            throw error;
        }
    }

    async testBackendHealth() {
        console.log('\n2️⃣ Testing Backend Health (localhost:8000)');
        
        try {
            const response = await this.makeRequest(`${this.backendUrl}/api/health`, 'GET');
            
            if (response.statusCode === 200) {
                console.log('✅ Backend API is responding');
                this.results.push({
                    test: 'Backend Health',
                    status: 'PASS',
                    details: 'Backend API responding correctly'
                });
            } else {
                throw new Error(`Backend returned status ${response.statusCode}`);
            }
        } catch (error) {
            console.log('❌ Backend health check failed:', error.message);
            this.results.push({
                test: 'Backend Health',
                status: 'FAIL',
                details: error.message
            });
        }
    }

    async testCORSConfiguration() {
        console.log('\n3️⃣ Testing CORS Configuration');
        
        try {
            const response = await this.makeRequest(`${this.backendUrl}/api/health`, 'OPTIONS', {
                'Origin': this.frontendUrl,
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'Content-Type, Authorization'
            });

            const corsHeader = response.headers['access-control-allow-origin'];
            
            if (corsHeader === this.frontendUrl || corsHeader === '*') {
                console.log('✅ CORS configured correctly for localhost:3001');
                console.log(`   Origin allowed: ${corsHeader}`);
                this.results.push({
                    test: 'CORS Configuration',
                    status: 'PASS',
                    details: `CORS allows origin: ${corsHeader}`
                });
            } else {
                throw new Error(`CORS not configured for localhost:3001. Got: ${corsHeader}`);
            }
        } catch (error) {
            console.log('❌ CORS test failed:', error.message);
            this.results.push({
                test: 'CORS Configuration',
                status: 'FAIL',
                details: error.message
            });
        }
    }

    async testCSRFCookie() {
        console.log('\n4️⃣ Testing CSRF Cookie from Frontend');
        
        try {
            // Test CSRF cookie endpoint
            const response = await this.makeRequest(
                `${this.backendUrl}/sanctum/csrf-cookie`, 
                'GET',
                {
                    'Origin': this.frontendUrl,
                    'Referer': this.frontendUrl
                }
            );

            if (response.statusCode === 204) {
                console.log('✅ CSRF cookie endpoint accessible');
                
                // Check for CSRF cookie
                const cookies = response.headers['set-cookie'];
                if (cookies) {
                    const csrfCookie = cookies.find(cookie => 
                        cookie.includes('XSRF-TOKEN') || cookie.includes('laravel_session')
                    );
                    
                    if (csrfCookie) {
                        console.log('✅ CSRF cookie set successfully');
                        // Store cookie for future requests
                        this.storeCookies(cookies);
                        
                        this.results.push({
                            test: 'CSRF Cookie',
                            status: 'PASS',
                            details: 'CSRF cookie retrieved and stored'
                        });
                    } else {
                        throw new Error('CSRF cookie not found in response');
                    }
                } else {
                    throw new Error('No cookies in CSRF response');
                }
            } else {
                throw new Error(`CSRF endpoint returned status ${response.statusCode}`);
            }
        } catch (error) {
            console.log('❌ CSRF cookie test failed:', error.message);
            this.results.push({
                test: 'CSRF Cookie',
                status: 'FAIL',
                details: error.message
            });
        }
    }

    async testLoginEndpoint() {
        console.log('\n5️⃣ Testing Login Endpoint');
        
        try {
            const loginData = {
                email: 'test@example.com',
                password: 'testpassword'
            };

            const headers = {
                'Content-Type': 'application/json',
                'Origin': this.frontendUrl,
                'Referer': `${this.frontendUrl}/login`,
                'X-Requested-With': 'XMLHttpRequest'
            };

            // Add stored cookies
            const cookieHeader = this.getCookieHeader();
            if (cookieHeader) {
                headers['Cookie'] = cookieHeader;
            }

            const response = await this.makeRequest(
                `${this.backendUrl}/api/auth/login`,
                'POST',
                headers,
                JSON.stringify(loginData)
            );

            // Even if login fails (no test user), endpoint should be accessible
            if (response.statusCode === 422 || response.statusCode === 401) {
                console.log('✅ Login endpoint accessible (validation error expected)');
                this.results.push({
                    test: 'Login Endpoint',
                    status: 'PASS',
                    details: `Endpoint accessible, returned ${response.statusCode} (expected for test data)`
                });
            } else if (response.statusCode === 200) {
                console.log('✅ Login endpoint working (unexpected success)');
                this.results.push({
                    test: 'Login Endpoint',
                    status: 'PASS',
                    details: 'Login succeeded unexpectedly'
                });
            } else {
                throw new Error(`Login endpoint returned unexpected status ${response.statusCode}`);
            }
        } catch (error) {
            console.log('❌ Login endpoint test failed:', error.message);
            this.results.push({
                test: 'Login Endpoint',
                status: 'FAIL',
                details: error.message
            });
        }
    }

    async testAuthenticationHeaders() {
        console.log('\n6️⃣ Testing Authentication Headers');
        
        try {
            const response = await this.makeRequest(
                `${this.backendUrl}/api/auth/user`,
                'GET',
                {
                    'Origin': this.frontendUrl,
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            );

            // Should return 401 for unauthenticated request
            if (response.statusCode === 401) {
                console.log('✅ Authentication properly enforced');
                this.results.push({
                    test: 'Authentication Headers',
                    status: 'PASS',
                    details: 'Unauthenticated requests properly rejected'
                });
            } else {
                console.log(`⚠️  Unexpected response: ${response.statusCode}`);
                this.results.push({
                    test: 'Authentication Headers',
                    status: 'WARN',
                    details: `Unexpected status: ${response.statusCode}`
                });
            }
        } catch (error) {
            console.log('❌ Authentication headers test failed:', error.message);
            this.results.push({
                test: 'Authentication Headers',
                status: 'FAIL',
                details: error.message
            });
        }
    }

    async generateReport() {
        console.log('\n📊 TEST RESULTS SUMMARY');
        console.log('═══════════════════════════════════════════════');
        
        let passed = 0;
        let failed = 0;
        let warned = 0;

        this.results.forEach(result => {
            const icon = result.status === 'PASS' ? '✅' : 
                        result.status === 'FAIL' ? '❌' : '⚠️';
            console.log(`${icon} ${result.test}: ${result.status}`);
            console.log(`   ${result.details}`);
            
            if (result.status === 'PASS') passed++;
            else if (result.status === 'FAIL') failed++;
            else warned++;
        });

        console.log('\n═══════════════════════════════════════════════');
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⚠️  Warnings: ${warned}`);
        
        if (failed === 0) {
            console.log('\n🎉 AUTHENTICATION FLOW READY FOR TESTING!');
            console.log(`👉 Visit ${this.frontendUrl}/login to test manually`);
        } else {
            console.log('\n🚨 ISSUES FOUND - PLEASE REVIEW');
        }
    }

    storeCookies(cookieArray) {
        cookieArray.forEach(cookie => {
            const parts = cookie.split(';')[0].split('=');
            if (parts.length === 2) {
                this.cookies.set(parts[0], parts[1]);
            }
        });
    }

    getCookieHeader() {
        const cookies = [];
        this.cookies.forEach((value, key) => {
            cookies.push(`${key}=${value}`);
        });
        return cookies.join('; ');
    }

    makeRequest(url, method, headers = {}, body = null) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const client = isHttps ? https : http;

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: method,
                headers: headers,
                timeout: 10000
            };

            const req = client.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data
                    });
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (body) {
                req.write(body);
            }

            req.end();
        });
    }
}

// Run the test
const tester = new AuthenticationFlowTester();
tester.test().catch(console.error);