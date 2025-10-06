#!/bin/bash
# Contract Validation Script
# Phase 4 - Contract Gates

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REPORTS_DIR="$PROJECT_ROOT/reports/contracts"

mkdir -p "$REPORTS_DIR"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Contract Gates Validation${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

CONTRACT_REPORT="$REPORTS_DIR/contract-report.json"
CONTRACT_PASSED=true

# Initialize JSON report
cat > "$CONTRACT_REPORT" <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "contracts": {}
}
EOF

update_contract_check() {
    local check_name=$1
    local status=$2
    local drift=$3
    local details=$4

    if [ "$status" = "FAIL" ]; then
        CONTRACT_PASSED=false
    fi

    echo -e "${status:+$([[ $status == 'PASS' ]] && echo $GREEN || echo $RED)}$status $check_name${NC} - Drift: $drift"
    if [ -n "$details" ]; then
        echo -e "${YELLOW}  $details${NC}"
    fi

    jq --arg check "$check_name" \
       --arg status "$status" \
       --arg drift "$drift" \
       --arg details "$details" \
       '.contracts[$check] = {status: $status, drift: $drift, details: $details}' \
       "$CONTRACT_REPORT" > "$CONTRACT_REPORT.tmp" && mv "$CONTRACT_REPORT.tmp" "$CONTRACT_REPORT"
}

# ==========================
# GATE 16: OpenAPI Contract
# ==========================

echo -e "${GREEN}OpenAPI Contract Validation${NC}"
echo "-----------------------------------"

OPENAPI_SPEC="$PROJECT_ROOT/omni-portal/backend/openapi.yaml"
OPENAPI_GENERATED="$REPORTS_DIR/openapi-generated.yaml"

if [ -f "$OPENAPI_SPEC" ]; then
    echo "Validating OpenAPI specification..."

    # Validate OpenAPI syntax
    if command -v openapi-generator-cli &> /dev/null; then
        openapi-generator-cli validate -i "$OPENAPI_SPEC" > "$REPORTS_DIR/openapi-validation.txt" 2>&1
        VALIDATION_EXIT=$?

        if [ $VALIDATION_EXIT -eq 0 ]; then
            echo -e "${GREEN}✓ OpenAPI spec is valid${NC}"
        else
            echo -e "${RED}✗ OpenAPI spec validation failed${NC}"
            CONTRACT_PASSED=false
        fi
    else
        echo -e "${YELLOW}⚠ openapi-generator-cli not installed, skipping validation${NC}"
    fi

    # Generate OpenAPI from code annotations
    cd "$PROJECT_ROOT/omni-portal/backend"
    if [ -f "artisan" ]; then
        echo "Generating OpenAPI from code..."
        php artisan openapi:generate --output="$OPENAPI_GENERATED" > "$REPORTS_DIR/openapi-generate.txt" 2>&1 || true

        if [ -f "$OPENAPI_GENERATED" ]; then
            # Compare specifications
            DIFF_OUTPUT=$(diff -u "$OPENAPI_SPEC" "$OPENAPI_GENERATED" > "$REPORTS_DIR/openapi-drift.diff" 2>&1; echo $?)

            if [ "$DIFF_OUTPUT" = "0" ]; then
                update_contract_check "OpenAPI Contract" "PASS" "0 changes" "Spec matches implementation"
            else
                DRIFT_LINES=$(wc -l < "$REPORTS_DIR/openapi-drift.diff")
                update_contract_check "OpenAPI Contract" "FAIL" "$DRIFT_LINES changes" "Contract drift detected"
            fi
        else
            update_contract_check "OpenAPI Contract" "SKIP" "N/A" "Could not generate spec from code"
        fi
    else
        update_contract_check "OpenAPI Contract" "SKIP" "N/A" "Laravel not available"
    fi
else
    update_contract_check "OpenAPI Contract" "FAIL" "N/A" "OpenAPI spec not found"
fi

# ==========================
# GATE 17: SDK Types
# ==========================

echo ""
echo -e "${GREEN}SDK Types Validation${NC}"
echo "-----------------------------------"

SDK_DIR="$PROJECT_ROOT/omni-portal/frontend/src/api/sdk"
TYPES_FILE="$SDK_DIR/types.ts"

