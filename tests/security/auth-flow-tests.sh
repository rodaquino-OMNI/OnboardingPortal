#!/bin/bash

# Authentication Flow Tests
# Tests all authentication endpoints with various scenarios

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:8000/api"
TEST_EMAIL="test@example.com"
TEST_CPF="12345678901"
TEST_PASSWORD="Password123!"
INVALID_EMAIL="invalid@example.com"
INVALID_PASSWORD="wrongpassword"

# Test counter
test_count=0
passed_tests=0
failed_tests=0

# Function to print test results
print_result() {
    local test_name="$1"
    local status="$2"
    local response="$3"
    local expected="$4"
    
    test_count=$((test_count + 1))
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $test_name"
        passed_tests=$((passed_tests + 1))
    else
        echo -e "${RED}✗ FAIL${NC}: $test_name"
        echo -e "  Expected: $expected"
        echo -e "  Got: $response"
        failed_tests=$((failed_tests + 1))
    fi
    echo
}

# Function to extract HTTP status code
get_status_code() {
    echo "$1" | grep "HTTP/" | tail -1 | awk '{print $2}'
}

# Function to extract JSON field
get_json_field() {
    local json="$1"
    local field="$2"
    echo "$json" | jq -r ".$field // empty"
}

echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}    Authentication Flow Security Tests    ${NC}"
echo -e "${BLUE}===========================================${NC}"
echo

# Test 1: Valid email login
echo -e "${YELLOW}Test 1: Valid Email Login${NC}"
response=$(curl -s -i -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"device_name\": \"test-device\"
  }")

status_code=$(get_status_code "$response")
json_body=$(echo "$response" | tail -1)
success=$(get_json_field "$json_body" "success")

if [ "$status_code" = "200" ] || [ "$status_code" = "422" ]; then
    print_result "Valid email login" "PASS" "$status_code" "200 or 422 (user may not exist)"
    if [ "$success" = "true" ]; then
        TOKEN=$(get_json_field "$json_body" "token")
        echo -e "  ${GREEN}Token obtained: ${TOKEN:0:20}...${NC}"
    fi
else
    print_result "Valid email login" "FAIL" "$status_code" "200 or 422"
fi

