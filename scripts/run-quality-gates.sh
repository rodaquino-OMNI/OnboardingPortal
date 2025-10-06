#!/bin/bash
# Quality Gates Test Execution Script
# Phase 4 - Complete Testing Validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/omni-portal/backend"
FRONTEND_DIR="$PROJECT_ROOT/omni-portal/frontend"
REPORTS_DIR="$PROJECT_ROOT/reports/quality-gates"

# Create reports directory
mkdir -p "$REPORTS_DIR"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Quality Gates Validation - Phase 4${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Initialize results tracking
TOTAL_GATES=0
PASSED_GATES=0
FAILED_GATES=0
QUALITY_REPORT="$REPORTS_DIR/quality-gate-report.json"

# Initialize JSON report
cat > "$QUALITY_REPORT" <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "phase": "Phase 4 - Quality Gates",
  "gates": {}
}
EOF

# Function to update gate status
update_gate_status() {
    local gate_name=$1
    local status=$2
    local metric=$3
    local threshold=$4
    local details=$5

    TOTAL_GATES=$((TOTAL_GATES + 1))

    if [ "$status" = "PASS" ]; then
        PASSED_GATES=$((PASSED_GATES + 1))
        echo -e "${GREEN}✓ $gate_name: PASS${NC} - $metric (threshold: $threshold)"
    else
        FAILED_GATES=$((FAILED_GATES + 1))
        echo -e "${RED}✗ $gate_name: FAIL${NC} - $metric (threshold: $threshold)"
        echo -e "${YELLOW}  Details: $details${NC}"
    fi

    # Update JSON report
    jq --arg gate "$gate_name" \
       --arg status "$status" \
       --arg metric "$metric" \
       --arg threshold "$threshold" \
       --arg details "$details" \
       '.gates[$gate] = {status: $status, metric: $metric, threshold: $threshold, details: $details}' \
       "$QUALITY_REPORT" > "$QUALITY_REPORT.tmp" && mv "$QUALITY_REPORT.tmp" "$QUALITY_REPORT"
}

# ==========================
# BACKEND QUALITY GATES
# ==========================

echo -e "${GREEN}Backend Quality Gates${NC}"
echo "-----------------------------------"

cd "$BACKEND_DIR"

# Gate 1: Backend Test Coverage
echo "Running backend tests with coverage..."
if [ -f "phpunit.xml" ]; then
    ./vendor/bin/phpunit --coverage-html "$REPORTS_DIR/backend-coverage" \
                        --coverage-text \
                        --coverage-clover "$REPORTS_DIR/backend-coverage.xml" \
                        > "$REPORTS_DIR/backend-test-output.txt" 2>&1 || true

    # Parse coverage from output
    COVERAGE=$(grep -oP 'Lines:\s+\K[0-9.]+(?=%)' "$REPORTS_DIR/backend-test-output.txt" | head -1 || echo "0")

    if (( $(echo "$COVERAGE >= 85" | bc -l) )); then
        update_gate_status "Backend Test Coverage" "PASS" "${COVERAGE}%" "≥85%" "Overall coverage meets threshold"
    else
        update_gate_status "Backend Test Coverage" "FAIL" "${COVERAGE}%" "≥85%" "Coverage below threshold"
    fi
else
    update_gate_status "Backend Test Coverage" "FAIL" "N/A" "≥85%" "phpunit.xml not found"
fi

# Gate 2: Critical Module Coverage
echo "Checking critical module coverage..."
if [ -f "$REPORTS_DIR/backend-coverage.xml" ]; then
    # Extract coverage for critical modules
    CRITICAL_MODULES=("PointsEngine" "AuditLogService" "AuthController" "GamificationController")
    CRITICAL_PASS=true

    for module in "${CRITICAL_MODULES[@]}"; do
        MODULE_COVERAGE=$(xmllint --xpath "//class[contains(@name,'$module')]/@line-rate" "$REPORTS_DIR/backend-coverage.xml" 2>/dev/null | grep -oP '\d+\.\d+' | awk '{print $1*100}' || echo "0")

        if (( $(echo "$MODULE_COVERAGE < 90" | bc -l) )); then
            CRITICAL_PASS=false
            break
        fi
    done

    if [ "$CRITICAL_PASS" = true ]; then
        update_gate_status "Critical Module Coverage" "PASS" "≥90%" "≥90%" "All critical modules covered"
    else
        update_gate_status "Critical Module Coverage" "FAIL" "<90%" "≥90%" "Module: $module at ${MODULE_COVERAGE}%"
    fi
