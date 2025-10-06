#!/bin/bash
# Performance Validation Script
# Phase 4 - Performance Gates

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REPORTS_DIR="$PROJECT_ROOT/reports/performance"

mkdir -p "$REPORTS_DIR"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Performance Gates Validation${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

PERF_REPORT="$REPORTS_DIR/performance-report.json"
PERF_PASSED=true

# Initialize JSON report
cat > "$PERF_REPORT" <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "metrics": {}
}
EOF

update_perf_metric() {
    local metric_name=$1
    local status=$2
    local value=$3
    local threshold=$4
    local details=$5

    if [ "$status" = "FAIL" ]; then
        PERF_PASSED=false
    fi

    echo -e "${status:+$([[ $status == 'PASS' ]] && echo $GREEN || echo $RED)}$status $metric_name${NC} - $value (threshold: $threshold)"
    if [ -n "$details" ]; then
        echo -e "${YELLOW}  $details${NC}"
    fi

    jq --arg metric "$metric_name" \
       --arg status "$status" \
       --arg value "$value" \
       --arg threshold "$threshold" \
       --arg details "$details" \
       '.metrics[$metric] = {status: $status, value: $value, threshold: $threshold, details: $details}' \
       "$PERF_REPORT" > "$PERF_REPORT.tmp" && mv "$PERF_REPORT.tmp" "$PERF_REPORT"
}

# ==========================
# GATE 13: API Latency
# ==========================

echo -e "${GREEN}API Latency Testing${NC}"
echo "-----------------------------------"

API_BASE_URL="${API_BASE_URL:-http://localhost:8000/api}"

echo "Testing API endpoints latency..."

# Critical endpoints to test
declare -A ENDPOINTS=(
    ["auth_login"]="/auth/login"
    ["health_check"]="/health"
    ["gamification_progress"]="/gamification/progress"
    ["documents_list"]="/documents"
    ["questionnaire_submit"]="/health/questionnaire"
)

LATENCY_RESULTS="$REPORTS_DIR/api-latency.json"
echo "{}" > "$LATENCY_RESULTS"

LATENCY_FAILED=false

for endpoint_name in "${!ENDPOINTS[@]}"; do
    endpoint="${ENDPOINTS[$endpoint_name]}"

    # Run 10 requests and calculate p95
    echo "Testing $endpoint_name ($endpoint)..."

    LATENCIES=()
    for i in {1..10}; do
        RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$API_BASE_URL$endpoint" 2>/dev/null || echo "999")
        LATENCIES+=("$RESPONSE_TIME")
    done

    # Sort latencies and get p95 (9th value out of 10)
    SORTED_LATENCIES=($(printf '%s\n' "${LATENCIES[@]}" | sort -n))
    P95_LATENCY=${SORTED_LATENCIES[8]}
    P95_MS=$(echo "$P95_LATENCY * 1000" | bc)

    # Store in JSON
    jq --arg endpoint "$endpoint_name" \
       --arg p95 "$P95_MS" \
       --argjson latencies "$(printf '%s\n' "${LATENCIES[@]}" | jq -R . | jq -s .)" \
       ".\"$endpoint_name\" = {p95_ms: ($p95|tonumber), latencies: $latencies}" \
       "$LATENCY_RESULTS" > "$LATENCY_RESULTS.tmp" && mv "$LATENCY_RESULTS.tmp" "$LATENCY_RESULTS"

    # Check threshold
    if (( $(echo "$P95_MS < 500" | bc -l) )); then
        echo -e "  ${GREEN}✓ p95: ${P95_MS}ms${NC}"
    else
        echo -e "  ${RED}✗ p95: ${P95_MS}ms (exceeds 500ms)${NC}"
        LATENCY_FAILED=true
    fi
done

# Calculate overall p95
ALL_LATENCIES=$(jq -r '[.[].latencies[]] | sort | .[8]' "$LATENCY_RESULTS")
OVERALL_P95_MS=$(echo "$ALL_LATENCIES * 1000" | bc)

if [ "$LATENCY_FAILED" = false ]; then
    update_perf_metric "API Latency p95" "PASS" "${OVERALL_P95_MS}ms" "<500ms" "All endpoints under threshold"
else
    update_perf_metric "API Latency p95" "FAIL" "${OVERALL_P95_MS}ms" "<500ms" "Some endpoints exceed threshold"
fi

# ==========================
# GATE 14: Error Rate
# ==========================

echo ""
echo -e "${GREEN}Error Rate Testing${NC}"
echo "-----------------------------------"

echo "Running load test to measure error rate..."

# Create a simple load test script
LOAD_TEST_SCRIPT="$REPORTS_DIR/load-test.sh"
cat > "$LOAD_TEST_SCRIPT" <<'LOADTEST'
#!/bin/bash
API_BASE_URL="${1:-http://localhost:8000/api}"
REQUESTS=100
SUCCESS=0
ERRORS=0

for i in $(seq 1 $REQUESTS); do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE_URL/health" 2>/dev/null || echo "000")

    if [[ "$HTTP_CODE" =~ ^2[0-9]{2}$ ]]; then
        SUCCESS=$((SUCCESS + 1))
    else
        ERRORS=$((ERRORS + 1))
    fi
done

ERROR_RATE=$(echo "scale=2; ($ERRORS / $REQUESTS) * 100" | bc)
echo "$ERROR_RATE"
LOADTEST

