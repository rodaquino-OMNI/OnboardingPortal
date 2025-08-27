#!/bin/bash

# Form Validation Security Test Suite
# Tests all form endpoints for validation and security vulnerabilities

set -e

BASE_URL="http://localhost:8000/api"
RESULTS_FILE="/Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/frontend/tests/validation-test-results.md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Initialize results file
echo "# Form Validation Test Results" > $RESULTS_FILE
echo "Generated: $(date)" >> $RESULTS_FILE
echo "" >> $RESULTS_FILE

# Helper function to log test results
log_test() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    
    echo -e "${BLUE}Testing:${NC} $test_name"
    echo "## $test_name" >> $RESULTS_FILE
    echo "**Status:** $status" >> $RESULTS_FILE
    echo "**Details:** $details" >> $RESULTS_FILE
    echo "" >> $RESULTS_FILE
}

# Helper function to make API calls and analyze responses
test_endpoint() {
    local endpoint="$1"
    local method="$2"
    local data="$3"
    local test_description="$4"
    
    echo -e "${YELLOW}$test_description${NC}"
    
    response=$(curl -s -w "HTTP_STATUS:%{http_code}\nRESPONSE_TIME:%{time_total}" \
        -X "$method" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -d "$data" \
        "$BASE_URL$endpoint" 2>/dev/null || echo "CURL_ERROR")
    
    if [[ "$response" == "CURL_ERROR" ]]; then
        log_test "$test_description" "ERROR" "Unable to connect to server"
        echo -e "${RED}✗ Connection failed${NC}"
        return 1
    fi
    
    http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    response_time=$(echo "$response" | grep "RESPONSE_TIME:" | cut -d: -f2)
    response_body=$(echo "$response" | sed '/HTTP_STATUS:/d' | sed '/RESPONSE_TIME:/d')
    
    echo "HTTP Status: $http_status"
    echo "Response Time: ${response_time}s"
    echo "Response Body: $response_body"
    echo ""
    
    # Analyze response for security issues
    security_analysis=""
    if [[ "$response_body" == *"error"* ]] || [[ "$response_body" == *"exception"* ]]; then
        security_analysis="⚠️ Error details exposed in response"
    fi
    
    if [[ "$response_body" == *"SQL"* ]] || [[ "$response_body" == *"database"* ]]; then
        security_analysis="🚨 Potential SQL injection vulnerability detected"
    fi
    
    if [[ "$response_body" == *"<script"* ]] || [[ "$response_body" == *"javascript:"* ]]; then
        security_analysis="🚨 XSS vulnerability detected - unsanitized input reflected"
    fi
    
    log_test "$test_description" "COMPLETED" "HTTP $http_status | Time: ${response_time}s | $security_analysis"
    
    return 0
}

echo -e "${GREEN}=== Form Validation Security Test Suite ===${NC}"
echo ""

# 1. LOGIN FORM VALIDATION TESTS
echo -e "${BLUE}=== LOGIN FORM VALIDATION TESTS ===${NC}"

# Test 1.1: Empty credentials
test_endpoint "/auth/login" "POST" '{}' "Login with empty credentials"

# Test 1.2: Empty email
test_endpoint "/auth/login" "POST" '{"password":"password123"}' "Login with empty email"

# Test 1.3: Empty password
test_endpoint "/auth/login" "POST" '{"email":"test@example.com"}' "Login with empty password"

# Test 1.4: Invalid email formats
invalid_emails=(
    "invalid-email"
    "@example.com"
    "test@"
    "test.example.com"
    "test@.com"
    "test@example."
    "<script>alert('xss')</script>@example.com"
)

for email in "${invalid_emails[@]}"; do
    test_endpoint "/auth/login" "POST" "{\"email\":\"$email\",\"password\":\"password123\"}" "Login with invalid email: $email"
done

# Test 1.5: Short password
test_endpoint "/auth/login" "POST" '{"email":"test@example.com","password":"123"}' "Login with short password"

# Test 1.6: SQL Injection attempts
sql_injections=(
    "admin'--"
    "admin' OR '1'='1"
    "admin'; DROP TABLE users; --"
    "admin' UNION SELECT * FROM users --"
    "admin\"; DROP TABLE users; --"
    "' OR 1=1 --"
)

for injection in "${sql_injections[@]}"; do
    escaped_injection=$(printf '%s\n' "$injection" | sed 's/[\[\]]/\\&/g')
    test_endpoint "/auth/login" "POST" "{\"email\":\"$escaped_injection\",\"password\":\"password\"}" "SQL Injection test: $injection"
done

# 2. REGISTRATION FORM VALIDATION TESTS
echo -e "${BLUE}=== REGISTRATION FORM VALIDATION TESTS ===${NC}"

# Test 2.1: Missing required fields
test_endpoint "/auth/register" "POST" '{}' "Registration with no data"

test_endpoint "/auth/register" "POST" '{"email":"test@example.com"}' "Registration with only email"

test_endpoint "/auth/register" "POST" '{"name":"Test User"}' "Registration with only name"

# Test 2.2: Invalid CPF formats
invalid_cpfs=(
    "123"
    "123.456.789-00"
    "000.000.000-00"
    "111.111.111-11"
    "123.456.789-ab"
    "<script>alert('xss')</script>"
    "'; DROP TABLE users; --"
)

for cpf in "${invalid_cpfs[@]}"; do
    test_endpoint "/auth/register" "POST" "{\"name\":\"Test User\",\"email\":\"test@example.com\",\"cpf\":\"$cpf\",\"password\":\"password123\",\"password_confirmation\":\"password123\"}" "Registration with invalid CPF: $cpf"
done

