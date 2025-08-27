#!/bin/bash

# API Error Handling Comprehensive Test Script
# Tests all error scenarios to ensure proper HTTP status codes and security

set -e

API_BASE="http://localhost:8000/api"
PASSED=0
FAILED=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔐 API Error Handling Comprehensive Test Suite"
echo "============================================="
echo

# Function to test endpoint and validate response
test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local expected_code=$4
    local test_name=$5
    local data=$6
    local token=$7
    
    echo -n "Testing: $test_name... "
    
    # Build curl command
    local curl_cmd="curl -s -w \"%{http_code}\" -X $method"
    curl_cmd="$curl_cmd -H \"Accept: application/json\""
    
    if [[ -n "$data" ]]; then
        curl_cmd="$curl_cmd -H \"Content-Type: application/json\" -d '$data'"
    fi
    
    if [[ -n "$token" ]]; then
        curl_cmd="$curl_cmd -H \"Authorization: Bearer $token\""
    fi
    
    curl_cmd="$curl_cmd \"$API_BASE$endpoint\""
    
    # Execute request
    local response=$(eval $curl_cmd)
    local status_code="${response: -3}"
    local body="${response%???}"
    
    # Parse response code from JSON
    local response_code=""
    if [[ -n "$body" ]]; then
        response_code=$(echo "$body" | jq -r '.code // empty' 2>/dev/null || echo "")
    fi
    
    # Validate results
    if [[ "$status_code" == "$expected_status" ]] && [[ "$response_code" == "$expected_code" ]]; then
        echo -e "${GREEN}PASS${NC}"
        echo "  ✓ Status: $status_code, Code: $response_code"
        ((PASSED++))
    else
        echo -e "${RED}FAIL${NC}"
        echo "  ✗ Expected: Status $expected_status, Code $expected_code"
        echo "  ✗ Received: Status $status_code, Code $response_code"
        echo "  Response: $body"
        ((FAILED++))
    fi
    echo
}

# Function to check if paths are exposed
check_no_paths_exposed() {
    echo "🔍 Checking for exposed file paths..."
    
    local response=$(curl -s -H "Accept: application/json" "$API_BASE/user")
    
    if echo "$response" | grep -q "/var/www\|/app\|/backend\|vendor/"; then
        echo -e "${RED}FAIL${NC} - File paths are exposed!"
        echo "Response: $response"
        ((FAILED++))
    else
        echo -e "${GREEN}PASS${NC} - No file paths exposed"
        ((PASSED++))
    fi
    echo
}

# Test Cases
echo "🧪 Starting Error Handling Tests..."
echo

# 1. Authentication Errors (401)
test_endpoint "GET" "/user" "401" "UNAUTHENTICATED" "Unauthenticated API access"

# 2. Protected Health Questionnaire endpoint
test_endpoint "GET" "/health-questionnaires/templates" "401" "UNAUTHENTICATED" "Protected questionnaire endpoint"

# 3. Not Found Errors (404)
test_endpoint "GET" "/nonexistent-endpoint" "404" "ENDPOINT_NOT_FOUND" "Nonexistent endpoint"

# 4. Validation Errors (422)
test_endpoint "POST" "/auth/login" "422" "VALIDATION_ERROR" "Invalid login data" '{"invalid":"data"}'

# 5. Method Not Allowed (405) - trying POST on GET endpoint
test_endpoint "POST" "/health" "405" "METHOD_NOT_ALLOWED" "Method not allowed"

# 6. Invalid JSON
test_endpoint "POST" "/auth/login" "400" "" "Invalid JSON format" '{invalid-json}'

# 7. Large request body (if configured)
test_endpoint "POST" "/auth/login" "413" "" "Request too large" "$(python3 -c "print('{\"data\":\"' + 'x'*10000000 + '\"}')")" 2>/dev/null || echo "Skipping large request test (requires Python)"

# Check security - no paths exposed
check_no_paths_exposed

# Authentication with invalid token
test_endpoint "GET" "/user" "401" "UNAUTHENTICATED" "Invalid token authentication" "" "invalid-token-12345"

# Test with valid format but expired/invalid token
test_endpoint "GET" "/user" "401" "UNAUTHENTICATED" "Expired token authentication" "" "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.invalid.signature"

echo "📊 Test Results Summary"
echo "======================"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo "Total: $((PASSED + FAILED))"
echo

# Additional Security Checks
echo "🔒 Security Validation"
echo "======================"

# Check that debug info is not exposed in production mode
echo "🔍 Checking debug information exposure..."
response=$(curl -s -H "Accept: application/json" "$API_BASE/user")
if echo "$response" | grep -q "\"debug\"\|\"file\"\|\"line\"\|\"trace\""; then
    echo -e "${YELLOW}WARNING${NC} - Debug information may be exposed"
    echo "Response: $response"
else
    echo -e "${GREEN}SECURE${NC} - No debug information exposed"
fi
echo

# Check error message consistency
echo "🔍 Checking error message consistency..."
auth_response=$(curl -s -H "Accept: application/json" "$API_BASE/user")
if echo "$auth_response" | jq -r '.message' | grep -q "^Unauthenticated$"; then
    echo -e "${GREEN}SECURE${NC} - Consistent authentication error messages"
else
    echo -e "${RED}WARNING${NC} - Inconsistent authentication error messages"
fi

echo
if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}🎉 All tests passed! API error handling is working correctly.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the error handling implementation.${NC}"
    exit 1
fi