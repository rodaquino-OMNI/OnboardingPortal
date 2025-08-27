/**
 * Comprehensive Form Validation and Security Test Suite
 * Tests form validation behavior and identifies security vulnerabilities
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class FormValidationTester {
    constructor() {
        this.baseURL = 'http://localhost:8000/api';
        this.results = [];
        this.vulnerabilities = [];
        this.testStats = {
            total: 0,
            passed: 0,
            failed: 0,
            warnings: 0,
            critical: 0
        };
    }

    // Logging and reporting methods
    log(level, test, message, details = {}) {
        const timestamp = new Date().toISOString();
        const result = {
            timestamp,
            level,
            test,
            message,
            details,
            httpStatus: details.status,
            responseTime: details.responseTime
        };

        this.results.push(result);
        this.testStats.total++;

        if (level === 'CRITICAL') {
            this.vulnerabilities.push(result);
            this.testStats.critical++;
        } else if (level === 'WARNING') {
            this.testStats.warnings++;
        } else if (level === 'PASS') {
            this.testStats.passed++;
        } else {
            this.testStats.failed++;
        }

        console.log(`[${level}] ${test}: ${message}`);
        if (details.response) {
            console.log(`  Response: ${JSON.stringify(details.response).substring(0, 200)}...`);
        }
    }

    // Security analysis of responses
    analyzeSecurityIssues(response, test) {
        const responseStr = JSON.stringify(response);
        const issues = [];

        // Check for information disclosure
        if (responseStr.includes('SQL') || responseStr.includes('database') || responseStr.includes('mysql')) {
            issues.push('SQL error information leaked');
        }

        if (responseStr.includes('stack trace') || responseStr.includes('Exception') || responseStr.includes('Warning')) {
            issues.push('Stack trace or error details exposed');
        }

        // Check for XSS vulnerabilities
        if (responseStr.includes('<script') || responseStr.includes('javascript:') || responseStr.includes('onerror=')) {
            issues.push('Potential XSS - unsanitized input reflected');
        }

        // Check for injection vulnerabilities
        if (responseStr.includes('syntax error') || responseStr.includes('mysql_fetch')) {
            issues.push('Potential SQL injection vulnerability');
        }

        // Check for sensitive data exposure
        if (responseStr.includes('password') || responseStr.includes('token') || responseStr.includes('secret')) {
            issues.push('Sensitive data potentially exposed');
        }

        return issues;
    }

    // Make HTTP request with error handling and timing
    async makeRequest(endpoint, method = 'POST', data = {}, headers = {}) {
        const startTime = Date.now();
        
        try {
            const config = {
                method,
                url: `${this.baseURL}${endpoint}`,
                data,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...headers
                },
                timeout: 10000,
                validateStatus: () => true // Don't throw on HTTP errors
            };

            const response = await axios(config);
            const responseTime = Date.now() - startTime;

            return {
                status: response.status,
                data: response.data,
                headers: response.headers,
                responseTime
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            return {
                status: 0,
                data: { error: error.message },
                headers: {},
                responseTime,
                networkError: true
            };
        }
    }

    // Test login form validation
    async testLoginValidation() {
        console.log('\n=== TESTING LOGIN FORM VALIDATION ===');

        // Test 1: Empty credentials
        const emptyTest = await this.makeRequest('/auth/login', 'POST', {});
        this.log(
            emptyTest.status === 422 ? 'PASS' : 'FAIL',
            'Login Empty Credentials',
            `Expected 422, got ${emptyTest.status}`,
            emptyTest
        );

        // Test 2: Invalid email formats
        const invalidEmails = [
            'invalid-email',
            '@example.com',
            'test@',
            'test.example.com',
            '<script>alert("xss")</script>@example.com'
        ];

        for (const email of invalidEmails) {
            const result = await this.makeRequest('/auth/login', 'POST', {
                email,
                password: 'password123'
            });

            const securityIssues = this.analyzeSecurityIssues(result.data, 'Login Invalid Email');
            
            if (securityIssues.length > 0) {
                this.log('CRITICAL', 'Login Invalid Email', `Security issue with email ${email}: ${securityIssues.join(', ')}`, result);
            } else {
                this.log(
                    result.status === 422 ? 'PASS' : 'WARNING',
                    'Login Invalid Email',
                    `Email validation for ${email}`,
                    result
                );
            }
        }

        // Test 3: SQL Injection attempts
        const sqlInjections = [
            "admin'--",
            "admin' OR '1'='1",
            "admin'; DROP TABLE users; --",
            "' OR 1=1 --"
        ];

        for (const injection of sqlInjections) {
            const result = await this.makeRequest('/auth/login', 'POST', {
                email: injection,
                password: 'password'
            });

            const securityIssues = this.analyzeSecurityIssues(result.data, 'SQL Injection');
            
            if (securityIssues.length > 0) {
                this.log('CRITICAL', 'SQL Injection', `Vulnerability found with payload: ${injection}`, result);
            } else {
                this.log('PASS', 'SQL Injection', `Payload blocked: ${injection}`, result);
            }
        }
    }

    // Test registration form validation
    async testRegistrationValidation() {
        console.log('\n=== TESTING REGISTRATION FORM VALIDATION ===');

        // Test 1: Missing required fields
        const missingFieldsTests = [
            {},
            { email: 'test@example.com' },
            { name: 'Test User' },
            { cpf: '123.456.789-10' }
        ];

        for (const testData of missingFieldsTests) {
            const result = await this.makeRequest('/auth/register', 'POST', testData);
            this.log(
                result.status === 422 ? 'PASS' : 'FAIL',
                'Registration Missing Fields',
                `Missing fields validation`,
                result
            );
        }

        // Test 2: Invalid CPF formats
        const invalidCPFs = [
            '123',
            '000.000.000-00',
            '111.111.111-11',
            '<script>alert("xss")</script>',
            "'; DROP TABLE users; --"
        ];

        for (const cpf of invalidCPFs) {
            const result = await this.makeRequest('/auth/register', 'POST', {
                name: 'Test User',
                email: 'test@example.com',
                cpf,
                password: 'password123',
                password_confirmation: 'password123'
            });

            const securityIssues = this.analyzeSecurityIssues(result.data, 'CPF Validation');
            
            if (securityIssues.length > 0) {
                this.log('CRITICAL', 'CPF Validation', `Security issue with CPF ${cpf}: ${securityIssues.join(', ')}`, result);
            } else {
                this.log(
                    result.status === 422 ? 'PASS' : 'WARNING',
                    'CPF Validation',
                    `CPF validation for ${cpf}`,
                    result
                );
            }
        }

        // Test 3: XSS attempts
        const xssPayloads = [
            '<script>alert("xss")</script>',
            '<img src=x onerror=alert("xss")>',
            'javascript:alert("xss")',
            '<svg onload=alert("xss")>'
        ];

        for (const payload of xssPayloads) {
            // Test XSS in name field
            const nameResult = await this.makeRequest('/auth/register', 'POST', {
                name: payload,
                email: 'test@example.com',
                cpf: '123.456.789-10',
                password: 'password123',
                password_confirmation: 'password123'
            });

            const nameSecurityIssues = this.analyzeSecurityIssues(nameResult.data, 'XSS in Name');
            
            if (nameSecurityIssues.length > 0) {
                this.log('CRITICAL', 'XSS in Name', `XSS vulnerability in name field: ${payload}`, nameResult);
            } else {
                this.log('PASS', 'XSS in Name', `XSS payload blocked in name: ${payload}`, nameResult);
            }
        }

        // Test 4: Password validation
        const passwordTests = [
            { password: '123', password_confirmation: '123', expected: 'short password' },
            { password: 'password123', password_confirmation: 'different', expected: 'password mismatch' }
        ];

        for (const test of passwordTests) {
            const result = await this.makeRequest('/auth/register', 'POST', {
                name: 'Test User',
                email: 'test@example.com',
                cpf: '123.456.789-10',
                ...test
            });

            this.log(
                result.status === 422 ? 'PASS' : 'FAIL',
                'Password Validation',
                `Testing ${test.expected}`,
                result
            );
        }
    }

    // Test health questionnaire validation
    async testHealthQuestionnaireValidation() {
        console.log('\n=== TESTING HEALTH QUESTIONNAIRE VALIDATION ===');

        // Test 1: Empty submission
        const emptyResult = await this.makeRequest('/health-questionnaire/submit', 'POST', {});
        this.log(
            emptyResult.status === 422 ? 'PASS' : 'FAIL',
            'Health Questionnaire Empty',
            'Empty submission validation',
            emptyResult
        );

        // Test 2: Invalid data types
        const invalidDataTypes = [
            { age: 'not_a_number', height: 'invalid', weight: 'abc' },
            { age: [], height: {}, weight: null },
            { age: true, height: false, weight: undefined }
        ];

        for (const data of invalidDataTypes) {
            const result = await this.makeRequest('/health-questionnaire/submit', 'POST', data);
            this.log(
                result.status === 422 ? 'PASS' : 'WARNING',
                'Health Data Types',
                'Invalid data type validation',
                result
            );
        }

        // Test 3: Out of range values
        const outOfRangeTests = [
            { age: -5, height: 0, weight: -10, test: 'negative values' },
            { age: 200, height: 500, weight: 1000, test: 'extreme values' },
            { age: 0.5, height: 0.1, weight: 0.1, test: 'decimal values' }
        ];

        for (const data of outOfRangeTests) {
            const result = await this.makeRequest('/health-questionnaire/submit', 'POST', data);
            this.log(
                result.status === 422 ? 'PASS' : 'WARNING',
                'Health Range Validation',
                `Testing ${data.test}`,
                result
            );
        }

        // Test 4: XSS in text fields
        const xssPayloads = [
            '<script>alert("xss")</script>',
            '<img src=x onerror=alert("xss")>',
            'javascript:alert("xss")'
        ];

        for (const payload of xssPayloads) {
            const result = await this.makeRequest('/health-questionnaire/submit', 'POST', {
                medical_history: payload,
                current_medications: payload,
                allergies: payload
            });

            const securityIssues = this.analyzeSecurityIssues(result.data, 'Health XSS');
            
            if (securityIssues.length > 0) {
                this.log('CRITICAL', 'Health XSS', `XSS vulnerability in health form: ${payload}`, result);
            } else {
                this.log('PASS', 'Health XSS', `XSS payload blocked: ${payload}`, result);
            }
        }
    }

    // Test rate limiting
    async testRateLimiting() {
        console.log('\n=== TESTING RATE LIMITING ===');

        const requests = [];
        const startTime = Date.now();

        // Make 20 rapid requests
        for (let i = 0; i < 20; i++) {
            requests.push(
                this.makeRequest('/auth/login', 'POST', {
                    email: 'test@example.com',
                    password: 'wrongpassword'
                })
            );
        }

        const results = await Promise.all(requests);
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        const rateLimitedCount = results.filter(r => r.status === 429).length;
        
        if (rateLimitedCount > 0) {
            this.log('PASS', 'Rate Limiting', `${rateLimitedCount}/20 requests rate limited in ${totalTime}ms`, { results });
        } else {
            this.log('WARNING', 'Rate Limiting', `No rate limiting detected for 20 requests in ${totalTime}ms`, { results });
        }
    }

    // Generate comprehensive report
    generateReport() {
        const reportPath = path.join(__dirname, 'form-validation-security-report.json');
        const markdownPath = path.join(__dirname, 'form-validation-security-report.md');

        const report = {
            timestamp: new Date().toISOString(),
            testStats: this.testStats,
            vulnerabilities: this.vulnerabilities,
            results: this.results,
            summary: {
                totalTests: this.testStats.total,
                securityScore: Math.max(0, 100 - (this.testStats.critical * 20) - (this.testStats.warnings * 5)),
                criticalIssues: this.testStats.critical,
                warnings: this.testStats.warnings,
                recommendations: this.generateRecommendations()
            }
        };

        // Save JSON report
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // Generate markdown report
        const markdown = this.generateMarkdownReport(report);
        fs.writeFileSync(markdownPath, markdown);

        console.log(`\n=== TEST SUITE COMPLETED ===`);
        console.log(`Total Tests: ${this.testStats.total}`);
        console.log(`Passed: ${this.testStats.passed}`);
        console.log(`Failed: ${this.testStats.failed}`);
        console.log(`Warnings: ${this.testStats.warnings}`);
        console.log(`Critical Issues: ${this.testStats.critical}`);
        console.log(`Security Score: ${report.summary.securityScore}/100`);
        console.log(`\nReports saved to:`);
        console.log(`- ${reportPath}`);
        console.log(`- ${markdownPath}`);
    }

    generateRecommendations() {
        const recommendations = [];

        if (this.testStats.critical > 0) {
            recommendations.push('🚨 IMMEDIATE ACTION REQUIRED: Critical security vulnerabilities found');
            recommendations.push('- Review all user input sanitization');
            recommendations.push('- Implement proper parameterized queries');
            recommendations.push('- Add comprehensive input validation');
        }

        if (this.testStats.warnings > 0) {
            recommendations.push('⚠️ Security improvements recommended');
            recommendations.push('- Strengthen form validation rules');
            recommendations.push('- Implement rate limiting');
            recommendations.push('- Add CSRF protection');
        }

        recommendations.push('📋 General security best practices:');
        recommendations.push('- Regular security audits');
        recommendations.push('- Implement Content Security Policy (CSP)');
        recommendations.push('- Add request logging and monitoring');
        recommendations.push('- Use HTTPS in production');

        return recommendations;
    }

    generateMarkdownReport(report) {
        return `# Form Validation Security Test Report

**Generated:** ${report.timestamp}

## Executive Summary

- **Total Tests:** ${report.summary.totalTests}
- **Security Score:** ${report.summary.securityScore}/100
- **Critical Issues:** ${report.summary.criticalIssues}
- **Warnings:** ${report.summary.warnings}

## Test Results Overview

| Category | Count |
|----------|-------|
| Passed | ${this.testStats.passed} |
| Failed | ${this.testStats.failed} |
| Warnings | ${this.testStats.warnings} |
| Critical | ${this.testStats.critical} |

## Critical Vulnerabilities

${report.vulnerabilities.map(v => `
### ${v.test}
- **Level:** ${v.level}
- **Message:** ${v.message}
- **HTTP Status:** ${v.httpStatus}
- **Response Time:** ${v.details.responseTime}ms
`).join('\n')}

## Recommendations

${report.summary.recommendations.map(r => `- ${r}`).join('\n')}

## Detailed Results

${this.results.map(r => `
### ${r.test}
- **Level:** ${r.level}
- **Message:** ${r.message}
- **Status:** ${r.httpStatus}
- **Time:** ${r.details.responseTime}ms
- **Timestamp:** ${r.timestamp}
`).join('\n')}
`;
    }

    // Run all tests
    async runAllTests() {
        console.log('Starting comprehensive form validation and security test suite...');
        
        try {
            await this.testLoginValidation();
            await this.testRegistrationValidation();
            await this.testHealthQuestionnaireValidation();
            await this.testRateLimiting();
        } catch (error) {
            console.error('Test suite error:', error);
            this.log('CRITICAL', 'Test Suite', `Unexpected error: ${error.message}`, { error });
        } finally {
            this.generateReport();
        }
    }
}

// Run the test suite
if (require.main === module) {
    const tester = new FormValidationTester();
    tester.runAllTests().catch(console.error);
}

module.exports = FormValidationTester;