# Test 2.3: XSS attempts in various fields
xss_payloads=(
    "<script>alert('xss')</script>"
    "<img src=x onerror=alert('xss')>"
    "javascript:alert('xss')"
    "<svg onload=alert('xss')>"
    "';alert('xss');//"
    "<iframe src='javascript:alert(\"xss\")'></iframe>"
)

for payload in "${xss_payloads[@]}"; do
    # Test XSS in name field
    test_endpoint "/auth/register" "POST" "{\"name\":\"$payload\",\"email\":\"test@example.com\",\"cpf\":\"123.456.789-10\",\"password\":\"password123\",\"password_confirmation\":\"password123\"}" "XSS in name field: $payload"
    
    # Test XSS in email field
    test_endpoint "/auth/register" "POST" "{\"name\":\"Test User\",\"email\":\"$payload\",\"cpf\":\"123.456.789-10\",\"password\":\"password123\",\"password_confirmation\":\"password123\"}" "XSS in email field: $payload"
done

# Test 2.4: Password mismatch
test_endpoint "/auth/register" "POST" '{"name":"Test User","email":"test@example.com","cpf":"123.456.789-10","password":"password123","password_confirmation":"different"}' "Registration with password mismatch"

# Test 2.5: Duplicate email test (requires valid registration first)
test_endpoint "/auth/register" "POST" '{"name":"First User","email":"duplicate@example.com","cpf":"123.456.789-10","password":"password123","password_confirmation":"password123"}' "First registration attempt"

test_endpoint "/auth/register" "POST" '{"name":"Second User","email":"duplicate@example.com","cpf":"987.654.321-10","password":"password123","password_confirmation":"password123"}' "Duplicate email registration attempt"

# 3. HEALTH QUESTIONNAIRE VALIDATION TESTS
echo -e "${BLUE}=== HEALTH QUESTIONNAIRE VALIDATION TESTS ===${NC}"

# Test 3.1: Empty submission
test_endpoint "/health-questionnaire/submit" "POST" '{}' "Health questionnaire with empty data"

# Test 3.2: Invalid data types for numeric fields
test_endpoint "/health-questionnaire/submit" "POST" '{"age":"not_a_number","height":"invalid","weight":"abc"}' "Health questionnaire with invalid numeric types"

# Test 3.3: Out of range values
test_endpoint "/health-questionnaire/submit" "POST" '{"age":-5,"height":0,"weight":-10}' "Health questionnaire with negative values"

test_endpoint "/health-questionnaire/submit" "POST" '{"age":200,"height":500,"weight":1000}' "Health questionnaire with extremely high values"

# Test 3.4: XSS in text fields
for payload in "${xss_payloads[@]}"; do
    test_endpoint "/health-questionnaire/submit" "POST" "{\"medical_history\":\"$payload\",\"current_medications\":\"$payload\",\"allergies\":\"$payload\"}" "XSS in health questionnaire text fields: $payload"
done

# Test 3.5: SQL injection in text fields
for injection in "${sql_injections[@]}"; do
    escaped_injection=$(printf '%s\n' "$injection" | sed 's/[\[\]]/\\&/g')
    test_endpoint "/health-questionnaire/submit" "POST" "{\"medical_history\":\"$escaped_injection\",\"current_medications\":\"$escaped_injection\"}" "SQL injection in health questionnaire: $injection"
done

# Test 3.6: Missing required health fields
test_endpoint "/health-questionnaire/submit" "POST" '{"age":30}' "Health questionnaire with only age"

test_endpoint "/health-questionnaire/submit" "POST" '{"height":170,"weight":70}' "Health questionnaire without age"

# Test 3.7: Boundary value testing
test_endpoint "/health-questionnaire/submit" "POST" '{"age":0,"height":1,"weight":1}' "Health questionnaire with minimum boundary values"

test_endpoint "/health-questionnaire/submit" "POST" '{"age":150,"height":250,"weight":500}' "Health questionnaire with maximum reasonable values"

# 4. AUTHENTICATION BYPASS ATTEMPTS
echo -e "${BLUE}=== AUTHENTICATION BYPASS TESTS ===${NC}"

# Test 4.1: Header injection
test_endpoint "/auth/login" "POST" '{"email":"admin@example.com","password":"any"}' "Login with potential header injection"

# Test 4.2: Parameter pollution
test_endpoint "/auth/login" "POST" '{"email":"user@example.com","email":"admin@example.com","password":"password"}' "Login with parameter pollution"

# Test 4.3: JSON injection
test_endpoint "/auth/login" "POST" '{"email":"user@example.com","password":"pass","admin":true}' "Login with additional admin parameter"

# 5. RATE LIMITING TESTS
echo -e "${BLUE}=== RATE LIMITING TESTS ===${NC}"

echo "Testing rate limiting with rapid requests..."
for i in {1..20}; do
    echo "Request $i/20"
    test_endpoint "/auth/login" "POST" '{"email":"test@example.com","password":"wrongpassword"}' "Rate limiting test - Request $i"
    sleep 0.1
done

# 6. CONTENT-TYPE BYPASS TESTS
echo -e "${BLUE}=== CONTENT-TYPE BYPASS TESTS ===${NC}"

# Test with different content types
curl -s -w "HTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=test@example.com&password=password" \
    "$BASE_URL/auth/login" > /dev/null

curl -s -w "HTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: text/plain" \
    -d '{"email":"test@example.com","password":"password"}' \
    "$BASE_URL/auth/login" > /dev/null

echo ""
echo -e "${GREEN}=== Test Suite Completed ===${NC}"
echo -e "${YELLOW}Results saved to: $RESULTS_FILE${NC}"
echo ""
echo "Summary of findings:"
grep -c "🚨" $RESULTS_FILE && echo "Critical security issues found" || echo "No critical security issues detected"
grep -c "⚠️" $RESULTS_FILE && echo "Warnings found" || echo "No warnings"