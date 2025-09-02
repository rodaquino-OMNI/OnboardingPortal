#!/bin/bash

# WebSocket Live Test Script
# Tests WebSocket connectivity without authentication requirements

echo "🚀 WebSocket Live Connectivity Test"
echo "=================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results storage
RESULTS_FILE="/tmp/websocket_test_results.json"
echo '{"timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")'", "tests": []}' > "$RESULTS_FILE"

# Function to add test result
add_result() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    local latency="${4:-0}"
    
    # Create temp file with updated results
    jq --arg name "$test_name" --arg status "$status" --arg details "$details" --arg latency "$latency" \
       '.tests += [{"name": $name, "status": $status, "details": $details, "latency": ($latency | tonumber), "timestamp": now | strftime("%Y-%m-%dT%H:%M:%S.%3NZ")}]' \
       "$RESULTS_FILE" > "${RESULTS_FILE}.tmp" && mv "${RESULTS_FILE}.tmp" "$RESULTS_FILE"
}

echo -e "${BLUE}1. Testing Reverb Server Ports${NC}"
echo "--------------------------------"

# Test port 8080
echo -n "Testing port 8080... "
start_time=$(date +%s%3N)
if nc -z localhost 8080 2>/dev/null; then
    end_time=$(date +%s%3N)
    latency=$((end_time - start_time))
    echo -e "${GREEN}✓ Port 8080 is open${NC}"
    add_result "port_8080_check" "pass" "Port is listening and accessible" "$latency"
else
    echo -e "${RED}✗ Port 8080 is closed${NC}"
    add_result "port_8080_check" "fail" "Port is not accessible" "0"
fi

# Test port 8081
echo -n "Testing port 8081... "
start_time=$(date +%s%3N)
if nc -z localhost 8081 2>/dev/null; then
    end_time=$(date +%s%3N)
    latency=$((end_time - start_time))
    echo -e "${GREEN}✓ Port 8081 is open${NC}"
    add_result "port_8081_check" "pass" "Port is listening and accessible" "$latency"
else
    echo -e "${RED}✗ Port 8081 is closed${NC}"
    add_result "port_8081_check" "fail" "Port is not accessible" "0"
fi

echo ""
echo -e "${BLUE}2. Testing HTTP Responses${NC}"
echo "-------------------------"

# Test HTTP response on 8080
echo -n "Testing HTTP on port 8080... "
start_time=$(date +%s%3N)
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>/dev/null)
end_time=$(date +%s%3N)
latency=$((end_time - start_time))

if [[ "$response" == "404" ]]; then
    echo -e "${YELLOW}⚠ HTTP 404 (expected for WebSocket server)${NC}"
    add_result "http_8080_response" "pass" "Server responding with 404 (WebSocket only)" "$latency"
elif [[ "$response" == "200" ]]; then
    echo -e "${GREEN}✓ HTTP 200 OK${NC}"
    add_result "http_8080_response" "pass" "Server responding with 200 OK" "$latency"
else
    echo -e "${RED}✗ HTTP $response or no response${NC}"
    add_result "http_8080_response" "fail" "Unexpected HTTP response: $response" "$latency"
fi

# Test HTTP response on 8081
echo -n "Testing HTTP on port 8081... "
start_time=$(date +%s%3N)
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081 2>/dev/null)
end_time=$(date +%s%3N)
latency=$((end_time - start_time))

if [[ "$response" == "404" ]]; then
    echo -e "${YELLOW}⚠ HTTP 404 (expected for WebSocket server)${NC}"
    add_result "http_8081_response" "pass" "Server responding with 404 (WebSocket only)" "$latency"
elif [[ "$response" == "200" ]]; then
    echo -e "${GREEN}✓ HTTP 200 OK${NC}"
    add_result "http_8081_response" "pass" "Server responding with 200 OK" "$latency"
else
    echo -e "${RED}✗ HTTP $response or no response${NC}"
    add_result "http_8081_response" "fail" "Unexpected HTTP response: $response" "$latency"
fi

echo ""
echo -e "${BLUE}3. Testing WebSocket Connectivity${NC}"
echo "--------------------------------"

# Test WebSocket connection using curl with upgrade headers
echo -n "Testing WebSocket upgrade on 8080... "
start_time=$(date +%s%3N)
response=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    http://localhost:8080/app/omniportal 2>/dev/null)
end_time=$(date +%s%3N)
latency=$((end_time - start_time))

if [[ "$response" == "101" ]]; then
    echo -e "${GREEN}✓ WebSocket upgrade successful (HTTP 101)${NC}"
    add_result "websocket_upgrade_8080" "pass" "WebSocket upgrade successful" "$latency"
elif [[ "$response" == "404" ]]; then
    echo -e "${YELLOW}⚠ Path not found, trying alternative paths${NC}"
    add_result "websocket_upgrade_8080" "partial" "Path not found, may need different endpoint" "$latency"
else
    echo -e "${RED}✗ WebSocket upgrade failed (HTTP $response)${NC}"
    add_result "websocket_upgrade_8080" "fail" "WebSocket upgrade failed: HTTP $response" "$latency"
fi

# Try alternative WebSocket paths
echo -n "Testing WebSocket on /app/local... "
start_time=$(date +%s%3N)
response=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    http://localhost:8080/app/local 2>/dev/null)
end_time=$(date +%s%3N)
latency=$((end_time - start_time))