else
    update_gate_status "Critical Module Coverage" "FAIL" "N/A" "≥90%" "Coverage report not found"
fi

# Gate 3: PHPStan Level 8
echo "Running PHPStan Level 8..."
if [ -f "vendor/bin/phpstan" ]; then
    ./vendor/bin/phpstan analyse --level=8 --memory-limit=2G \
        --error-format=json \
        app/ > "$REPORTS_DIR/phpstan-results.json" 2>&1

    PHPSTAN_ERRORS=$(jq '.totals.file_errors' "$REPORTS_DIR/phpstan-results.json" 2>/dev/null || echo "999")

    if [ "$PHPSTAN_ERRORS" = "0" ]; then
        update_gate_status "PHPStan Level 8" "PASS" "0 errors" "0 errors" "Static analysis passed"
    else
        update_gate_status "PHPStan Level 8" "FAIL" "$PHPSTAN_ERRORS errors" "0 errors" "Static analysis found issues"
    fi
else
    update_gate_status "PHPStan Level 8" "FAIL" "N/A" "0 errors" "PHPStan not installed"
fi

# Gate 4: Mutation Testing
echo "Running Infection mutation testing..."
if [ -f "vendor/bin/infection" ]; then
    ./vendor/bin/infection --min-msi=60 --min-covered-msi=65 \
        --threads=4 \
        --log-verbosity=none \
        --only-covered \
        --formatter=json \
        --output-file="$REPORTS_DIR/mutation-results.json" \
        > "$REPORTS_DIR/mutation-output.txt" 2>&1 || true

    MSI=$(jq -r '.stats.msi' "$REPORTS_DIR/mutation-results.json" 2>/dev/null || echo "0")

    if (( $(echo "$MSI >= 60" | bc -l) )); then
        update_gate_status "Mutation Score" "PASS" "${MSI}%" "≥60%" "Mutation testing passed"
    else
        update_gate_status "Mutation Score" "FAIL" "${MSI}%" "≥60%" "MSI below threshold"
    fi
else
    update_gate_status "Mutation Score" "FAIL" "N/A" "≥60%" "Infection not installed"
fi

# ==========================
# FRONTEND QUALITY GATES
# ==========================

echo ""
echo -e "${GREEN}Frontend Quality Gates${NC}"
echo "-----------------------------------"

cd "$FRONTEND_DIR"

# Gate 5: Frontend Test Coverage
echo "Running frontend tests with coverage..."
if [ -f "package.json" ] && command -v npm &> /dev/null; then
    npm run test:coverage -- --outputFile="$REPORTS_DIR/frontend-coverage.json" \
        --coverageDirectory="$REPORTS_DIR/frontend-coverage" \
        > "$REPORTS_DIR/frontend-test-output.txt" 2>&1 || true

    if [ -f "$REPORTS_DIR/frontend-coverage/coverage-summary.json" ]; then
        FRONTEND_COVERAGE=$(jq -r '.total.lines.pct' "$REPORTS_DIR/frontend-coverage/coverage-summary.json" || echo "0")

        if (( $(echo "$FRONTEND_COVERAGE >= 85" | bc -l) )); then
            update_gate_status "Frontend Test Coverage" "PASS" "${FRONTEND_COVERAGE}%" "≥85%" "Overall coverage meets threshold"
        else
            update_gate_status "Frontend Test Coverage" "FAIL" "${FRONTEND_COVERAGE}%" "≥85%" "Coverage below threshold"
        fi
    else
        update_gate_status "Frontend Test Coverage" "FAIL" "N/A" "≥85%" "Coverage report not generated"
    fi