if [ -f "$TYPES_FILE" ]; then
    echo "Validating SDK types..."

    # Generate types from OpenAPI
    if [ -f "$OPENAPI_SPEC" ] && command -v openapi-generator-cli &> /dev/null; then
        GENERATED_TYPES="$REPORTS_DIR/generated-types"

        openapi-generator-cli generate \
            -i "$OPENAPI_SPEC" \
            -g typescript-fetch \
            -o "$GENERATED_TYPES" \
            > "$REPORTS_DIR/sdk-generation.txt" 2>&1 || true

        if [ -f "$GENERATED_TYPES/models/index.ts" ]; then
            # Compare type definitions
            TYPES_DIFF=$(diff -u "$TYPES_FILE" "$GENERATED_TYPES/models/index.ts" > "$REPORTS_DIR/types-drift.diff" 2>&1; echo $?)

            if [ "$TYPES_DIFF" = "0" ]; then
                update_contract_check "SDK Types" "PASS" "0 changes" "Types match OpenAPI spec"
            else
                DRIFT_LINES=$(wc -l < "$REPORTS_DIR/types-drift.diff")
                update_contract_check "SDK Types" "FAIL" "$DRIFT_LINES changes" "Type definitions out of sync"
            fi
        else
            update_contract_check "SDK Types" "SKIP" "N/A" "Could not generate types"
        fi
    else
        update_contract_check "SDK Types" "SKIP" "N/A" "OpenAPI spec or generator not available"
    fi

    # Validate TypeScript types compile
    cd "$PROJECT_ROOT/omni-portal/frontend"
    if [ -f "tsconfig.json" ]; then
        echo "Checking TypeScript compilation of SDK..."
        npx tsc --noEmit "$TYPES_FILE" > "$REPORTS_DIR/sdk-compile.txt" 2>&1
        COMPILE_EXIT=$?

        if [ $COMPILE_EXIT -eq 0 ]; then
            echo -e "${GREEN}✓ SDK types compile successfully${NC}"
        else
            echo -e "${RED}✗ SDK type compilation errors${NC}"
        fi
    fi
else
    update_contract_check "SDK Types" "FAIL" "N/A" "SDK types file not found"
fi

# ==========================
# GATE 18: Analytics Schemas
# ==========================

echo ""
echo -e "${GREEN}Analytics Schema Validation${NC}"
echo "-----------------------------------"

ANALYTICS_SCHEMA_DIR="$PROJECT_ROOT/omni-portal/backend/app/Analytics/Schemas"
ANALYTICS_TESTS_DIR="$PROJECT_ROOT/omni-portal/backend/tests/Feature/Analytics"

if [ -d "$ANALYTICS_SCHEMA_DIR" ]; then
    echo "Validating analytics event schemas..."

    # Find all schema files
    SCHEMA_FILES=$(find "$ANALYTICS_SCHEMA_DIR" -name "*.php" 2>/dev/null || echo "")
    SCHEMA_COUNT=$(echo "$SCHEMA_FILES" | wc -l)

    if [ $SCHEMA_COUNT -gt 0 ]; then
        echo "Found $SCHEMA_COUNT analytics schemas"

        # Run analytics contract tests
        cd "$PROJECT_ROOT/omni-portal/backend"
        if [ -f "phpunit.xml" ] && [ -d "$ANALYTICS_TESTS_DIR" ]; then
            ./vendor/bin/phpunit \
                --testsuite=Feature \
                --filter Analytics \
                > "$REPORTS_DIR/analytics-tests.txt" 2>&1
            TEST_EXIT=$?

            if [ $TEST_EXIT -eq 0 ]; then
                update_contract_check "Analytics Schemas" "PASS" "0 issues" "All schemas validated"
            else
                FAILURES=$(grep -c "FAILURES!" "$REPORTS_DIR/analytics-tests.txt" || echo "0")
                update_contract_check "Analytics Schemas" "FAIL" "$FAILURES failures" "Schema validation failed"
            fi
        else
            update_contract_check "Analytics Schemas" "SKIP" "N/A" "Analytics tests not found"
        fi
    else
        update_contract_check "Analytics Schemas" "SKIP" "N/A" "No schema files found"
    fi
else
    update_contract_check "Analytics Schemas" "SKIP" "N/A" "Analytics schema directory not found"
