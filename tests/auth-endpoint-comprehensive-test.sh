#!/bin/bash

# Comprehensive Authentication Endpoint Test Suite
# Tests all 4 validated user credentials against authentication endpoints

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Configuration
API_BASE_URL="http://localhost:8000"
FRONTEND_ORIGIN="http://localhost:3000"

# Test credentials array
declare -A CREDENTIALS=(
    ["admin"]="admin@omnihealth.com:Admin@123"
    ["doctor"]="maria.silva@omnihealth.com:Doctor@123!"
    ["coordinator"]="carlos.santos@omnihealth.com:Coord@123!"
    ["employee"]="ana.costa@empresa.com:Employee@123!"
)

# Create results directory
mkdir -p test-results/auth-tests
RESULTS_DIR="test-results/auth-tests"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Initialize test results
TEST_RESULTS_FILE="${RESULTS_DIR}/auth_test_results_${TIMESTAMP}.json"
echo '{"test_suite": "authentication_endpoints", "timestamp": "'$(date -Iseconds)'", "results": []}' > "$TEST_RESULTS_FILE"

# Function to log test results
log_test_result() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    local response_code="$4"
    local headers="$5"
    
    # Create temp file for JSON manipulation
    local temp_file=$(mktemp)
    
    # Add result to JSON file
    jq --arg test_name "$test_name" \
       --arg status "$status" \
       --arg details "$details" \
       --arg response_code "$response_code" \
       --arg headers "$headers" \
       '.results += [{
           "test_name": $test_name,
           "status": $status,
           "details": $details,
           "response_code": $response_code,
           "headers": $headers,
           "timestamp": (now | strftime("%Y-%m-%d %H:%M:%S"))
       }]' "$TEST_RESULTS_FILE" > "$temp_file" && mv "$temp_file" "$TEST_RESULTS_FILE"
}

# Function to print colored output
print_status() {
    local status="$1"
    local message="$2"
    case "$status" in
        "PASS") echo -e "${GREEN}✓ PASS${NC}: $message" ;;
        "FAIL") echo -e "${RED}✗ FAIL${NC}: $message" ;;
        "INFO") echo -e "${BLUE}ℹ INFO${NC}: $message" ;;
        "WARN") echo -e "${YELLOW}⚠ WARN${NC}: $message" ;;
    esac
}

# Function to test API endpoint availability
test_api_availability() {
    print_status "INFO" "Testing API server availability at ${API_BASE_URL}"
    
    local response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "${API_BASE_URL}/api/health" || echo "000")
    
    if [[ "$response" == "200" ]]; then
        print_status "PASS" "API server is accessible"
        log_test_result "api_availability" "PASS" "API server responding" "$response" ""
        return 0
    else
        print_status "FAIL" "API server not accessible (HTTP: $response)"
        log_test_result "api_availability" "FAIL" "API server not responding" "$response" ""
        return 1
    fi
}

# Function to test CSRF cookie endpoint
test_csrf_cookie() {
    print_status "INFO" "Testing CSRF cookie endpoint"
    
    local temp_headers=$(mktemp)
    local temp_body=$(mktemp)
    
    local response_code=$(curl -s -o "$temp_body" -D "$temp_headers" -w "%{http_code}" \
        -H "Accept: application/json" \
        -H "Origin: ${FRONTEND_ORIGIN}" \
        --cookie-jar /tmp/cookies.txt \
        "${API_BASE_URL}/sanctum/csrf-cookie")
    
    local headers_content=$(cat "$temp_headers")
    
    if [[ "$response_code" == "204" ]]; then
        # Check for CORS headers
        if echo "$headers_content" | grep -qi "access-control-allow-origin" && \
           echo "$headers_content" | grep -qi "access-control-allow-credentials"; then
            print_status "PASS" "CSRF cookie endpoint working with CORS headers"
            log_test_result "csrf_cookie" "PASS" "CSRF endpoint with CORS" "$response_code" "$headers_content"
        else
            print_status "WARN" "CSRF cookie works but missing CORS headers"
            log_test_result "csrf_cookie" "WARN" "CSRF works, CORS missing" "$response_code" "$headers_content"
        fi
    else
        print_status "FAIL" "CSRF cookie endpoint failed (HTTP: $response_code)"
        log_test_result "csrf_cookie" "FAIL" "CSRF endpoint failed" "$response_code" "$headers_content"
    fi
    
    rm -f "$temp_headers" "$temp_body"
}

