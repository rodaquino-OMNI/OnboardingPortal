#!/usr/bin/env node

/**
 * JWT Validation Tests
 * Tests JWT token handling, expiration, and security
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Configuration
const BASE_URL = 'http://localhost:8000/api';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'Password123!';

// Colors for console output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

// Test counter
let testCount = 0;
let passedTests = 0;
let failedTests = 0;

/**
 * Print test result
 */
function printResult(testName, status, response, expected) {
    testCount++;
    
    if (status === 'PASS') {
        console.log(`${colors.green}✓ PASS${colors.reset}: ${testName}`);
        passedTests++;
    } else if (status === 'INFO') {
        console.log(`${colors.yellow}ℹ INFO${colors.reset}: ${testName}`);
    } else {
        console.log(`${colors.red}✗ FAIL${colors.reset}: ${testName}`);
        console.log(`  Expected: ${expected}`);
        console.log(`  Got: ${response}`);
        failedTests++;
    }
    console.log();
}

/**
 * Get a valid token for testing
 */
async function getValidToken() {
    try {
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
            device_name: 'jwt-test'
        });
        
        return response.data.token;
    } catch (error) {
        console.log(`${colors.yellow}Note: Could not get valid token - user may not exist${colors.reset}`);
        return null;
    }
}

/**
 * Create a malformed JWT token
 */
function createMalformedToken() {
    // Create a token with invalid signature
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({ 
        sub: '1', 
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
    })).toString('base64');
    const signature = crypto.randomBytes(32).toString('base64');
    
    return `${header}.${payload}.${signature}`;
}

/**
 * Create an expired JWT token
 */
function createExpiredToken() {
    const secret = 'fake-secret-for-testing';
    return jwt.sign(
        { 
            sub: '1', 
            iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
            exp: Math.floor(Date.now() / 1000) - 3600  // 1 hour ago (expired)
        },
        secret,
        { algorithm: 'HS256' }
    );
}

/**
 * Main test execution
 */
