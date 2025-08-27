#!/bin/bash

# Comprehensive Load Testing Suite for Onboarding Portal
# Tests critical endpoints with increasing load levels

BASE_URL="http://127.0.0.1:8000"
OUTPUT_DIR="/Users/rodrigo/claude-projects/OnboardingPortal/load_test_results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Test configuration
declare -A ENDPOINTS=(
    ["auth_login"]="/api/auth/login"
    ["health_check"]="/api/health"
    ["health_questionnaire"]="/api/health-questionnaires/templates"
    ["gamification"]="/api/gamification/progress"
)

# Load levels to test (concurrent requests)
LOAD_LEVELS=(1 5 10 20 50 100)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Function to test authentication endpoint
test_auth_login() {
    local concurrent=$1
    local total_requests=$((concurrent * 10))
    
    log "Testing auth/login with $concurrent concurrent users ($total_requests total requests)"
    
    # Create login payload
    local payload='{"email":"test@example.com","password":"password123","device_name":"load_test"}'
    
    # Run load test using Apache Bench (ab) if available, otherwise use curl
    if command -v ab &> /dev/null; then
        ab -n $total_requests -c $concurrent -T 'application/json' \
           -p <(echo "$payload") "$BASE_URL/api/auth/login" \
           > "$OUTPUT_DIR/auth_login_${concurrent}_${TIMESTAMP}.txt" 2>&1
    else
        # Fallback to parallel curl requests
        local temp_dir=$(mktemp -d)
        
        for ((i=1; i<=total_requests; i++)); do
            curl -s -w "Time: %{time_total}s, Status: %{http_code}, Size: %{size_download}\n" \
                 -H "Content-Type: application/json" \
                 -d "$payload" \
                 "$BASE_URL/api/auth/login" >> "$temp_dir/result_$((i % concurrent))" &
            
            # Limit concurrent processes
            if (( i % concurrent == 0 )); then
                wait
            fi
        done
        wait
        
        # Combine results
        cat "$temp_dir"/result_* > "$OUTPUT_DIR/auth_login_${concurrent}_${TIMESTAMP}.txt"
        rm -rf "$temp_dir"
    fi
}

# Function to test health endpoint
test_health_endpoint() {
    local concurrent=$1
    local total_requests=$((concurrent * 20))
    
    log "Testing health endpoint with $concurrent concurrent users ($total_requests total requests)"
    
    if command -v ab &> /dev/null; then
        ab -n $total_requests -c $concurrent "$BASE_URL/api/health" \
           > "$OUTPUT_DIR/health_${concurrent}_${TIMESTAMP}.txt" 2>&1
    else
        local temp_dir=$(mktemp -d)
        
        for ((i=1; i<=total_requests; i++)); do
            curl -s -w "Time: %{time_total}s, Status: %{http_code}, Size: %{size_download}\n" \
                 "$BASE_URL/api/health" >> "$temp_dir/result_$((i % concurrent))" &
            
            if (( i % concurrent == 0 )); then
                wait
            fi
        done
        wait
        
        cat "$temp_dir"/result_* > "$OUTPUT_DIR/health_${concurrent}_${TIMESTAMP}.txt"
        rm -rf "$temp_dir"
    fi
}

# Function to test questionnaire endpoint
test_questionnaire_endpoint() {
    local concurrent=$1
    local total_requests=$((concurrent * 15))
    
    log "Testing questionnaire templates with $concurrent concurrent users ($total_requests total requests)"
    
    # This endpoint requires authentication, so we'll test with a token
    local auth_token="1|test_token_for_load_testing"
    
    if command -v ab &> /dev/null; then
        ab -n $total_requests -c $concurrent \
           -H "Authorization: Bearer $auth_token" \
           -H "Accept: application/json" \
           "$BASE_URL/api/health-questionnaires/templates" \
           > "$OUTPUT_DIR/questionnaire_${concurrent}_${TIMESTAMP}.txt" 2>&1
    else
        local temp_dir=$(mktemp -d)
        
        for ((i=1; i<=total_requests; i++)); do
            curl -s -w "Time: %{time_total}s, Status: %{http_code}, Size: %{size_download}\n" \
                 -H "Authorization: Bearer $auth_token" \
                 -H "Accept: application/json" \
                 "$BASE_URL/api/health-questionnaires/templates" >> "$temp_dir/result_$((i % concurrent))" &
            
            if (( i % concurrent == 0 )); then
                wait
            fi
        done
        wait
        
        cat "$temp_dir"/result_* > "$OUTPUT_DIR/questionnaire_${concurrent}_${TIMESTAMP}.txt"
        rm -rf "$temp_dir"
    fi
}

