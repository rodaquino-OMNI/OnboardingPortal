#!/bin/bash

# Simple Bash-based Load Testing for Onboarding Portal
# Tests critical API endpoints with increasing concurrent load

BASE_URL="http://127.0.0.1:8002"
OUTPUT_DIR="/Users/rodrigo/claude-projects/OnboardingPortal/load_test_results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Function to test a single endpoint
test_single_endpoint() {
    local url="$1"
    local method="$2"
    local data="$3"
    local headers="$4"
    
    local start_time=$(date +%s.%N)
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        local response=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total};SIZE:%{size_download}" \
                            -X POST \
                            -H "Content-Type: application/json" \
                            -H "Accept: application/json" \
                            -d "$data" \
                            "$url" 2>/dev/null)
    else
        local response=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total};SIZE:%{size_download}" \
                            -H "Accept: application/json" \
                            "$url" 2>/dev/null)
    fi
    
    local end_time=$(date +%s.%N)
    local actual_time=$(echo "$end_time - $start_time" | bc -l)
    
    # Parse response
    local http_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local response_time=$(echo "$response" | grep -o "TIME:[0-9.]*" | cut -d: -f2)
    local response_size=$(echo "$response" | grep -o "SIZE:[0-9]*" | cut -d: -f2)
    
    # Output CSV line
    echo "${url##*/},${method},${http_code:-0},${response_time:-$actual_time},${response_size:-0},$(date +%s)"
}

# Function to run concurrent requests
run_concurrent_test() {
    local concurrent_users="$1"
    local duration="$2"
    local test_name="$3"
    
    log "Starting $test_name with $concurrent_users concurrent users for ${duration}s"
    
    local output_file="$OUTPUT_DIR/load_test_${test_name}_${concurrent_users}users_${TIMESTAMP}.csv"
    echo "endpoint,method,status_code,response_time,response_size,timestamp" > "$output_file"
    
    # Define endpoints to test
    local endpoints=(
        "$BASE_URL/api/health,GET,,"
        "$BASE_URL/api/info,GET,,"
        "$BASE_URL/api/gamification/progress,GET,,"
        "$BASE_URL/api/gamification/badges,GET,,"
        "$BASE_URL/api/auth/check-email,POST,{\"email\":\"test@example.com\"},"
    )
    
    local start_time=$(date +%s)
    local end_time=$((start_time + duration))
    
    # Function for a single worker
    worker() {
        local worker_id="$1"
        local requests_made=0
        
        while [ $(date +%s) -lt $end_time ]; do
            # Select random endpoint
            local endpoint_line="${endpoints[$RANDOM % ${#endpoints[@]}]}"
            IFS=',' read -r url method data headers <<< "$endpoint_line"
            
            # Make request and append to output
            test_single_endpoint "$url" "$method" "$data" "$headers" >> "$output_file"
            
            requests_made=$((requests_made + 1))
            
            # Small delay to prevent overwhelming
            sleep 0.1
        done
        
        echo "$worker_id:$requests_made" >> "$OUTPUT_DIR/worker_stats_${test_name}_${concurrent_users}.tmp"
    }
    
    # Start concurrent workers
    for ((i=1; i<=concurrent_users; i++)); do
        worker $i &
    done
    
    # Wait for all workers to complete
    wait
    
    # Calculate statistics
    local total_requests=$(wc -l < "$output_file")
    total_requests=$((total_requests - 1))  # Subtract header
    
    local successful_requests=$(awk -F',' '$3 >= 200 && $3 < 400 {count++} END {print count+0}' "$output_file")
    local success_rate=$(echo "scale=2; $successful_requests * 100 / $total_requests" | bc -l)
    
    # Response time statistics
    local avg_time=$(awk -F',' 'NR>1 {sum+=$4; count++} END {if(count>0) print sum/count; else print 0}' "$output_file")
    local min_time=$(awk -F',' 'NR>1 {if(min=="" || $4<min) min=$4} END {print min+0}' "$output_file")
    local max_time=$(awk -F',' 'NR>1 {if($4>max) max=$4} END {print max+0}' "$output_file")
    
    # Calculate P95 (approximate)
    local p95_time=$(awk -F',' 'NR>1 {print $4}' "$output_file" | sort -n | awk '{arr[NR]=$1} END {print arr[int(NR*0.95)]}')
    
    log "Completed $test_name:"
    info "  Total requests: $total_requests"
    info "  Successful requests: $successful_requests"
    info "  Success rate: ${success_rate}%"
    info "  Average response time: ${avg_time}s"
    info "  Min response time: ${min_time}s"
    info "  Max response time: ${max_time}s"
    info "  P95 response time: ${p95_time}s"
    info "  Results saved to: $output_file"
    
    # Clean up temp files
    rm -f "$OUTPUT_DIR"/worker_stats_*.tmp
    
    # Return summary for main report
    echo "$concurrent_users,$total_requests,$successful_requests,$success_rate,$avg_time,$p95_time" >> "$OUTPUT_DIR/summary_${TIMESTAMP}.csv"
}

