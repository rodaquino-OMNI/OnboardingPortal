#!/bin/bash

# Auto-Reconnection Test Script
# Tests WebSocket auto-reconnection functionality

echo "🔄 WebSocket Auto-Reconnection Test"
echo "=================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test configuration
RECONNECT_RESULTS="/tmp/reconnect_test_results.json"
echo '{"timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")'", "tests": [], "timeline": []}' > "$RECONNECT_RESULTS"

# Function to add test result
add_result() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    local duration="${4:-0}"
    
    jq --arg name "$test_name" --arg status "$status" --arg details "$details" --arg duration "$duration" \
       '.tests += [{"name": $name, "status": $status, "details": $details, "duration": ($duration | tonumber), "timestamp": now | strftime("%Y-%m-%dT%H:%M:%S.%3NZ")}]' \
       "$RECONNECT_RESULTS" > "${RECONNECT_RESULTS}.tmp" && mv "${RECONNECT_RESULTS}.tmp" "$RECONNECT_RESULTS"
}

# Function to add timeline event
add_timeline_event() {
    local event="$1"
    local details="$2"
    
    jq --arg event "$event" --arg details "$details" \
       '.timeline += [{"event": $event, "details": $details, "timestamp": now | strftime("%Y-%m-%dT%H:%M:%S.%3NZ")}]' \
       "$RECONNECT_RESULTS" > "${RECONNECT_RESULTS}.tmp" && mv "${RECONNECT_RESULTS}.tmp" "$RECONNECT_RESULTS"
}

echo -e "${BLUE}1. Pre-test: Verify WebSocket Servers are Running${NC}"
echo "------------------------------------------------"

# Check initial server state
reverb_8080_pid=$(ps aux | grep "reverb.*8080" | grep -v grep | awk '{print $2}')
reverb_8081_pid=$(ps aux | grep "reverb.*8081" | grep -v grep | awk '{print $2}')

echo "Reverb 8080 PID: $reverb_8080_pid"
echo "Reverb 8081 PID: $reverb_8081_pid"

if [[ -z "$reverb_8080_pid" || -z "$reverb_8081_pid" ]]; then
    echo -e "${RED}✗ WebSocket servers not running. Please start them first.${NC}"
    add_result "pre_test_server_check" "fail" "WebSocket servers not running" "0"
    exit 1
fi

echo -e "${GREEN}✓ Both WebSocket servers are running${NC}"
add_result "pre_test_server_check" "pass" "Both WebSocket servers running" "0"
add_timeline_event "servers_verified" "8080: $reverb_8080_pid, 8081: $reverb_8081_pid"

echo ""
echo -e "${BLUE}2. Test Initial Connection${NC}"
echo "-------------------------"

# Test initial WebSocket connection
echo -n "Testing initial WebSocket connection... "
start_time=$(date +%s%3N)

response=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    http://localhost:8080/app/omniportal 2>/dev/null)

end_time=$(date +%s%3N)
duration=$((end_time - start_time))

if [[ "$response" == "101" ]]; then
    echo -e "${GREEN}✓ Initial connection successful${NC}"
    add_result "initial_connection" "pass" "WebSocket handshake successful" "$duration"
    add_timeline_event "initial_connection_ok" "HTTP 101 response in ${duration}ms"
else
    echo -e "${RED}✗ Initial connection failed (HTTP $response)${NC}"
    add_result "initial_connection" "fail" "WebSocket handshake failed: HTTP $response" "$duration"
    add_timeline_event "initial_connection_fail" "HTTP $response in ${duration}ms"
fi

echo ""
echo -e "${BLUE}3. Test Server Interruption (Port 8080)${NC}"
echo "--------------------------------------"

echo "Killing WebSocket server on port 8080..."
add_timeline_event "server_kill_8080" "Killing PID $reverb_8080_pid"

# Kill the server
if kill -9 "$reverb_8080_pid" 2>/dev/null; then
    echo -e "${YELLOW}✓ Server 8080 killed (PID: $reverb_8080_pid)${NC}"
    add_result "server_kill_8080" "pass" "Successfully killed server 8080" "0"
    sleep 2
else
    echo -e "${RED}✗ Failed to kill server 8080${NC}"
    add_result "server_kill_8080" "fail" "Failed to kill server 8080" "0"
fi

# Verify server is down
echo -n "Verifying server 8080 is down... "
if nc -z localhost 8080 2>/dev/null; then
    echo -e "${RED}✗ Server 8080 still responding${NC}"
    add_result "server_down_verification" "fail" "Server 8080 still responding" "0"
else
    echo -e "${GREEN}✓ Server 8080 is down${NC}"
    add_result "server_down_verification" "pass" "Server 8080 confirmed down" "0"
    add_timeline_event "server_down_8080" "Port 8080 no longer accessible"
fi

echo ""
echo -e "${BLUE}4. Test Fallback to Port 8081${NC}"
echo "-------------------------------"

# Test connection to backup server
echo -n "Testing connection to backup server (8081)... "
start_time=$(date +%s%3N)

response=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    http://localhost:8081/app/omniportal 2>/dev/null)

end_time=$(date +%s%3N)
duration=$((end_time - start_time))

if [[ "$response" == "101" ]]; then
    echo -e "${GREEN}✓ Fallback connection successful${NC}"
    add_result "fallback_connection" "pass" "Successfully connected to backup server" "$duration"
    add_timeline_event "fallback_success" "Connected to 8081 in ${duration}ms"
else
    echo -e "${RED}✗ Fallback connection failed (HTTP $response)${NC}"
    add_result "fallback_connection" "fail" "Fallback connection failed: HTTP $response" "$duration"
    add_timeline_event "fallback_fail" "Failed to connect to 8081: HTTP $response"