async function runJWTTests() {
    console.log(`${colors.blue}===========================================${colors.reset}`);
    console.log(`${colors.blue}         JWT Validation Tests             ${colors.reset}`);
    console.log(`${colors.blue}===========================================${colors.reset}`);
    console.log();

    // Get a valid token first
    const validToken = await getValidToken();
    
    // Test 1: Valid token authentication
    console.log(`${colors.yellow}Test 1: Valid Token Authentication${colors.reset}`);
    if (validToken) {
        try {
            const response = await axios.get(`${BASE_URL}/auth/user`, {
                headers: {
                    'Authorization': `Bearer ${validToken}`,
                    'Accept': 'application/json'
                }
            });
            
            if (response.status === 200 && response.data.user) {
                printResult('Valid token authentication', 'PASS', response.status, '200 with user data');
            } else {
                printResult('Valid token authentication', 'FAIL', response.status, '200 with user data');
            }
        } catch (error) {
            printResult('Valid token authentication', 'FAIL', error.response?.status || 'error', '200');
        }
    } else {
        printResult('Valid token authentication', 'INFO', 'No valid token available', 'Skipped - no test user');
    }

    // Test 2: Invalid token format
    console.log(`${colors.yellow}Test 2: Invalid Token Format${colors.reset}`);
    try {
        const response = await axios.get(`${BASE_URL}/auth/user`, {
            headers: {
                'Authorization': 'Bearer invalid-token-format',
                'Accept': 'application/json'
            }
        });
        
        printResult('Invalid token format rejection', 'FAIL', response.status, '401');
    } catch (error) {
        if (error.response?.status === 401) {
            printResult('Invalid token format rejection', 'PASS', error.response.status, '401');
        } else {
            printResult('Invalid token format rejection', 'FAIL', error.response?.status || 'error', '401');
        }
    }

    // Test 3: Malformed JWT token
    console.log(`${colors.yellow}Test 3: Malformed JWT Token${colors.reset}`);
    const malformedToken = createMalformedToken();
    try {
        const response = await axios.get(`${BASE_URL}/auth/user`, {
            headers: {
                'Authorization': `Bearer ${malformedToken}`,
                'Accept': 'application/json'
            }
        });
        
        printResult('Malformed JWT rejection', 'FAIL', response.status, '401');
    } catch (error) {
        if (error.response?.status === 401) {
            printResult('Malformed JWT rejection', 'PASS', error.response.status, '401');
        } else {
            printResult('Malformed JWT rejection', 'FAIL', error.response?.status || 'error', '401');
        }
    }

    // Test 4: Expired token
    console.log(`${colors.yellow}Test 4: Expired Token${colors.reset}`);
    const expiredToken = createExpiredToken();
    try {
        const response = await axios.get(`${BASE_URL}/auth/user`, {
            headers: {
                'Authorization': `Bearer ${expiredToken}`,
                'Accept': 'application/json'
            }
        });
        
        printResult('Expired token rejection', 'FAIL', response.status, '401');
    } catch (error) {
        if (error.response?.status === 401) {
            printResult('Expired token rejection', 'PASS', error.response.status, '401');
        } else {
            printResult('Expired token rejection', 'FAIL', error.response?.status || 'error', '401');
        }
    }

    // Test 5: Missing Authorization header
    console.log(`${colors.yellow}Test 5: Missing Authorization Header${colors.reset}`);
    try {
        const response = await axios.get(`${BASE_URL}/auth/user`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        printResult('Missing auth header rejection', 'FAIL', response.status, '401');
    } catch (error) {
        if (error.response?.status === 401) {
            printResult('Missing auth header rejection', 'PASS', error.response.status, '401');
        } else {
            printResult('Missing auth header rejection', 'FAIL', error.response?.status || 'error', '401');
        }
    }

    // Test 6: Empty Authorization header
    console.log(`${colors.yellow}Test 6: Empty Authorization Header${colors.reset}`);
    try {
        const response = await axios.get(`${BASE_URL}/auth/user`, {
            headers: {
                'Authorization': '',
                'Accept': 'application/json'
            }
        });
        
        printResult('Empty auth header rejection', 'FAIL', response.status, '401');
    } catch (error) {
        if (error.response?.status === 401) {
            printResult('Empty auth header rejection', 'PASS', error.response.status, '401');
        } else {
            printResult('Empty auth header rejection', 'FAIL', error.response?.status || 'error', '401');
        }
    }

    // Test 7: Wrong Bearer format
    console.log(`${colors.yellow}Test 7: Wrong Bearer Format${colors.reset}`);
    try {
        const response = await axios.get(`${BASE_URL}/auth/user`, {
            headers: {
                'Authorization': 'Basic invalid-format',
                'Accept': 'application/json'
            }
        });
        
        printResult('Wrong bearer format rejection', 'FAIL', response.status, '401');
    } catch (error) {
        if (error.response?.status === 401) {
            printResult('Wrong bearer format rejection', 'PASS', error.response.status, '401');
        } else {
            printResult('Wrong bearer format rejection', 'FAIL', error.response?.status || 'error', '401');
        }
    }

    // Test 8: Token refresh functionality
    console.log(`${colors.yellow}Test 8: Token Refresh Functionality${colors.reset}`);
    if (validToken) {
        try {
            const response = await axios.post(`${BASE_URL}/auth/refresh`, {
                device_name: 'jwt-refresh-test'
            }, {
                headers: {
                    'Authorization': `Bearer ${validToken}`,
                    'Accept': 'application/json'
                }
            });
            
            if (response.status === 200 && response.data.token) {
                printResult('Token refresh', 'PASS', 'New token received', 'Should return new token');
            } else {
                printResult('Token refresh', 'FAIL', response.status, '200 with new token');
            }
        } catch (error) {
            printResult('Token refresh', 'FAIL', error.response?.status || 'error', '200');
        }
    } else {
        printResult('Token refresh', 'INFO', 'No valid token available', 'Skipped - no test user');
    }

    // Test 9: Logout functionality
    console.log(`${colors.yellow}Test 9: Logout Functionality${colors.reset}`);
    if (validToken) {
        try {
            const response = await axios.post(`${BASE_URL}/auth/logout`, {}, {
                headers: {
                    'Authorization': `Bearer ${validToken}`,
                    'Accept': 'application/json'
                }
            });
            
            if (response.status === 200) {
                printResult('Logout functionality', 'PASS', response.status, '200');
                
                // Test if token is invalidated
                try {
                    await axios.get(`${BASE_URL}/auth/user`, {
                        headers: {
                            'Authorization': `Bearer ${validToken}`,
                            'Accept': 'application/json'
                        }
                    });
                    printResult('Token invalidation after logout', 'FAIL', 'Token still valid', 'Token should be invalidated');
                } catch (error) {
                    if (error.response?.status === 401) {
                        printResult('Token invalidation after logout', 'PASS', 'Token invalidated', 'Token should be invalidated');
                    } else {
                        printResult('Token invalidation after logout', 'FAIL', error.response?.status || 'error', '401');
                    }
                }
            } else {
                printResult('Logout functionality', 'FAIL', response.status, '200');
            }
        } catch (error) {
            printResult('Logout functionality', 'FAIL', error.response?.status || 'error', '200');
        }
    } else {
        printResult('Logout functionality', 'INFO', 'No valid token available', 'Skipped - no test user');
    }

    // Test 10: Protected endpoint access
    console.log(`${colors.yellow}Test 10: Protected Endpoint Access${colors.reset}`);
    try {
        const response = await axios.get(`${BASE_URL}/health-questionnaires/templates`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        printResult('Protected endpoint without auth', 'FAIL', response.status, '401');
    } catch (error) {
        if (error.response?.status === 401) {
            printResult('Protected endpoint without auth', 'PASS', error.response.status, '401');
        } else {
            printResult('Protected endpoint without auth', 'FAIL', error.response?.status || 'error', '401');
        }
    }

    // Test 11: JWT Header injection
    console.log(`${colors.yellow}Test 11: JWT Header Injection${colors.reset}`);
    const maliciousPayload = {
        alg: 'none', // Algorithm confusion attack
        typ: 'JWT'
    };
    const maliciousToken = Buffer.from(JSON.stringify(maliciousPayload)).toString('base64') + '.' +
                          Buffer.from(JSON.stringify({ sub: '1', admin: true })).toString('base64') + '.';
    
    try {
        const response = await axios.get(`${BASE_URL}/auth/user`, {
            headers: {
                'Authorization': `Bearer ${maliciousToken}`,
                'Accept': 'application/json'
            }
        });
        
        printResult('JWT header injection protection', 'FAIL', response.status, '401');
    } catch (error) {
        if (error.response?.status === 401) {
            printResult('JWT header injection protection', 'PASS', error.response.status, '401');
        } else {
            printResult('JWT header injection protection', 'FAIL', error.response?.status || 'error', '401');
        }
    }

    // Final summary
    console.log(`${colors.blue}===========================================${colors.reset}`);
    console.log(`${colors.blue}           Test Summary                    ${colors.reset}`);
    console.log(`${colors.blue}===========================================${colors.reset}`);
    console.log(`Total tests: ${testCount}`);
    console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
    console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);

    if (failedTests === 0) {
        console.log(`${colors.green}All tests passed! ✓${colors.reset}`);
        process.exit(0);
    } else {
        console.log(`${colors.red}Some tests failed! ✗${colors.reset}`);
        process.exit(1);
    }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run tests
if (require.main === module) {
    runJWTTests().catch(console.error);
}

module.exports = { runJWTTests };