else
    update_gate_status "Frontend Test Coverage" "FAIL" "N/A" "≥85%" "npm or package.json not found"
fi

# Gate 6: TypeScript Compilation
echo "Running TypeScript compilation..."
if [ -f "tsconfig.json" ]; then
    npx tsc --noEmit > "$REPORTS_DIR/typescript-errors.txt" 2>&1
    TS_EXIT_CODE=$?

    if [ $TS_EXIT_CODE -eq 0 ]; then
        update_gate_status "TypeScript Compilation" "PASS" "0 errors" "0 errors" "TypeScript compiled successfully"
    else
        TS_ERRORS=$(wc -l < "$REPORTS_DIR/typescript-errors.txt")
        update_gate_status "TypeScript Compilation" "FAIL" "$TS_ERRORS errors" "0 errors" "TypeScript compilation failed"
    fi
else
    update_gate_status "TypeScript Compilation" "FAIL" "N/A" "0 errors" "tsconfig.json not found"
fi

# Gate 7: ESLint Validation
echo "Running ESLint..."
if [ -f ".eslintrc.json" ] || [ -f ".eslintrc.js" ]; then
    npx eslint . --ext .ts,.tsx,.js,.jsx \
        --format json \
        --output-file "$REPORTS_DIR/eslint-results.json" \
        --max-warnings 0 \
        > "$REPORTS_DIR/eslint-output.txt" 2>&1
    ESLINT_EXIT_CODE=$?

    if [ $ESLINT_EXIT_CODE -eq 0 ]; then
        update_gate_status "ESLint" "PASS" "0 warnings" "0 warnings" "No linting issues found"
    else
        ESLINT_WARNINGS=$(jq '[.[].messages[]] | length' "$REPORTS_DIR/eslint-results.json" 2>/dev/null || echo "N/A")
        update_gate_status "ESLint" "FAIL" "$ESLINT_WARNINGS warnings" "0 warnings" "Linting issues found"
    fi
else
    update_gate_status "ESLint" "FAIL" "N/A" "0 warnings" "ESLint config not found"
fi

# Gate 8: Accessibility Testing
echo "Running accessibility tests..."
if [ -f "package.json" ]; then
    npm run test:a11y -- --reporter json > "$REPORTS_DIR/a11y-results.json" 2>&1 || true

    A11Y_VIOLATIONS=$(jq '.violations | length' "$REPORTS_DIR/a11y-results.json" 2>/dev/null || echo "999")

    if [ "$A11Y_VIOLATIONS" = "0" ]; then
        update_gate_status "Accessibility" "PASS" "0 violations" "0 violations" "No a11y issues found"
    else
        update_gate_status "Accessibility" "FAIL" "$A11Y_VIOLATIONS violations" "0 violations" "Accessibility issues detected"
    fi
else
    update_gate_status "Accessibility" "FAIL" "N/A" "0 violations" "A11y tests not configured"
fi

# ==========================
# GENERATE FINAL REPORT
# ==========================

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Quality Gates Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Total Gates: $TOTAL_GATES"
echo -e "${GREEN}Passed: $PASSED_GATES${NC}"
echo -e "${RED}Failed: $FAILED_GATES${NC}"
echo ""

# Update summary in JSON
jq --arg total "$TOTAL_GATES" \
   --arg passed "$PASSED_GATES" \
   --arg failed "$FAILED_GATES" \
   '.summary = {total: ($total|tonumber), passed: ($passed|tonumber), failed: ($failed|tonumber)}' \
   "$QUALITY_REPORT" > "$QUALITY_REPORT.tmp" && mv "$QUALITY_REPORT.tmp" "$QUALITY_REPORT"

# Print report location
echo "Full report: $QUALITY_REPORT"
echo ""

# Exit with failure if any gates failed
if [ $FAILED_GATES -gt 0 ]; then
    echo -e "${RED}Quality gates FAILED. Pipeline should stop.${NC}"
    exit 1
else
    echo -e "${GREEN}All quality gates PASSED. ✓${NC}"
    exit 0
fi
