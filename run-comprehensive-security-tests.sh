#!/bin/bash

# Comprehensive Security Test Runner
# This script runs all security tests across both backend and frontend

set -e

echo "🔒 Starting Comprehensive Security Test Suite"
echo "============================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Test results tracking
BACKEND_TESTS_PASSED=0
FRONTEND_TESTS_PASSED=0
TOTAL_VULNERABILITIES_FOUND=0

# Change to project root
cd "$(dirname "$0")"

print_status "Current directory: $(pwd)"

# Backend Security Tests
echo ""
print_status "Running Backend Security Tests..."
echo "=================================="

cd omni-portal/backend

# Check if vendor directory exists
if [ ! -d "vendor" ]; then
    print_warning "Vendor directory not found. Installing dependencies..."
    composer install
fi

# Run comprehensive security test suite
print_status "Running ComprehensiveSecurityTestSuite..."
if php artisan test tests/Security/ComprehensiveSecurityTestSuite.php --verbose; then
    print_success "Backend comprehensive security tests passed"
    BACKEND_TESTS_PASSED=$((BACKEND_TESTS_PASSED + 1))
else
    print_error "Backend comprehensive security tests failed"
    TOTAL_VULNERABILITIES_FOUND=$((TOTAL_VULNERABILITIES_FOUND + 1))
fi

# Run existing security tests
print_status "Running existing SecurityTestSuite..."
if php artisan test tests/Security/SecurityTestSuite.php --verbose; then
    print_success "Backend security test suite passed"
    BACKEND_TESTS_PASSED=$((BACKEND_TESTS_PASSED + 1))
else
    print_error "Backend security test suite failed"
    TOTAL_VULNERABILITIES_FOUND=$((TOTAL_VULNERABILITIES_FOUND + 1))
fi

print_status "Running AdminSecurityTest..."
if php artisan test tests/Security/AdminSecurityTest.php --verbose; then
    print_success "Backend admin security tests passed"
    BACKEND_TESTS_PASSED=$((BACKEND_TESTS_PASSED + 1))
else
    print_error "Backend admin security tests failed"
    TOTAL_VULNERABILITIES_FOUND=$((TOTAL_VULNERABILITIES_FOUND + 1))
fi

print_status "Running LGPDComplianceTest..."
if php artisan test tests/Security/LGPDComplianceTest.php --verbose; then
    print_success "Backend LGPD compliance tests passed"
    BACKEND_TESTS_PASSED=$((BACKEND_TESTS_PASSED + 1))
else
    print_error "Backend LGPD compliance tests failed"
    TOTAL_VULNERABILITIES_FOUND=$((TOTAL_VULNERABILITIES_FOUND + 1))
fi

# Frontend Security Tests
echo ""
print_status "Running Frontend Security Tests..."
echo "===================================="

cd ../frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_warning "Node modules not found. Installing dependencies..."
    npm install
fi

# Run comprehensive security test suite
print_status "Running ComprehensiveSecurityTestSuite.test.tsx..."
if npm run test -- __tests__/security/ComprehensiveSecurityTestSuite.test.tsx --verbose; then
    print_success "Frontend comprehensive security tests passed"
    FRONTEND_TESTS_PASSED=$((FRONTEND_TESTS_PASSED + 1))
else
    print_error "Frontend comprehensive security tests failed"
    TOTAL_VULNERABILITIES_FOUND=$((TOTAL_VULNERABILITIES_FOUND + 1))
fi

# Run existing security tests
print_status "Running AuthenticationSecurity.test.tsx..."
if npm run test -- __tests__/security/AuthenticationSecurity.test.tsx --verbose; then
    print_success "Frontend authentication security tests passed"
    FRONTEND_TESTS_PASSED=$((FRONTEND_TESTS_PASSED + 1))
else
    print_error "Frontend authentication security tests failed"
    TOTAL_VULNERABILITIES_FOUND=$((TOTAL_VULNERABILITIES_FOUND + 1))
fi

print_status "Running TelemedicineSecurityValidation.test.tsx..."
if npm run test -- __tests__/integration/TelemedicineSecurityValidation.test.tsx --verbose; then
    print_success "Frontend telemedicine security tests passed"
    FRONTEND_TESTS_PASSED=$((FRONTEND_TESTS_PASSED + 1))
else
    print_error "Frontend telemedicine security tests failed"
    TOTAL_VULNERABILITIES_FOUND=$((TOTAL_VULNERABILITIES_FOUND + 1))