fi

# ==========================
# Additional Contract Checks
# ==========================

echo ""
echo -e "${GREEN}Additional Contract Checks${NC}"
echo "-----------------------------------"

# GraphQL schema validation (if applicable)
GRAPHQL_SCHEMA="$PROJECT_ROOT/omni-portal/backend/graphql/schema.graphql"
if [ -f "$GRAPHQL_SCHEMA" ]; then
    echo "Validating GraphQL schema..."

    if command -v graphql-inspector &> /dev/null; then
        graphql-inspector validate "$GRAPHQL_SCHEMA" > "$REPORTS_DIR/graphql-validation.txt" 2>&1
        GRAPHQL_EXIT=$?

        if [ $GRAPHQL_EXIT -eq 0 ]; then
            update_contract_check "GraphQL Schema" "PASS" "0 issues" "Schema is valid"
        else
            update_contract_check "GraphQL Schema" "FAIL" "validation errors" "Schema validation failed"
        fi
    else
        update_contract_check "GraphQL Schema" "SKIP" "N/A" "graphql-inspector not installed"
    fi
else
    echo "No GraphQL schema found - skipping"
fi

# Database schema validation
echo "Validating database schema consistency..."
cd "$PROJECT_ROOT/omni-portal/backend"

if [ -f "artisan" ]; then
    # Check for pending migrations
    PENDING_MIGRATIONS=$(php artisan migrate:status 2>/dev/null | grep -c "Pending" || echo "0")

    if [ "$PENDING_MIGRATIONS" = "0" ]; then
        update_contract_check "Database Schema" "PASS" "0 pending" "Schema up to date"
    else
        update_contract_check "Database Schema" "FAIL" "$PENDING_MIGRATIONS pending" "Pending migrations detected"
    fi
else
    update_contract_check "Database Schema" "SKIP" "N/A" "Laravel not available"
fi

# API versioning check
echo "Checking API versioning..."
API_ROUTES="$PROJECT_ROOT/omni-portal/backend/routes/api.php"

if [ -f "$API_ROUTES" ]; then
    # Check for version prefixes
    V1_ROUTES=$(grep -c "Route::prefix('v1')" "$API_ROUTES" || echo "0")
    V2_ROUTES=$(grep -c "Route::prefix('v2')" "$API_ROUTES" || echo "0")

    if [ $V1_ROUTES -gt 0 ] || [ $V2_ROUTES -gt 0 ]; then
        update_contract_check "API Versioning" "PASS" "versioned" "API routes properly versioned"
    else
        update_contract_check "API Versioning" "WARN" "not versioned" "Consider API versioning strategy"
    fi
else
    update_contract_check "API Versioning" "SKIP" "N/A" "API routes file not found"
fi

# ==========================
# GENERATE FINAL REPORT
# ==========================

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Contract Gates Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

TOTAL_CONTRACTS=$(jq '.contracts | length' "$CONTRACT_REPORT")
PASSED_CONTRACTS=$(jq '[.contracts[] | select(.status == "PASS")] | length' "$CONTRACT_REPORT")
FAILED_CONTRACTS=$(jq '[.contracts[] | select(.status == "FAIL")] | length' "$CONTRACT_REPORT")

echo "Total Contracts: $TOTAL_CONTRACTS"
echo -e "${GREEN}Passed: $PASSED_CONTRACTS${NC}"
echo -e "${RED}Failed: $FAILED_CONTRACTS${NC}"
echo ""

# Update summary
jq --argjson total "$TOTAL_CONTRACTS" \
   --argjson passed "$PASSED_CONTRACTS" \
   --argjson failed "$FAILED_CONTRACTS" \
   '.summary = {total: $total, passed: $passed, failed: $failed}' \
   "$CONTRACT_REPORT" > "$CONTRACT_REPORT.tmp" && mv "$CONTRACT_REPORT.tmp" "$CONTRACT_REPORT"

echo "Full report: $CONTRACT_REPORT"
echo ""

if [ "$CONTRACT_PASSED" = false ]; then
    echo -e "${RED}Contract gates FAILED.${NC}"
    exit 1
else
    echo -e "${GREEN}All contract gates passed. ✓${NC}"
    exit 0
fi