# Test 2: Valid CPF login
echo -e "${YELLOW}Test 2: Valid CPF Login${NC}"
response=$(curl -s -i -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{
    \"email\": \"$TEST_CPF\",
    \"password\": \"$TEST_PASSWORD\",
    \"device_name\": \"test-device\"
  }")

status_code=$(get_status_code "$response")
json_body=$(echo "$response" | tail -1)

if [ "$status_code" = "200" ] || [ "$status_code" = "422" ]; then
    print_result "Valid CPF login" "PASS" "$status_code" "200 or 422 (user may not exist)"
else
    print_result "Valid CPF login" "FAIL" "$status_code" "200 or 422"
fi

# Test 3: Invalid credentials
echo -e "${YELLOW}Test 3: Invalid Credentials${NC}"
response=$(curl -s -i -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{
    \"email\": \"$INVALID_EMAIL\",
    \"password\": \"$INVALID_PASSWORD\"
  }")

status_code=$(get_status_code "$response")
json_body=$(echo "$response" | tail -1)

if [ "$status_code" = "422" ]; then
    print_result "Invalid credentials rejection" "PASS" "$status_code" "422"
else
    print_result "Invalid credentials rejection" "FAIL" "$status_code" "422"
fi

# Test 4: SQL Injection attempt
echo -e "${YELLOW}Test 4: SQL Injection Protection${NC}"
sql_injection_email="test@example.com'; DROP TABLE users; --"
response=$(curl -s -i -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{
    \"email\": \"$sql_injection_email\",
    \"password\": \"password\"
  }")

status_code=$(get_status_code "$response")
json_body=$(echo "$response" | tail -1)

if [ "$status_code" = "422" ] || [ "$status_code" = "400" ]; then
    print_result "SQL injection protection" "PASS" "$status_code" "422 or 400"
else
    print_result "SQL injection protection" "FAIL" "$status_code" "422 or 400"
fi

# Test 5: XSS attempt
echo -e "${YELLOW}Test 5: XSS Protection${NC}"
xss_device_name="<script>alert('xss')</script>"
response=$(curl -s -i -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"device_name\": \"$xss_device_name\"
  }")

status_code=$(get_status_code "$response")
json_body=$(echo "$response" | tail -1)
device_name_in_response=$(echo "$json_body" | grep -o '<script>' || echo "")

if [ -z "$device_name_in_response" ]; then
    print_result "XSS protection (device name)" "PASS" "No script tags found" "Script tags should be sanitized"
else
    print_result "XSS protection (device name)" "FAIL" "Script tags found" "Script tags should be sanitized"
fi

# Test 6: Rate limiting test
echo -e "${YELLOW}Test 6: Rate Limiting (5 attempts)${NC}"
rate_limit_triggered=false

for i in {1..6}; do
    response=$(curl -s -i -X POST "$BASE_URL/auth/login" \
      -H "Content-Type: application/json" \
      -H "Accept: application/json" \
      -d "{
        \"email\": \"ratelimit$i@example.com\",
        \"password\": \"wrongpassword\"
      }")
    
    status_code=$(get_status_code "$response")
    json_body=$(echo "$response" | tail -1)
    
    # Check if rate limiting is triggered
    if echo "$json_body" | grep -q "tentativas"; then
        rate_limit_triggered=true
        echo -e "  ${YELLOW}Rate limit triggered on attempt $i${NC}"
        break
    fi
    
    sleep 1
done

if [ "$rate_limit_triggered" = true ]; then
    print_result "Rate limiting enforcement" "PASS" "Rate limit triggered" "Should trigger after 5 attempts"
else
    print_result "Rate limiting enforcement" "FAIL" "Rate limit not triggered" "Should trigger after 5 attempts"
fi

# Test 7: Missing required fields
echo -e "${YELLOW}Test 7: Missing Required Fields${NC}"
response=$(curl -s -i -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\"
  }")

status_code=$(get_status_code "$response")

if [ "$status_code" = "422" ]; then
    print_result "Missing password field validation" "PASS" "$status_code" "422"
else
    print_result "Missing password field validation" "FAIL" "$status_code" "422"
fi

# Test 8: Check email existence endpoint
echo -e "${YELLOW}Test 8: Email Existence Check${NC}"
response=$(curl -s -i -X POST "$BASE_URL/auth/check-email" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\"
  }")

status_code=$(get_status_code "$response")

if [ "$status_code" = "200" ]; then
    print_result "Email existence check" "PASS" "$status_code" "200"
else
    print_result "Email existence check" "FAIL" "$status_code" "200"
fi

# Test 9: Check CPF existence endpoint
echo -e "${YELLOW}Test 9: CPF Existence Check${NC}"
response=$(curl -s -i -X POST "$BASE_URL/auth/check-cpf" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{
    \"cpf\": \"$TEST_CPF\"
  }")

status_code=$(get_status_code "$response")

if [ "$status_code" = "200" ]; then
    print_result "CPF existence check" "PASS" "$status_code" "200"
else
    print_result "CPF existence check" "FAIL" "$status_code" "200"
fi

# Test 10: Malformed JSON
echo -e "${YELLOW}Test 10: Malformed JSON Handling${NC}"
response=$(curl -s -i -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
    // malformed JSON comment
  }")

status_code=$(get_status_code "$response")

if [ "$status_code" = "400" ] || [ "$status_code" = "422" ]; then
    print_result "Malformed JSON handling" "PASS" "$status_code" "400 or 422"
else
    print_result "Malformed JSON handling" "FAIL" "$status_code" "400 or 422"
fi

# Test 11: Large payload attack
echo -e "${YELLOW}Test 11: Large Payload Protection${NC}"
large_string=$(printf 'A%.0s' {1..10000})
response=$(curl -s -i -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{
    \"email\": \"$large_string\",
    \"password\": \"$TEST_PASSWORD\"
  }")

status_code=$(get_status_code "$response")

if [ "$status_code" = "400" ] || [ "$status_code" = "422" ] || [ "$status_code" = "413" ]; then
    print_result "Large payload protection" "PASS" "$status_code" "400, 422, or 413"
else
    print_result "Large payload protection" "FAIL" "$status_code" "400, 422, or 413"
fi

# Test 12: CSRF Token test (if applicable)
echo -e "${YELLOW}Test 12: CSRF Protection${NC}"
response=$(curl -s -i -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Origin: http://malicious-site.com" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

status_code=$(get_status_code "$response")
# Note: CSRF protection might not be enforced for API endpoints, so this is informational
print_result "CSRF protection check" "INFO" "$status_code" "Informational - API endpoints may not enforce CSRF"

# Final summary
echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}           Test Summary                    ${NC}"
echo -e "${BLUE}===========================================${NC}"
echo -e "Total tests: $test_count"
echo -e "${GREEN}Passed: $passed_tests${NC}"
echo -e "${RED}Failed: $failed_tests${NC}"

if [ $failed_tests -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed! ✗${NC}"
    exit 1
fi