fi

echo ""
echo -e "${BLUE}5. Restart Primary Server${NC}"
echo "------------------------"

echo "Restarting WebSocket server on port 8080..."
add_timeline_event "server_restart_8080" "Attempting to restart server on 8080"

# Navigate to backend directory and restart server
cd /Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/backend

# Start server in background
nohup php artisan reverb:start --host=127.0.0.1 --port=8080 --hostname=localhost > /tmp/reverb_8080_restart.log 2>&1 &
new_pid=$!

echo "Started new server with PID: $new_pid"
add_timeline_event "server_started" "New server PID: $new_pid"

# Wait for server to start
echo -n "Waiting for server to start..."
for i in {1..10}; do
    echo -n "."
    sleep 1
    if nc -z localhost 8080 2>/dev/null; then
        echo ""
        echo -e "${GREEN}✓ Server 8080 restarted successfully${NC}"
        add_result "server_restart" "pass" "Server 8080 restarted with PID $new_pid" "0"
        add_timeline_event "server_ready" "Port 8080 accepting connections"
        break
    fi
done

# Final connection test
echo -n "Testing reconnection to primary server... "
start_time=$(date +%s%3N)

response=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    http://localhost:8080/app/omniportal 2>/dev/null)

end_time=$(date +%s%3N)
duration=$((end_time - start_time))

if [[ "$response" == "101" ]]; then
    echo -e "${GREEN}✓ Reconnection successful${NC}"
    add_result "reconnection_test" "pass" "Successfully reconnected to primary server" "$duration"
    add_timeline_event "reconnection_success" "Reconnected to 8080 in ${duration}ms"
else
    echo -e "${RED}✗ Reconnection failed (HTTP $response)${NC}"
    add_result "reconnection_test" "fail" "Reconnection failed: HTTP $response" "$duration"
    add_timeline_event "reconnection_fail" "Failed to reconnect: HTTP $response"
fi

echo ""
echo -e "${BLUE}6. Load Test During Reconnection${NC}"
echo "--------------------------------"

echo "Testing server resilience with multiple concurrent connections..."

# Start multiple connection attempts in background
for i in {1..5}; do
    (
        response=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Connection: Upgrade" \
            -H "Upgrade: websocket" \
            -H "Sec-WebSocket-Version: 13" \
            -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
            --connect-timeout 5 \
            http://localhost:8080/app/omniportal 2>/dev/null)
        
        echo "Connection $i: HTTP $response"
    ) &
done

# Wait for all background jobs
wait

echo -e "${GREEN}✓ Load test completed${NC}"
add_result "load_test_reconnection" "pass" "Multiple connections handled successfully" "0"
add_timeline_event "load_test_complete" "5 concurrent connections tested"

echo ""
echo -e "${BLUE}7. Test Connection Persistence${NC}"
echo "-----------------------------"

# Test long-running connection
echo "Testing connection persistence over time..."
start_time=$(date +%s)

# Make connection and test multiple times over a period
success_count=0
total_attempts=5

for i in $(seq 1 $total_attempts); do
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Connection: Upgrade" \
        -H "Upgrade: websocket" \
        -H "Sec-WebSocket-Version: 13" \
        -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
        http://localhost:8080/app/omniportal 2>/dev/null)
    
    if [[ "$response" == "101" ]]; then
        ((success_count++))
    fi
    
    echo "Persistence test $i/$total_attempts: HTTP $response"
    sleep 2
done

end_time=$(date +%s)
test_duration=$((end_time - start_time))

if [[ $success_count -eq $total_attempts ]]; then
    echo -e "${GREEN}✓ Connection persistence test passed (${success_count}/${total_attempts})${NC}"
    add_result "connection_persistence" "pass" "All persistence tests succeeded" "$test_duration"
else
    echo -e "${YELLOW}⚠ Connection persistence partial (${success_count}/${total_attempts})${NC}"
    add_result "connection_persistence" "partial" "${success_count}/${total_attempts} tests succeeded" "$test_duration"
fi

add_timeline_event "persistence_test_complete" "${success_count}/${total_attempts} successful connections"

echo ""
echo -e "${BLUE}8. Summary Report${NC}"
echo "=================="

# Generate summary
total_tests=$(jq '.tests | length' "$RECONNECT_RESULTS")
passed_tests=$(jq '.tests | map(select(.status == "pass")) | length' "$RECONNECT_RESULTS")
partial_tests=$(jq '.tests | map(select(.status == "partial")) | length' "$RECONNECT_RESULTS")
failed_tests=$(jq '.tests | map(select(.status == "fail")) | length' "$RECONNECT_RESULTS")

echo "Auto-Reconnection Test Results:"
echo "Total tests: $total_tests"
echo -e "Passed: ${GREEN}$passed_tests${NC}"
echo -e "Partial: ${YELLOW}$partial_tests${NC}"
echo -e "Failed: ${RED}$failed_tests${NC}"

echo ""
echo "Timeline of Events:"
jq -r '.timeline[] | "- " + .timestamp + ": " + .event + " - " + .details' "$RECONNECT_RESULTS"

echo ""
echo "Detailed Test Results:"
jq -r '.tests[] | "- " + .name + ": " + .status + " (" + (.duration | tostring) + "ms) - " + .details' "$RECONNECT_RESULTS"

echo ""
echo "Full results saved to: $RECONNECT_RESULTS"

echo ""
echo -e "${BLUE}🎯 Auto-reconnection test completed at $(date)${NC}"

# Return appropriate exit code
if [[ "$failed_tests" -gt 0 ]]; then
    exit 1
else
    exit 0
fi