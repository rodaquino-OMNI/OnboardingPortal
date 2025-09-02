#!/usr/bin/env node

/**
 * CRITICAL PRODUCTION ISSUES INVESTIGATION
 * Focuses on the specific failures found in comprehensive testing
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class CriticalIssuesTest {
    constructor() {
        this.baseURL = 'http://localhost:8000';
        this.results = {
            issues: [],
            fixes: [],
            blockers: []
        };
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type.toUpperCase().padEnd(7);
        console.log(`[${timestamp}] ${prefix} ${message}`);
    }

    async makeRequest(method, endpoint, data = null, headers = {}) {
        try {
            const config = {
                method,
                url: `${this.baseURL}${endpoint}`,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...headers
                },
                withCredentials: true,
                timeout: 5000
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

    async investigateIssue1_MissingDatabaseHealthRoute() {
        this.log('ISSUE #1: Missing Database Health Route');
        
        // Test current health endpoint
        const healthResponse = await this.makeRequest('GET', '/api/health');
        this.log(`Current health endpoint status: ${healthResponse.status}`);
        
        // Test if database health route exists
        const dbHealthResponse = await this.makeRequest('GET', '/api/health/database');
        this.log(`Database health endpoint status: ${dbHealthResponse.status}`);
        
        if (!dbHealthResponse.success || dbHealthResponse.status === 404) {
            this.results.issues.push({
                id: 'MISSING_DB_HEALTH_ROUTE',
                severity: 'HIGH',
                description: 'Database health check endpoint is missing',
                impact: 'Cannot verify database connectivity in production monitoring',
                recommendation: 'Add /api/health/database route to verify DB connectivity'
            });
        }

        return dbHealthResponse.success;
    }

    async investigateIssue2_MissingCompanyRegistration() {
        this.log('ISSUE #2: Missing Company Registration Endpoints');
        
        // Test company creation endpoint
        const createCompanyResponse = await this.makeRequest('POST', '/api/companies', {
            name: 'Test Company',
            domain: 'test.com'
        });
        
        this.log(`Company creation endpoint status: ${createCompanyResponse.status}`);
        
        if (createCompanyResponse.status === 405 || createCompanyResponse.status === 404) {
            this.results.issues.push({
                id: 'MISSING_COMPANY_ROUTES',
                severity: 'HIGH',
                description: 'Company management endpoints are missing',
                impact: 'Cannot create companies for multi-tenant testing',
                recommendation: 'Add company CRUD routes for multi-tenant functionality'
            });
        }

        return createCompanyResponse.success;
    }

    async investigateIssue3_MissingUserRegistration() {
        this.log('ISSUE #3: User Registration Route Issues');
        
        // Test direct registration endpoint
        const directRegResponse = await this.makeRequest('POST', '/api/auth/register', {
            name: 'Test User',
            email: 'test@example.com',
            password: 'password123',
            password_confirmation: 'password123'
        });
        
        this.log(`Direct registration endpoint status: ${directRegResponse.status}`);
        
        // Test multi-step registration
        const step1Response = await this.makeRequest('POST', '/api/register/step1', {
            name: 'Test User',
            email: 'test@example.com'
        });
        
        this.log(`Step 1 registration status: ${step1Response.status}`);
        
        if (directRegResponse.status === 405 || directRegResponse.status === 404) {
            if (step1Response.success) {
                this.results.fixes.push({
                    id: 'USE_MULTISTEP_REGISTRATION',
                    description: 'Use multi-step registration API instead of direct /api/auth/register',
                    routes: ['/api/register/step1', '/api/register/step2', '/api/register/step3']
                });
            } else {
                this.results.blockers.push({
                    id: 'NO_USER_REGISTRATION',
                    severity: 'CRITICAL',
                    description: 'No working user registration endpoint found',
                    impact: 'Cannot register new users'
                });
            }
        }

        return step1Response.success || directRegResponse.success;
    }

    async investigateIssue4_CSRFTokenIssues() {
        this.log('ISSUE #4: CSRF Token Handling Issues');
        
        // Get CSRF token
        const csrfResponse = await this.makeRequest('GET', '/sanctum/csrf-cookie');
        this.log(`CSRF token endpoint status: ${csrfResponse.status}`);
        
        if (!csrfResponse.success) {
            this.results.blockers.push({
                id: 'CSRF_TOKEN_FAILURE',
                severity: 'CRITICAL',
                description: 'Cannot obtain CSRF tokens',
                impact: 'All POST requests will fail with 419 errors'
            });
            return false;
        }

        // Extract CSRF token from response
        const cookies = csrfResponse.headers['set-cookie'] || [];
        const xsrfCookie = cookies.find(cookie => cookie.includes('XSRF-TOKEN'));
        
        if (!xsrfCookie) {
            this.results.issues.push({
                id: 'CSRF_TOKEN_NOT_SET',
                severity: 'HIGH',
                description: 'CSRF token not properly set in cookies',
                impact: 'Frontend cannot extract CSRF token for API calls'
            });
            return false;
        }

        // Test CSRF token usage
        const csrfToken = decodeURIComponent(xsrfCookie.split('XSRF-TOKEN=')[1].split(';')[0]);
        const testResponse = await this.makeRequest('POST', '/api/test/validation', {
            test: 'csrf'
        }, {
            'X-XSRF-TOKEN': csrfToken,
            'Cookie': xsrfCookie
        });

        this.log(`CSRF validation test status: ${testResponse.status}`);
        
        return testResponse.success;
    }

    async investigateIssue5_AuthenticationMiddleware() {
        this.log('ISSUE #5: Authentication Middleware Configuration');
        
        // Test protected endpoint without authentication
        const protectedResponse = await this.makeRequest('GET', '/api/profile');
        this.log(`Protected endpoint (no auth) status: ${protectedResponse.status}`);
        
        if (protectedResponse.status !== 401 && protectedResponse.status !== 403) {
            this.results.issues.push({
                id: 'WEAK_AUTH_PROTECTION',
                severity: 'HIGH',
                description: 'Protected endpoints not properly secured',
                impact: 'Unauthorized access to protected resources'
            });
        }

        // Test with authentication using step-based registration
        const step1Response = await this.makeRequest('POST', '/api/register/step1', {
            name: 'Auth Test User',
            email: 'authtest@example.com'
        });

        if (step1Response.success) {
            this.log('Successfully created test user for auth testing');
            return true;
        }

        return false;
    }

    async investigateIssue6_ProductionConfiguration() {
        this.log('ISSUE #6: Production Configuration Issues');
        
        const configIssues = [];
        
        // Check if debug mode is enabled
        try {
            const debugResponse = await this.makeRequest('GET', '/api/test/error');
            if (debugResponse.data && debugResponse.data.trace) {
                configIssues.push({
                    issue: 'DEBUG_MODE_ENABLED',
                    description: 'Debug mode is enabled, exposing stack traces',
                    severity: 'HIGH'
                });
            }
        } catch (error) {
            // Debug endpoint might not exist, which is good
        }
        
        // Check security headers
        const healthResponse = await this.makeRequest('GET', '/api/health');
        if (healthResponse.headers) {
            const requiredHeaders = [
                'x-frame-options',
                'x-content-type-options',
                'x-xss-protection'
            ];
            
            const missingHeaders = requiredHeaders.filter(header => 
                !healthResponse.headers[header]
            );
            
            if (missingHeaders.length > 0) {
                configIssues.push({
                    issue: 'MISSING_SECURITY_HEADERS',
                    description: `Missing headers: ${missingHeaders.join(', ')}`,
                    severity: 'MEDIUM'
                });
            }
        }

        if (configIssues.length > 0) {
            this.results.issues.push(...configIssues);
        }

        return configIssues.length === 0;
    }

    async generateFixPlan() {
        this.log('Generating Production Fix Plan...');
        
        const fixPlan = {
            criticalBlockers: this.results.blockers,
            highPriorityIssues: this.results.issues.filter(i => i.severity === 'HIGH'),
            mediumPriorityIssues: this.results.issues.filter(i => i.severity === 'MEDIUM'),
            immediateFixes: this.results.fixes,
            implementationOrder: [
                'Fix CSRF token handling',
                'Add missing database health route',
                'Add company management endpoints',
                'Fix user registration flow',
                'Configure production security headers',
                'Disable debug mode'
            ]
        };

        const reportPath = path.join(__dirname, 'critical-issues-fix-plan.json');
        await fs.writeFile(reportPath, JSON.stringify(fixPlan, null, 2));
        
        this.log('='.repeat(80));
        this.log('CRITICAL PRODUCTION ISSUES SUMMARY');
        this.log('='.repeat(80));
        this.log(`Critical Blockers: ${fixPlan.criticalBlockers.length}`);
        this.log(`High Priority Issues: ${fixPlan.highPriorityIssues.length}`);
        this.log(`Medium Priority Issues: ${fixPlan.mediumPriorityIssues.length}`);
        this.log(`Available Fixes: ${fixPlan.immediateFixes.length}`);
        this.log('='.repeat(80));
        
        if (fixPlan.criticalBlockers.length > 0) {
            this.log('CRITICAL BLOCKERS (MUST FIX BEFORE PRODUCTION):');
            fixPlan.criticalBlockers.forEach((blocker, i) => {
                this.log(`${i + 1}. ${blocker.description}`);
                this.log(`   Impact: ${blocker.impact}`);
            });
            this.log('='.repeat(80));
        }
        
        if (fixPlan.highPriorityIssues.length > 0) {
            this.log('HIGH PRIORITY ISSUES:');
            fixPlan.highPriorityIssues.forEach((issue, i) => {
                this.log(`${i + 1}. ${issue.description}`);
                this.log(`   Recommendation: ${issue.recommendation}`);
            });
            this.log('='.repeat(80));
        }
        
        this.log(`Full fix plan saved to: ${reportPath}`);
        
        return fixPlan;
    }

    async runInvestigation() {
        this.log('Starting Critical Production Issues Investigation');
        this.log('='.repeat(80));
        
        const investigations = [
            { name: 'Database Health Route', method: () => this.investigateIssue1_MissingDatabaseHealthRoute() },
            { name: 'Company Registration', method: () => this.investigateIssue2_MissingCompanyRegistration() },
            { name: 'User Registration', method: () => this.investigateIssue3_MissingUserRegistration() },
            { name: 'CSRF Token Handling', method: () => this.investigateIssue4_CSRFTokenIssues() },
            { name: 'Authentication Middleware', method: () => this.investigateIssue5_AuthenticationMiddleware() },
            { name: 'Production Configuration', method: () => this.investigateIssue6_ProductionConfiguration() }
        ];

        for (const investigation of investigations) {
            this.log(`\n${'='.repeat(50)}`);
            this.log(`Investigating: ${investigation.name}`);
            this.log('='.repeat(50));

            try {
                const result = await investigation.method();
                this.log(`${investigation.name}: ${result ? 'OK' : 'ISSUES FOUND'}`);
            } catch (error) {
                this.log(`${investigation.name}: ERROR - ${error.message}`, 'error');
            }
        }

        return await this.generateFixPlan();
    }
}

// Run if called directly
if (require.main === module) {
    async function main() {
        const investigator = new CriticalIssuesTest();
        
        try {
            await investigator.runInvestigation();
            process.exit(0);
        } catch (error) {
            console.error('Investigation failed:', error);
            process.exit(1);
        }
    }

    main();
}

module.exports = CriticalIssuesTest;