# Function to analyze logs for slow queries
monitor_laravel_performance() {
    log "Monitoring Laravel performance during tests..."
    
    local log_file="/Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/backend/storage/logs/laravel.log"
    local perf_file="$OUTPUT_DIR/performance_analysis_${TIMESTAMP}.txt"
    
    if [ -f "$log_file" ]; then
        echo "=== LARAVEL PERFORMANCE ANALYSIS ===" > "$perf_file"
        echo "Analysis Date: $(date)" >> "$perf_file"
        echo "" >> "$perf_file"
        
        # Look for slow queries in the last 1000 lines
        echo "RECENT LOG ENTRIES (last 50 lines):" >> "$perf_file"
        tail -50 "$log_file" >> "$perf_file"
        echo "" >> "$perf_file"
        
        # Count error patterns
        echo "ERROR PATTERNS:" >> "$perf_file"
        echo "Fatal errors: $(grep -c "Fatal error" "$log_file" 2>/dev/null || echo 0)" >> "$perf_file"
        echo "Exceptions: $(grep -c "Exception" "$log_file" 2>/dev/null || echo 0)" >> "$perf_file"
        echo "Warnings: $(grep -c "WARN" "$log_file" 2>/dev/null || echo 0)" >> "$perf_file"
        echo "Database errors: $(grep -c "QueryException\|SQLSTATE" "$log_file" 2>/dev/null || echo 0)" >> "$perf_file"
        
        info "Laravel performance analysis saved to: $perf_file"
    else
        warn "Laravel log file not found at: $log_file"
    fi
}

# Function to generate comprehensive report
generate_report() {
    local report_file="$OUTPUT_DIR/load_test_report_${TIMESTAMP}.txt"
    
    log "Generating comprehensive load test report..."
    
    cat > "$report_file" << EOF
=== ONBOARDING PORTAL LOAD TEST REPORT ===
Test Date: $(date)
Base URL: $BASE_URL
Test Duration: Multiple levels (20s each)

EXECUTIVE SUMMARY:
$(head -1 "$OUTPUT_DIR/summary_${TIMESTAMP}.csv" 2>/dev/null || echo "concurrent_users,total_requests,successful_requests,success_rate,avg_response_time,p95_response_time")
$(tail -n +2 "$OUTPUT_DIR/summary_${TIMESTAMP}.csv" 2>/dev/null || echo "No summary data available")

DETAILED RESULTS BY LOAD LEVEL:
EOF
    
    # Add detailed analysis for each load level
    for csv_file in "$OUTPUT_DIR"/load_test_*_"${TIMESTAMP}".csv; do
        if [ -f "$csv_file" ]; then
            local filename=$(basename "$csv_file")
            local users=$(echo "$filename" | grep -o '[0-9]\+users' | grep -o '[0-9]\+')
            
            echo "" >> "$report_file"
            echo "=== $users CONCURRENT USERS ===" >> "$report_file"
            
            # Endpoint breakdown
            echo "Endpoint Performance Breakdown:" >> "$report_file"
            awk -F',' 'NR>1 {
                endpoint[$1]++; 
                if($3>=200 && $3<400) success[$1]++; 
                time_sum[$1]+=$4
            } 
            END {
                for(ep in endpoint) {
                    succ = success[ep] ? success[ep] : 0;
                    rate = endpoint[ep] ? (succ/endpoint[ep]*100) : 0;
                    avg_time = endpoint[ep] ? (time_sum[ep]/endpoint[ep]) : 0;
                    printf "  %s: %d requests, %.1f%% success, %.3fs avg\n", ep, endpoint[ep], rate, avg_time
                }
            }' "$csv_file" >> "$report_file"
            
            # Status code distribution
            echo "Status Code Distribution:" >> "$report_file"
            awk -F',' 'NR>1 {codes[$3]++} END {for(code in codes) printf "  HTTP %s: %d\n", code, codes[code]}' "$csv_file" >> "$report_file"
        fi
    done
    
    info "Comprehensive report generated: $report_file"
}

# Main execution
main() {
    log "Starting Onboarding Portal Load Test Suite"
    info "Target URL: $BASE_URL"
    info "Output Directory: $OUTPUT_DIR"
    
    # Check if server is responding
    if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
        error "Server is not responding at $BASE_URL"
        error "Please ensure the Laravel server is running"
        exit 1
    fi
    
    log "Server connectivity confirmed"
    
    # Initialize summary file
    echo "concurrent_users,total_requests,successful_requests,success_rate,avg_response_time,p95_response_time" > "$OUTPUT_DIR/summary_${TIMESTAMP}.csv"
    
    # Start performance monitoring
    monitor_laravel_performance &
    local monitor_pid=$!
    
    # Test different load levels
    local load_levels=(1 5 10 20 30)
    
    for level in "${load_levels[@]}"; do
        run_concurrent_test "$level" 20 "baseline"
        sleep 3  # Brief pause between tests
    done
    
    # Stop monitoring
    kill $monitor_pid 2>/dev/null || true
    
    # Generate comprehensive report
    generate_report
    
    log "Load testing completed successfully!"
    info "Check results in: $OUTPUT_DIR/"
    
    # Display quick summary
    echo ""
    log "QUICK SUMMARY:"
    if [ -f "$OUTPUT_DIR/summary_${TIMESTAMP}.csv" ]; then
        column -t -s',' "$OUTPUT_DIR/summary_${TIMESTAMP}.csv"
    fi
}

# Check for required dependencies
check_dependencies() {
    local missing_deps=0
    
    if ! command -v curl &> /dev/null; then
        error "curl is required but not installed"
        missing_deps=1
    fi
    
    if ! command -v bc &> /dev/null; then
        error "bc is required but not installed"
        missing_deps=1
    fi
    
    if [ $missing_deps -eq 1 ]; then
        error "Please install missing dependencies"
        exit 1
    fi
}

# Trap to clean up on exit
trap 'jobs -p | xargs -r kill; exit 0' INT TERM

# Run dependency check and main function
check_dependencies
main "$@"