#!/bin/bash

# API Load Testing Script for OnboardingPortal
# This script tests various API endpoints for performance and concurrent load

set -e

API_BASE_URL="http://localhost:8000/api"
LOG_FILE="/tmp/api_load_test_$(date +%Y%m%d_%H%M%S).log"
RESULTS_FILE="/tmp/api_performance_results_$(date +%Y%m%d_%H%M%S).json"

echo "Starting API Load Test - $(date)" | tee "$LOG_FILE"
echo "API Base URL: $API_BASE_URL" | tee -a "$LOG_FILE"
echo "Results will be saved to: $RESULTS_FILE" | tee -a "$LOG_FILE"

# Initialize results JSON
echo '{
  "test_run": "'$(date --iso-8601=seconds)'",
  "api_base_url": "'$API_BASE_URL'",
  "tests": {}
}' > "$RESULTS_FILE"

# Function to run performance test
run_performance_test() {
    local endpoint="$1"
    local method="$2"
    local data="$3"
    local concurrent_requests="${4:-1}"
    local test_name="${5:-${endpoint//\//_}}"
    
    echo "Testing $test_name ($method $endpoint) - Concurrent: $concurrent_requests" | tee -a "$LOG_FILE"
    
    local temp_results="/tmp/perf_test_$test_name.tmp"
    
    if [ "$method" = "GET" ]; then
        seq 1 $concurrent_requests | xargs -n1 -P$concurrent_requests -I{} curl -w "{\\"request\\":{},\\"time_total\\":%{time_total},\\"time_connect\\":%{time_connect},\\"time_starttransfer\\":%{time_starttransfer},\\"http_code\\":%{http_code},\\"size_download\\":%{size_download}}\n" -s -o /dev/null "$API_BASE_URL$endpoint" >> "$temp_results"
    else
        seq 1 $concurrent_requests | xargs -n1 -P$concurrent_requests -I{} curl -w "{\\"request\\":{},\\"time_total\\":%{time_total},\\"time_connect\\":%{time_connect},\\"time_starttransfer\\":%{time_starttransfer},\\"http_code\\":%{http_code},\\"size_download\\":%{size_download}}\n" -s -o /dev/null -X "$method" -H "Content-Type: application/json" -H "Accept: application/json" -d "$data" "$API_BASE_URL$endpoint" >> "$temp_results"
    fi
    
    # Calculate statistics
    local avg_time=$(awk -F'"time_total":' '{if(NF>1) sum+=$2; count++} END {print (count > 0) ? sum/count : 0}' "$temp_results" | cut -d',' -f1)
    local max_time=$(awk -F'"time_total":' '{if(NF>1 && $2>max) max=$2} END {print max+0}' "$temp_results" | cut -d',' -f1)
    local min_time=$(awk -F'"time_total":' 'BEGIN{min=999} {if(NF>1 && $2<min && $2>0) min=$2} END {print min+0}' "$temp_results" | cut -d',' -f1)
    local success_count=$(grep -c '"http_code":200' "$temp_results" 2>/dev/null || echo "0")
    local error_count=$((concurrent_requests - success_count))
    
    echo "  Results: Avg: ${avg_time}s, Min: ${min_time}s, Max: ${max_time}s, Success: $success_count, Errors: $error_count" | tee -a "$LOG_FILE"
    
    # Update results JSON
    local temp_json="/tmp/temp_results.json"
    jq --argjson avg "$avg_time" --argjson min "$min_time" --argjson max "$max_time" --argjson success "$success_count" --argjson errors "$error_count" --argjson concurrent "$concurrent_requests" \
       '.tests["'$test_name'"] = {
         "endpoint": "'$endpoint'",
         "method": "'$method'",
         "concurrent_requests": $concurrent,
         "avg_response_time": $avg,
         "min_response_time": $min,
         "max_response_time": $max,
         "success_count": $success,
         "error_count": $errors,
         "success_rate": ($success / $concurrent * 100)
       }' "$RESULTS_FILE" > "$temp_json" && mv "$temp_json" "$RESULTS_FILE"
    
    rm -f "$temp_results"
}