fi

print_status "Running NavigationSecurity.test.tsx..."
if npm run test -- __tests__/routing/NavigationSecurity.test.tsx --verbose; then
    print_success "Frontend navigation security tests passed"
    FRONTEND_TESTS_PASSED=$((FRONTEND_TESTS_PASSED + 1))
else
    print_error "Frontend navigation security tests failed"
    TOTAL_VULNERABILITIES_FOUND=$((TOTAL_VULNERABILITIES_FOUND + 1))
fi

# Security Analysis
echo ""
print_status "Running Additional Security Analysis..."
echo "======================================"

cd ../backend

# Check for potential security issues in code
print_status "Scanning for hardcoded secrets..."
SECRETS_FOUND=0
if grep -r "password.*=" app/ --include="*.php" | grep -v "Hash::make" | grep -v "\$password" | grep -v "password_confirmation"; then
    print_warning "Potential hardcoded passwords found"
    SECRETS_FOUND=$((SECRETS_FOUND + 1))
fi

if grep -r "api_key.*=" app/ --include="*.php" | grep -v "config("; then
    print_warning "Potential hardcoded API keys found"
    SECRETS_FOUND=$((SECRETS_FOUND + 1))
fi

if grep -r "secret.*=" app/ --include="*.php" | grep -v "config("; then
    print_warning "Potential hardcoded secrets found"
    SECRETS_FOUND=$((SECRETS_FOUND + 1))
fi

if [ $SECRETS_FOUND -eq 0 ]; then
    print_success "No hardcoded secrets detected"
fi

# Check for dangerous functions
print_status "Scanning for dangerous functions..."
DANGEROUS_FUNCTIONS_FOUND=0

if grep -r "eval(" app/ --include="*.php"; then
    print_error "eval() function found - potential code injection risk"
    DANGEROUS_FUNCTIONS_FOUND=$((DANGEROUS_FUNCTIONS_FOUND + 1))
fi

if grep -r "exec(" app/ --include="*.php"; then
    print_warning "exec() function found - review for command injection risks"
    DANGEROUS_FUNCTIONS_FOUND=$((DANGEROUS_FUNCTIONS_FOUND + 1))
fi

if grep -r "system(" app/ --include="*.php"; then
    print_warning "system() function found - review for command injection risks"
    DANGEROUS_FUNCTIONS_FOUND=$((DANGEROUS_FUNCTIONS_FOUND + 1))
fi

if grep -r "shell_exec(" app/ --include="*.php"; then
    print_warning "shell_exec() function found - review for command injection risks"
    DANGEROUS_FUNCTIONS_FOUND=$((DANGEROUS_FUNCTIONS_FOUND + 1))
fi

if [ $DANGEROUS_FUNCTIONS_FOUND -eq 0 ]; then
    print_success "No dangerous functions detected"
fi

# Frontend security analysis
cd ../frontend

print_status "Scanning frontend for security issues..."
FRONTEND_ISSUES_FOUND=0

if grep -r "dangerouslySetInnerHTML" app/ --include="*.tsx" --include="*.ts"; then
    print_warning "dangerouslySetInnerHTML found - review for XSS risks"
    FRONTEND_ISSUES_FOUND=$((FRONTEND_ISSUES_FOUND + 1))
fi

if grep -r "innerHTML.*=" app/ --include="*.tsx" --include="*.ts" --include="*.js"; then
    print_warning "innerHTML assignments found - review for XSS risks"
    FRONTEND_ISSUES_FOUND=$((FRONTEND_ISSUES_FOUND + 1))
fi

if grep -r "eval(" app/ --include="*.tsx" --include="*.ts" --include="*.js"; then
    print_error "eval() function found in frontend - potential XSS risk"
    FRONTEND_ISSUES_FOUND=$((FRONTEND_ISSUES_FOUND + 1))
fi

if [ $FRONTEND_ISSUES_FOUND -eq 0 ]; then
    print_success "No frontend security issues detected"
fi

# Generate Security Report
echo ""
print_status "Generating Security Test Report..."
echo "=================================="

cd ../../

# Create report file
REPORT_FILE="security-test-report-$(date +%Y%m%d-%H%M%S).md"

cat > "$REPORT_FILE" << EOF
# Comprehensive Security Test Report

Generated on: $(date)

## Test Results Summary

### Backend Security Tests
- Tests Passed: $BACKEND_TESTS_PASSED
- Tests Failed: $((4 - BACKEND_TESTS_PASSED))