# Function to analyze results
analyze_results() {
    log "Analyzing load test results..."
    
    local analysis_file="$OUTPUT_DIR/load_test_analysis_${TIMESTAMP}.txt"
    
    echo "=== LOAD TEST ANALYSIS REPORT ===" > "$analysis_file"
    echo "Test Date: $(date)" >> "$analysis_file"
    echo "Base URL: $BASE_URL" >> "$analysis_file"
    echo "" >> "$analysis_file"
    
    for level in "${LOAD_LEVELS[@]}"; do
        echo "=== CONCURRENT USERS: $level ===" >> "$analysis_file"
        
        # Analyze auth login results
        if [ -f "$OUTPUT_DIR/auth_login_${level}_${TIMESTAMP}.txt" ]; then
            echo "--- Auth Login Results ---" >> "$analysis_file"
            if command -v ab &> /dev/null; then
                grep -E "(Requests per second|Time per request|Transfer rate)" "$OUTPUT_DIR/auth_login_${level}_${TIMESTAMP}.txt" >> "$analysis_file" 2>/dev/null || echo "No ab results found" >> "$analysis_file"
            else
                # Analyze curl results
                local total_time=$(grep "Time:" "$OUTPUT_DIR/auth_login_${level}_${TIMESTAMP}.txt" | awk '{print $2}' | sed 's/s//' | awk '{sum+=$1} END {print sum}')
                local avg_time=$(echo "$total_time / $(grep -c "Time:" "$OUTPUT_DIR/auth_login_${level}_${TIMESTAMP}.txt")" | bc -l 2>/dev/null || echo "N/A")
                local success_rate=$(grep -c "Status: 200" "$OUTPUT_DIR/auth_login_${level}_${TIMESTAMP}.txt")
                local total_requests=$(grep -c "Status:" "$OUTPUT_DIR/auth_login_${level}_${TIMESTAMP}.txt")
                
                echo "Average Response Time: ${avg_time}s" >> "$analysis_file"
                echo "Success Rate: $success_rate/$total_requests" >> "$analysis_file"
                echo "Total Time: ${total_time}s" >> "$analysis_file"
            fi
            echo "" >> "$analysis_file"
        fi
        
        # Analyze health endpoint results
        if [ -f "$OUTPUT_DIR/health_${level}_${TIMESTAMP}.txt" ]; then
            echo "--- Health Endpoint Results ---" >> "$analysis_file"
            if command -v ab &> /dev/null; then
                grep -E "(Requests per second|Time per request|Transfer rate)" "$OUTPUT_DIR/health_${level}_${TIMESTAMP}.txt" >> "$analysis_file" 2>/dev/null || echo "No ab results found" >> "$analysis_file"
            else
                local total_time=$(grep "Time:" "$OUTPUT_DIR/health_${level}_${TIMESTAMP}.txt" | awk '{print $2}' | sed 's/s//' | awk '{sum+=$1} END {print sum}')
                local avg_time=$(echo "scale=4; $total_time / $(grep -c "Time:" "$OUTPUT_DIR/health_${level}_${TIMESTAMP}.txt")" | bc -l 2>/dev/null || echo "N/A")
                local success_rate=$(grep -c "Status: 200" "$OUTPUT_DIR/health_${level}_${TIMESTAMP}.txt")
                local total_requests=$(grep -c "Status:" "$OUTPUT_DIR/health_${level}_${TIMESTAMP}.txt")
                
                echo "Average Response Time: ${avg_time}s" >> "$analysis_file"
                echo "Success Rate: $success_rate/$total_requests" >> "$analysis_file"
            fi
            echo "" >> "$analysis_file"
        fi
        
        echo "=================================" >> "$analysis_file"
        echo "" >> "$analysis_file"
    done
    
    log "Analysis complete. Results saved to: $analysis_file"
}

# Function to monitor database during tests
monitor_database() {
    log "Starting database monitoring..."
    
    local monitor_file="$OUTPUT_DIR/db_monitor_${TIMESTAMP}.txt"
    
    # Monitor SQLite database size and connection attempts
    while true; do
        echo "$(date '+%H:%M:%S'): Database size: $(ls -lh database/database.sqlite 2>/dev/null | awk '{print $5}' || echo 'N/A')" >> "$monitor_file"
        
        # Check for slow queries in Laravel logs
        if [ -f "storage/logs/laravel.log" ]; then
            local slow_queries=$(tail -100 storage/logs/laravel.log | grep -c "slow" 2>/dev/null || echo 0)
            echo "$(date '+%H:%M:%S'): Recent slow queries: $slow_queries" >> "$monitor_file"
        fi
        
        sleep 5
    done &
    
    local monitor_pid=$!
    echo $monitor_pid > "$OUTPUT_DIR/monitor.pid"
}

# Function to stop monitoring
stop_monitoring() {
    if [ -f "$OUTPUT_DIR/monitor.pid" ]; then
        local monitor_pid=$(cat "$OUTPUT_DIR/monitor.pid")
        kill $monitor_pid 2>/dev/null || true
        rm "$OUTPUT_DIR/monitor.pid"
        log "Database monitoring stopped"
    fi
}

# Main execution
main() {
    log "Starting comprehensive load testing suite..."
    log "Results will be saved to: $OUTPUT_DIR"
    
    # Start database monitoring
    monitor_database
    
    # Test each load level
    for level in "${LOAD_LEVELS[@]}"; do
        log "=== TESTING LOAD LEVEL: $level CONCURRENT USERS ==="
        
        # Test health endpoint (lightest load)
        test_health_endpoint $level
        sleep 2
        
        # Test authentication (medium load)
        test_auth_login $level
        sleep 2
        
        # Test questionnaire endpoint (heavier load)
        test_questionnaire_endpoint $level
        sleep 5
        
        log "Completed load level $level. Waiting before next level..."
        sleep 10
    done
    
    # Stop monitoring
    stop_monitoring
    
    # Analyze results
    analyze_results
    
    log "Load testing completed successfully!"
    log "Check results in: $OUTPUT_DIR"
}

# Trap to clean up on exit
trap 'stop_monitoring; exit 0' INT TERM

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
    error "Server is not responding at $BASE_URL"
    error "Please ensure the Laravel server is running with: php artisan serve"
    exit 1
fi

# Run main function
main "$@"