# Test 1: Health endpoint
echo "=== Testing Health Endpoint ===" | tee -a "$LOG_FILE"
run_performance_test "/health" "GET" "" 1 "health_single"
run_performance_test "/health" "GET" "" 10 "health_concurrent_10"
run_performance_test "/health" "GET" "" 50 "health_concurrent_50"

# Test 2: Health readiness probe
echo "=== Testing Health Ready Endpoint ===" | tee -a "$LOG_FILE"
run_performance_test "/health/ready" "GET" "" 1 "health_ready_single"
run_performance_test "/health/ready" "GET" "" 20 "health_ready_concurrent_20"

# Test 3: Authentication check-email
echo "=== Testing Auth Check Email ===" | tee -a "$LOG_FILE"
run_performance_test "/auth/check-email" "POST" '{"email":"test@example.com"}' 1 "auth_check_email_single"
run_performance_test "/auth/check-email" "POST" '{"email":"test@example.com"}' 5 "auth_check_email_concurrent_5"
run_performance_test "/auth/check-email" "POST" '{"email":"test@example.com"}' 10 "auth_check_email_concurrent_10"

# Test 4: Authentication check-cpf
echo "=== Testing Auth Check CPF ===" | tee -a "$LOG_FILE"
run_performance_test "/auth/check-cpf" "POST" '{"cpf":"12345678901"}' 1 "auth_check_cpf_single"
run_performance_test "/auth/check-cpf" "POST" '{"cpf":"12345678901"}' 5 "auth_check_cpf_concurrent_5"

# Test 5: Rate limiting test
echo "=== Testing Rate Limiting ===" | tee -a "$LOG_FILE"
run_performance_test "/auth/check-email" "POST" '{"email":"ratelimit@test.com"}' 100 "rate_limit_test"

# Test 6: Metrics endpoint
echo "=== Testing Metrics Endpoint ===" | tee -a "$LOG_FILE"
run_performance_test "/metrics" "GET" "" 1 "metrics_single"
run_performance_test "/metrics" "GET" "" 5 "metrics_concurrent_5"

# Generate performance report
echo "=== Generating Performance Report ===" | tee -a "$LOG_FILE"

# Add summary to results
jq '.summary = {
  "total_tests": (.tests | length),
  "avg_response_times": [.tests[] | .avg_response_time],
  "success_rates": [.tests[] | .success_rate],
  "tests_with_errors": [.tests[] | select(.error_count > 0) | .endpoint],
  "slowest_endpoints": [.tests[] | select(.avg_response_time > 1.0) | {endpoint: .endpoint, time: .avg_response_time}],
  "fastest_endpoints": [.tests[] | select(.avg_response_time < 0.5) | {endpoint: .endpoint, time: .avg_response_time}]
}' "$RESULTS_FILE" > "/tmp/temp_summary.json" && mv "/tmp/temp_summary.json" "$RESULTS_FILE"

echo "Performance test completed!" | tee -a "$LOG_FILE"
echo "Full results available at: $RESULTS_FILE" | tee -a "$LOG_FILE"
echo "Log file available at: $LOG_FILE" | tee -a "$LOG_FILE"

# Display summary
echo "=== PERFORMANCE SUMMARY ===" | tee -a "$LOG_FILE"
jq -r '.summary | "Total Tests: \(.total_tests)", "Tests with Errors: \(.tests_with_errors | length)", "Slowest Endpoints (>1s): \(.slowest_endpoints | length)", "Fastest Endpoints (<0.5s): \(.fastest_endpoints | length)"' "$RESULTS_FILE" | tee -a "$LOG_FILE"

echo ""
echo "Slowest endpoints:"
jq -r '.summary.slowest_endpoints[]? | "  \(.endpoint): \(.time)s"' "$RESULTS_FILE" | tee -a "$LOG_FILE"

echo ""
echo "Tests with errors:"
jq -r '.tests[] | select(.error_count > 0) | "  \(.endpoint): \(.error_count) errors out of \(.concurrent_requests) requests"' "$RESULTS_FILE" | tee -a "$LOG_FILE"

chmod +x /Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/backend/scripts/api_load_test.sh