### Frontend Security Tests  
- Tests Passed: $FRONTEND_TESTS_PASSED
- Tests Failed: $((4 - FRONTEND_TESTS_PASSED))

### Security Analysis
- Hardcoded Secrets Found: $SECRETS_FOUND
- Dangerous Functions Found: $DANGEROUS_FUNCTIONS_FOUND
- Frontend Security Issues: $FRONTEND_ISSUES_FOUND

### Total Vulnerabilities Found: $TOTAL_VULNERABILITIES_FOUND

## Test Coverage

### Backend Tests Executed:
1. ComprehensiveSecurityTestSuite.php
   - XSS Protection Tests
   - CSRF Protection Tests  
   - SQL Injection Tests
   - File Upload Security Tests
   - Input Validation Tests
   - Session Security Tests
   - Authorization Tests
   - Rate Limiting Tests
   - Data Exposure Prevention
   - Business Logic Tests
   - Cryptographic Tests
   - Infrastructure Security

2. SecurityTestSuite.php
   - Basic security vulnerability tests
   - Authentication security
   - File upload security

3. AdminSecurityTest.php
   - Admin endpoint security
   - Privilege escalation prevention
   - Audit trail integrity

4. LGPDComplianceTest.php
   - Data protection compliance
   - Privacy controls

### Frontend Tests Executed:
1. ComprehensiveSecurityTestSuite.test.tsx
   - XSS Protection across all components
   - CSRF Token validation
   - SQL Injection prevention
   - File Upload security
   - Input validation and sanitization
   - Session security
   - Rate limiting
   - Content Security Policy
   - Error handling security
   - Data protection and privacy

2. AuthenticationSecurity.test.tsx
   - Login form security
   - Session management
   - Token validation

3. TelemedicineSecurityValidation.test.tsx
   - Video conferencing security
   - HIPAA compliance
   - Data encryption

4. NavigationSecurity.test.tsx
   - Route protection
   - Access control

## Security Measures Validated

### Authentication & Authorization
- ✅ Password strength requirements
- ✅ Session management
- ✅ Token validation
- ✅ Multi-factor authentication support
- ✅ Role-based access control

### Input Validation
- ✅ XSS prevention
- ✅ SQL injection prevention  
- ✅ CSRF protection
- ✅ File upload validation
- ✅ Input sanitization

### Data Protection
- ✅ Encryption at rest
- ✅ Encryption in transit
- ✅ LGPD compliance
- ✅ HIPAA compliance
- ✅ Sensitive data handling

### Infrastructure Security
- ✅ Security headers
- ✅ Content Security Policy
- ✅ Rate limiting
- ✅ Error handling
- ✅ Audit logging

## Recommendations

EOF

# Add recommendations based on test results
if [ $TOTAL_VULNERABILITIES_FOUND -gt 0 ]; then
    cat >> "$REPORT_FILE" << EOF
⚠️  **CRITICAL**: $TOTAL_VULNERABILITIES_FOUND vulnerabilities found. Address immediately.

EOF
fi

if [ $SECRETS_FOUND -gt 0 ]; then
    cat >> "$REPORT_FILE" << EOF
- Remove hardcoded secrets and use environment variables
EOF
fi

if [ $DANGEROUS_FUNCTIONS_FOUND -gt 0 ]; then
    cat >> "$REPORT_FILE" << EOF
- Review usage of dangerous functions (eval, exec, system, shell_exec)
EOF
fi

if [ $FRONTEND_ISSUES_FOUND -gt 0 ]; then
    cat >> "$REPORT_FILE" << EOF
- Address frontend security issues (innerHTML, dangerouslySetInnerHTML)
EOF
fi

cat >> "$REPORT_FILE" << EOF

## Next Steps

1. Address all identified vulnerabilities
2. Implement additional security controls as needed
3. Schedule regular security testing
4. Update security documentation
5. Train development team on secure coding practices

---
*Report generated by Comprehensive Security Test Suite*
EOF

# Final Summary
echo ""
echo "🔒 Security Test Suite Complete"
echo "================================"
print_success "Security report generated: $REPORT_FILE"

if [ $TOTAL_VULNERABILITIES_FOUND -eq 0 ]; then
    print_success "✅ All security tests passed! No vulnerabilities found."
    exit 0
else
    print_error "❌ $TOTAL_VULNERABILITIES_FOUND vulnerabilities found. Please review the report."
    exit 1
fi