# Function to extract CSRF token from cookies
get_csrf_token() {
    if [[ -f /tmp/cookies.txt ]]; then
        # Extract XSRF-TOKEN from cookies
        local xsrf_token=$(grep "XSRF-TOKEN" /tmp/cookies.txt | cut -f7 | tail -1)
        if [[ -n "$xsrf_token" ]]; then
            # URL decode the token
            echo "$xsrf_token" | python3 -c "import sys, urllib.parse; print(urllib.parse.unquote(sys.stdin.read().strip()))"
        fi
    fi
}

# Function to test login endpoint for a specific user
test_login() {
    local user_type="$1"
    local credentials="$2"
    local email="${credentials%%:*}"
    local password="${credentials##*:}"
    
    print_status "INFO" "Testing login for $user_type ($email)"
    
    # Get fresh CSRF token
    curl -s -o /dev/null -D /dev/null \
        -H "Accept: application/json" \
        -H "Origin: ${FRONTEND_ORIGIN}" \
        --cookie-jar /tmp/cookies_${user_type}.txt \
        "${API_BASE_URL}/sanctum/csrf-cookie"
    
    local csrf_token=$(grep "XSRF-TOKEN" /tmp/cookies_${user_type}.txt 2>/dev/null | cut -f7 | tail -1 || echo "")
    if [[ -n "$csrf_token" ]]; then
        csrf_token=$(echo "$csrf_token" | python3 -c "import sys, urllib.parse; print(urllib.parse.unquote(sys.stdin.read().strip()))" 2>/dev/null || echo "")
    fi
    
    local temp_headers=$(mktemp)
    local temp_body=$(mktemp)
    
    # Prepare login data
    local login_data=$(jq -n \
        --arg email "$email" \
        --arg password "$password" \
        '{email: $email, password: $password}')
    
    # Make login request
    local response_code=$(curl -s -o "$temp_body" -D "$temp_headers" -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -H "Origin: ${FRONTEND_ORIGIN}" \
        -H "X-XSRF-TOKEN: ${csrf_token}" \
        --cookie /tmp/cookies_${user_type}.txt \
        --cookie-jar /tmp/cookies_${user_type}.txt \
        -d "$login_data" \
        "${API_BASE_URL}/api/auth/login")
    
    local response_body=$(cat "$temp_body")
    local headers_content=$(cat "$temp_headers")
    
    # Analyze response
    if [[ "$response_code" == "200" ]]; then
        # Check if response contains authentication data
        if echo "$response_body" | jq -e '.token' >/dev/null 2>&1 || \
           echo "$response_body" | jq -e '.access_token' >/dev/null 2>&1 || \
           echo "$response_body" | jq -e '.user' >/dev/null 2>&1; then
            
            print_status "PASS" "Login successful for $user_type"
            
            # Extract token for further testing
            local token=$(echo "$response_body" | jq -r '.token // .access_token // empty' 2>/dev/null)
            if [[ -n "$token" && "$token" != "null" ]]; then
                echo "$token" > "/tmp/token_${user_type}.txt"
                print_status "INFO" "Token saved for $user_type"
            fi
            
            log_test_result "login_${user_type}" "PASS" "Login successful" "$response_code" "$response_body"
        else
            print_status "WARN" "Login returned 200 but no authentication data found"
            log_test_result "login_${user_type}" "WARN" "Login 200 but no auth data" "$response_code" "$response_body"
        fi
    else
        print_status "FAIL" "Login failed for $user_type (HTTP: $response_code)"
        print_status "INFO" "Response: $response_body"
        log_test_result "login_${user_type}" "FAIL" "Login failed: $response_body" "$response_code" "$response_body"
    fi
    
    rm -f "$temp_headers" "$temp_body"
}