chmod +x "$LOAD_TEST_SCRIPT"

ERROR_RATE=$("$LOAD_TEST_SCRIPT" "$API_BASE_URL" 2>/dev/null || echo "100")

if (( $(echo "$ERROR_RATE < 1" | bc -l) )); then
    update_perf_metric "Error Rate" "PASS" "${ERROR_RATE}%" "<1%" "Error rate within acceptable range"
else
    update_perf_metric "Error Rate" "FAIL" "${ERROR_RATE}%" "<1%" "Error rate exceeds threshold"
fi

# ==========================
# GATE 15: Build Time
# ==========================

echo ""
echo -e "${GREEN}Build Time Testing${NC}"
echo "-----------------------------------"

cd "$PROJECT_ROOT/omni-portal/frontend"

if [ -f "package.json" ]; then
    echo "Building frontend..."

    START_TIME=$(date +%s)
    npm run build > "$REPORTS_DIR/build-output.txt" 2>&1
    BUILD_EXIT_CODE=$?
    END_TIME=$(date +%s)

    BUILD_TIME=$((END_TIME - START_TIME))
    BUILD_TIME_MIN=$(echo "scale=2; $BUILD_TIME / 60" | bc)

    if [ $BUILD_EXIT_CODE -eq 0 ]; then
        if [ $BUILD_TIME -lt 900 ]; then  # 15 minutes = 900 seconds
            update_perf_metric "Build Time" "PASS" "${BUILD_TIME_MIN} min" "<15 min" "Build completed successfully"
        else
            update_perf_metric "Build Time" "FAIL" "${BUILD_TIME_MIN} min" "<15 min" "Build time exceeds threshold"
        fi
    else
        update_perf_metric "Build Time" "FAIL" "N/A" "<15 min" "Build failed"
    fi
else
    update_perf_metric "Build Time" "SKIP" "N/A" "<15 min" "package.json not found"
fi

# ==========================
# Additional Performance Metrics
# ==========================

echo ""
echo -e "${GREEN}Additional Performance Metrics${NC}"
echo "-----------------------------------"

# Database query performance
echo "Testing database query performance..."
cd "$PROJECT_ROOT/omni-portal/backend"

if [ -f "artisan" ]; then
    # Create a simple query performance test
    QUERY_TEST_OUTPUT=$(php artisan tinker --execute="
        \$start = microtime(true);
        \$users = DB::table('users')->limit(100)->get();
        \$time = (microtime(true) - \$start) * 1000;
        echo \$time;
    " 2>/dev/null || echo "999")

    QUERY_TIME=$(echo "$QUERY_TEST_OUTPUT" | tail -1)

    if (( $(echo "$QUERY_TIME < 100" | bc -l) )); then
        update_perf_metric "Database Query" "PASS" "${QUERY_TIME}ms" "<100ms" "Query performance acceptable"
    else
        update_perf_metric "Database Query" "FAIL" "${QUERY_TIME}ms" "<100ms" "Query performance degraded"
    fi
else
    update_perf_metric "Database Query" "SKIP" "N/A" "<100ms" "Laravel not available"
fi

# Memory usage check
echo "Checking memory usage patterns..."
cd "$PROJECT_ROOT/omni-portal/frontend"

if [ -f "package.json" ]; then
    # Analyze bundle size
    BUNDLE_SIZE=$(du -sh build 2>/dev/null | cut -f1 || echo "N/A")

    if [ "$BUNDLE_SIZE" != "N/A" ]; then
        # Extract size in MB
        SIZE_MB=$(echo "$BUNDLE_SIZE" | sed 's/M//' | sed 's/K//g' | awk '{print int($1)}')

        if [ $SIZE_MB -lt 5 ]; then
            update_perf_metric "Bundle Size" "PASS" "$BUNDLE_SIZE" "<5MB" "Bundle size optimized"
        else
            update_perf_metric "Bundle Size" "WARN" "$BUNDLE_SIZE" "<5MB" "Bundle size should be optimized"
        fi
    else
        update_perf_metric "Bundle Size" "SKIP" "N/A" "<5MB" "Build directory not found"
    fi
fi

# ==========================
# GENERATE FINAL REPORT
# ==========================

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Performance Gates Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

TOTAL_METRICS=$(jq '.metrics | length' "$PERF_REPORT")
PASSED_METRICS=$(jq '[.metrics[] | select(.status == "PASS")] | length' "$PERF_REPORT")
FAILED_METRICS=$(jq '[.metrics[] | select(.status == "FAIL")] | length' "$PERF_REPORT")

echo "Total Metrics: $TOTAL_METRICS"
echo -e "${GREEN}Passed: $PASSED_METRICS${NC}"
echo -e "${RED}Failed: $FAILED_METRICS${NC}"
echo ""

# Update summary
jq --argjson total "$TOTAL_METRICS" \
   --argjson passed "$PASSED_METRICS" \
   --argjson failed "$FAILED_METRICS" \
   '.summary = {total: $total, passed: $passed, failed: $failed}' \
   "$PERF_REPORT" > "$PERF_REPORT.tmp" && mv "$PERF_REPORT.tmp" "$PERF_REPORT"

echo "Full report: $PERF_REPORT"
echo ""

if [ "$PERF_PASSED" = false ]; then
    echo -e "${RED}Performance gates FAILED.${NC}"
    exit 1
else
    echo -e "${GREEN}All performance gates passed. ✓${NC}"
    exit 0
fi
