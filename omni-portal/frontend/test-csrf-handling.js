#!/usr/bin/env node

/**
 * CSRF Token Handling Test
 * Specifically tests CSRF token extraction and usage
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class CSRFTester {
    constructor() {
        this.frontendUrl = 'http://localhost:3001';
        this.backendUrl = 'http://localhost:8000';
        this.cookies = new Map();
    }

    async test() {
        console.log('🔐 Testing CSRF Token Handling');
        console.log('═══════════════════════════════════════');

        try {
            await this.getCSRFCookie();
            await this.testTokenExtraction();
            await this.testLoginWithCSRF();
        } catch (error) {
            console.error('❌ CSRF test failed:', error.message);
        }
    }

    async getCSRFCookie() {
        console.log('\n1️⃣ Getting CSRF Cookie');
        
        const response = await this.makeRequest(
            `${this.backendUrl}/sanctum/csrf-cookie`,
            'GET',
            {
                'Origin': this.frontendUrl,
                'Referer': this.frontendUrl,
                'Accept': 'application/json'
            }
        );

        console.log(`Response status: ${response.statusCode}`);
        console.log(`Headers:`, response.headers);

        if (response.headers['set-cookie']) {
            this.storeCookies(response.headers['set-cookie']);
            console.log('✅ Cookies stored');
            
            // Log stored cookies
            console.log('Stored cookies:');
            this.cookies.forEach((value, key) => {
                console.log(`  ${key}: ${value.substring(0, 20)}...`);
            });
        }
    }

    async testTokenExtraction() {
        console.log('\n2️⃣ Testing Token Extraction');
        
        // Check if we have XSRF-TOKEN
        const xsrfToken = this.cookies.get('XSRF-TOKEN');
        if (xsrfToken) {
            console.log('✅ XSRF-TOKEN found in cookies');
            console.log(`Token preview: ${xsrfToken.substring(0, 20)}...`);
            
            // Decode the token (Laravel encodes it)
            try {
                const decoded = decodeURIComponent(xsrfToken);
                console.log(`Decoded length: ${decoded.length}`);
                console.log(`Decoded preview: ${decoded.substring(0, 20)}...`);
            } catch (error) {
                console.log('❌ Failed to decode token:', error.message);
            }
        } else {
            console.log('❌ No XSRF-TOKEN found in cookies');
            console.log('Available cookies:', Array.from(this.cookies.keys()));
        }
    }

    async testLoginWithCSRF() {
        console.log('\n3️⃣ Testing Login with CSRF Token');
        
        const xsrfToken = this.cookies.get('XSRF-TOKEN');
        if (!xsrfToken) {
            console.log('❌ No CSRF token available for login test');
            return;
        }

        const loginData = {
            email: 'test@example.com',
            password: 'testpassword'
        };

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Origin': this.frontendUrl,
            'Referer': `${this.frontendUrl}/login`,
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': decodeURIComponent(xsrfToken),
            'Cookie': this.getCookieHeader()
        };

        console.log('Request headers:');
        Object.entries(headers).forEach(([key, value]) => {
            if (key === 'X-CSRF-TOKEN') {
                console.log(`  ${key}: ${value.substring(0, 20)}...`);
            } else {
                console.log(`  ${key}: ${value}`);
            }
        });

        const response = await this.makeRequest(
            `${this.backendUrl}/api/auth/login`,
            'POST',
            headers,
            JSON.stringify(loginData)
        );

        console.log(`\nLogin response status: ${response.statusCode}`);
        
        if (response.statusCode === 419) {
            console.log('❌ Still getting 419 - CSRF mismatch');
            console.log('Response body:', response.body);
        } else if (response.statusCode === 422) {
            console.log('✅ CSRF working - got validation error (expected)');
        } else if (response.statusCode === 401) {
            console.log('✅ CSRF working - got auth error (expected)');
        } else {
            console.log(`Response: ${response.statusCode} - ${response.body}`);
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

            req.on('error', reject);
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

const tester = new CSRFTester();
tester.test().catch(console.error);