# Function to test authenticated health endpoint
test_authenticated_health() {
    local user_type="$1"
    
    print_status "INFO" "Testing authenticated health endpoint for $user_type"
    
    if [[ ! -f "/tmp/token_${user_type}.txt" ]]; then
        print_status "WARN" "No token available for $user_type, skipping authenticated test"
        return
    fi
    
    local token=$(cat "/tmp/token_${user_type}.txt")
    
    local temp_headers=$(mktemp)
    local temp_body=$(mktemp)
    
    local response_code=$(curl -s -o "$temp_body" -D "$temp_headers" -w "%{http_code}" \
        -H "Accept: application/json" \
        -H "Authorization: Bearer $token" \
        -H "Origin: ${FRONTEND_ORIGIN}" \
        "${API_BASE_URL}/api/health")
    
    local response_body=$(cat "$temp_body")
    local headers_content=$(cat "$temp_headers")
    
    if [[ "$response_code" == "200" ]]; then
        if echo "$response_body" | jq -e '.' >/dev/null 2>&1; then
            print_status "PASS" "Authenticated health endpoint working for $user_type"
            log_test_result "auth_health_${user_type}" "PASS" "Authenticated health OK" "$response_code" "$response_body"
        else
            print_status "WARN" "Health endpoint returns 200 but invalid JSON for $user_type"
            log_test_result "auth_health_${user_type}" "WARN" "Health 200 but invalid JSON" "$response_code" "$response_body"
        fi
    else
        print_status "FAIL" "Authenticated health endpoint failed for $user_type (HTTP: $response_code)"
        log_test_result "auth_health_${user_type}" "FAIL" "Auth health failed" "$response_code" "$response_body"
    fi
    
    rm -f "$temp_headers" "$temp_body"
}

# Function to generate final report
generate_report() {
    print_status "INFO" "Generating comprehensive test report"
    
    local total_tests=$(jq '.results | length' "$TEST_RESULTS_FILE")
    local passed_tests=$(jq '[.results[] | select(.status == "PASS")] | length' "$TEST_RESULTS_FILE")
    local failed_tests=$(jq '[.results[] | select(.status == "FAIL")] | length' "$TEST_RESULTS_FILE")
    local warned_tests=$(jq '[.results[] | select(.status == "WARN")] | length' "$TEST_RESULTS_FILE")
    
    echo ""
    echo "=================================="
    echo "AUTHENTICATION TEST RESULTS SUMMARY"
    echo "=================================="
    echo "Total Tests: $total_tests"
    echo "Passed: $passed_tests"
    echo "Failed: $failed_tests"
    echo "Warnings: $warned_tests"
    echo "Success Rate: $(echo "scale=1; $passed_tests * 100 / $total_tests" | bc -l)%"
    echo ""
    
    # Display detailed results
    echo "DETAILED RESULTS:"
    echo "=================="
    jq -r '.results[] | "[\(.status)] \(.test_name): \(.details) (HTTP: \(.response_code))"' "$TEST_RESULTS_FILE"
    
    echo ""
    echo "Full results saved to: $TEST_RESULTS_FILE"
}

# Main execution
main() {
    echo "🔐 COMPREHENSIVE AUTHENTICATION ENDPOINT TEST SUITE"
    echo "===================================================="
    echo "Testing API: $API_BASE_URL"
    echo "Frontend Origin: $FRONTEND_ORIGIN"
    echo "Timestamp: $(date)"
    echo ""
    
    # Test API availability first
    if ! test_api_availability; then
        print_status "FAIL" "API server not available. Aborting tests."
        exit 1
    fi
    
    # Test CSRF cookie endpoint
    test_csrf_cookie
    
    # Test login for each credential
    for user_type in "${!CREDENTIALS[@]}"; do
        test_login "$user_type" "${CREDENTIALS[$user_type]}"
    done
    
    # Test authenticated endpoints
    for user_type in "${!CREDENTIALS[@]}"; do
        test_authenticated_health "$user_type"
    done
    
    # Generate final report
    generate_report
    
    # Cleanup
    rm -f /tmp/cookies*.txt /tmp/token*.txt
}

# Run main function
main "$@"