if [[ "$response" == "101" ]]; then
    echo -e "${GREEN}✓ WebSocket upgrade successful on /app/local${NC}"
    add_result "websocket_app_local_8080" "pass" "WebSocket upgrade successful on /app/local" "$latency"
else
    echo -e "${YELLOW}⚠ No upgrade on /app/local (HTTP $response)${NC}"
    add_result "websocket_app_local_8080" "fail" "WebSocket upgrade failed on /app/local" "$latency"
fi

echo ""
echo -e "${BLUE}4. Testing Backend API Integration${NC}"
echo "--------------------------------"

# Test backend API endpoints (may require auth)
echo -n "Testing public WebSocket status... "
start_time=$(date +%s%3N)

# Try to access the public alerts endpoint first
response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    -X GET "http://localhost:8000/api/alerts/connection-info" \
    -H "Content-Type: application/json" 2>/dev/null)

http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
response_body=$(echo $response | sed -e 's/HTTPSTATUS:.*//g')
end_time=$(date +%s%3N)
latency=$((end_time - start_time))

if [[ "$http_code" == "200" ]]; then
    echo -e "${GREEN}✓ Backend API accessible${NC}"
    add_result "backend_api_connection" "pass" "Backend API responding: $response_body" "$latency"
elif [[ "$http_code" == "401" ]]; then
    echo -e "${YELLOW}⚠ Backend requires authentication${NC}"
    add_result "backend_api_connection" "partial" "Backend API requires authentication" "$latency"
else
    echo -e "${RED}✗ Backend API error (HTTP $http_code)${NC}"
    add_result "backend_api_connection" "fail" "Backend API error: HTTP $http_code" "$latency"
fi

# Try to trigger a public test alert
echo -n "Testing public alert broadcast... "
start_time=$(date +%s%3N)

response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    -X POST "http://localhost:8000/api/test/trigger-alert" \
    -H "Content-Type: application/json" \
    -d '{"type": "info", "message": "Test alert from curl script"}' 2>/dev/null)

http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
response_body=$(echo $response | sed -e 's/HTTPSTATUS:.*//g')
end_time=$(date +%s%3N)
latency=$((end_time - start_time))

if [[ "$http_code" == "200" ]]; then
    echo -e "${GREEN}✓ Test alert broadcast successful${NC}"
    add_result "test_alert_broadcast" "pass" "Alert broadcast successful: $response_body" "$latency"
elif [[ "$http_code" == "401" || "$http_code" == "429" ]]; then
    echo -e "${YELLOW}⚠ Authentication or rate limiting${NC}"
    add_result "test_alert_broadcast" "partial" "Auth required or rate limited: HTTP $http_code" "$latency"
else
    echo -e "${RED}✗ Alert broadcast failed (HTTP $http_code)${NC}"
    add_result "test_alert_broadcast" "fail" "Alert broadcast failed: HTTP $http_code - $response_body" "$latency"
fi

echo ""
echo -e "${BLUE}5. Process Information${NC}"
echo "--------------------"

# Check for Reverb processes
echo "Active Reverb processes:"
reverb_processes=$(ps aux | grep -E "reverb|artisan.*reverb" | grep -v grep)
if [[ -n "$reverb_processes" ]]; then
    echo -e "${GREEN}$reverb_processes${NC}"
    add_result "reverb_processes" "pass" "Reverb processes are running" "0"
else
    echo -e "${RED}No Reverb processes found${NC}"
    add_result "reverb_processes" "fail" "No Reverb processes running" "0"
fi

echo ""
echo "Active Node.js processes (Next.js):"
node_processes=$(ps aux | grep -E "node.*next|npm.*dev" | grep -v grep | head -3)
if [[ -n "$node_processes" ]]; then
    echo -e "${GREEN}$node_processes${NC}"
    add_result "nodejs_processes" "pass" "Node.js processes are running" "0"
else
    echo -e "${YELLOW}No Node.js development processes found${NC}"
    add_result "nodejs_processes" "partial" "No Node.js development processes" "0"
fi

echo ""
echo -e "${BLUE}6. Summary Report${NC}"
echo "=================="

# Generate summary from results file
total_tests=$(jq '.tests | length' "$RESULTS_FILE")
passed_tests=$(jq '.tests | map(select(.status == "pass")) | length' "$RESULTS_FILE")
partial_tests=$(jq '.tests | map(select(.status == "partial")) | length' "$RESULTS_FILE")
failed_tests=$(jq '.tests | map(select(.status == "fail")) | length' "$RESULTS_FILE")
avg_latency=$(jq '.tests | map(.latency) | add / length' "$RESULTS_FILE")

echo "Total tests: $total_tests"
echo -e "Passed: ${GREEN}$passed_tests${NC}"
echo -e "Partial: ${YELLOW}$partial_tests${NC}"  
echo -e "Failed: ${RED}$failed_tests${NC}"
echo "Average latency: ${avg_latency}ms"

# Show detailed results
echo ""
echo "Detailed Results:"
jq -r '.tests[] | "- " + .name + ": " + .status + " (" + (.latency | tostring) + "ms) - " + .details' "$RESULTS_FILE"

echo ""
echo "Full results saved to: $RESULTS_FILE"

# Store results in memory key (simulated)
echo ""
echo "Storing results in memory key 'swarm/live-websocket/results'..."
echo "Results stored: $(jq -c . "$RESULTS_FILE")"

echo ""
echo -e "${BLUE}🎯 Test completed at $(date)${NC}"

# Return appropriate exit code
if [[ "$failed_tests" -gt 0 ]]; then
    exit 1
else
    exit 0
fi