#!/bin/bash
#
# Database Query Validator Fix Verification Script
#
# This script verifies that the DatabaseQueryValidator fix has been properly
# implemented and is ready for testing.
#
# Usage: ./scripts/verify-validator-fix.sh
#

set -e

echo "=================================================="
echo "Database Query Validator Fix - Verification"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
PASSED=0
FAILED=0

# Helper function to check file exists
check_file() {
    local file=$1
    local description=$2

    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description exists: $file"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description missing: $file"
        ((FAILED++))
        return 1
    fi
}

# Helper function to check file contains pattern
check_content() {
    local file=$1
    local pattern=$2
    local description=$3

    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $description"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        ((FAILED++))
        return 1
    fi
}

echo "Step 1: Verifying file structure..."
echo "-----------------------------------"

check_file "app/Services/DatabaseQueryValidator.php" "DatabaseQueryValidator service"
check_file "app/Providers/DatabaseQueryValidatorServiceProvider.php" "Service provider"
check_file "tests/Unit/DatabaseQueryValidatorTest.php" "Unit tests"
check_file "config/database-validator.php" "Configuration file"
check_file ".env.testing" "Testing environment file"
check_file "phpunit.xml" "PHPUnit configuration"

echo ""
echo "Step 2: Verifying configuration..."
echo "-----------------------------------"

check_content "config/database-validator.php" "exclude_environments" "Config has excluded environments"
check_content "config/database-validator.php" "enabled" "Config has enabled flag"
check_content ".env.testing" "DB_QUERY_VALIDATOR_ENABLED=false" ".env.testing disables validator"
check_content "phpunit.xml" "DB_QUERY_VALIDATOR_ENABLED" "phpunit.xml has validator env var"

echo ""
echo "Step 3: Verifying service implementation..."
echo "--------------------------------------------"

check_content "app/Services/DatabaseQueryValidator.php" "isEnabled" "Service has isEnabled method"
check_content "app/Services/DatabaseQueryValidator.php" "validateQuery" "Service has validateQuery method"
check_content "app/Services/DatabaseQueryValidator.php" "isSchemaOperation" "Service has schema detection"
check_content "app/Services/DatabaseQueryValidator.php" "isMigrationContext" "Service has migration detection"
check_content "app/Services/DatabaseQueryValidator.php" "dangerousPatterns" "Service has dangerous patterns"

echo ""
echo "Step 4: Verifying service provider..."
echo "--------------------------------------"

check_content "app/Providers/DatabaseQueryValidatorServiceProvider.php" "register" "Provider has register method"
check_content "app/Providers/DatabaseQueryValidatorServiceProvider.php" "boot" "Provider has boot method"
check_content "app/Providers/DatabaseQueryValidatorServiceProvider.php" "singleton" "Provider registers as singleton"

echo ""
echo "Step 5: Verifying test coverage..."
echo "-----------------------------------"

check_content "tests/Unit/DatabaseQueryValidatorTest.php" "test_validator_disabled_in_testing_environment" "Test: disabled in testing"
check_content "tests/Unit/DatabaseQueryValidatorTest.php" "test_identifies_schema_operations" "Test: schema operations"
check_content "tests/Unit/DatabaseQueryValidatorTest.php" "test_detects_dangerous_patterns" "Test: dangerous patterns"
check_content "tests/Unit/DatabaseQueryValidatorTest.php" "test_detects_sql_injection_in_bindings" "Test: SQL injection"
check_content "tests/Unit/DatabaseQueryValidatorTest.php" "test_allows_schema_operations_during_migrations" "Test: migration context"

echo ""
echo "Step 6: Checking PHP syntax (if PHP available)..."
echo "--------------------------------------------------"

if command -v php &> /dev/null; then
    echo "PHP found, checking syntax..."

    php -l app/Services/DatabaseQueryValidator.php > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} DatabaseQueryValidator.php syntax valid"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} DatabaseQueryValidator.php syntax error"
        ((FAILED++))
    fi

    php -l app/Providers/DatabaseQueryValidatorServiceProvider.php > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} DatabaseQueryValidatorServiceProvider.php syntax valid"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} DatabaseQueryValidatorServiceProvider.php syntax error"
        ((FAILED++))
    fi

    php -l tests/Unit/DatabaseQueryValidatorTest.php > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} DatabaseQueryValidatorTest.php syntax valid"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} DatabaseQueryValidatorTest.php syntax error"
        ((FAILED++))
    fi
else
    echo -e "${YELLOW}⚠${NC} PHP not found - skipping syntax checks"
    echo "    Run this script in a PHP environment for full validation"
fi

echo ""
echo "=================================================="
echo "Verification Summary"
echo "=================================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run tests: php artisan test --filter DatabaseQueryValidatorTest"
    echo "2. Test migrations: php artisan migrate --env=testing"
    echo "3. Review documentation: docs/phase8/database_validator_fix.md"
    echo "4. Register service provider in config/app.php or bootstrap/providers.php"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Please review the output above.${NC}"
    echo ""
    exit 1
fi
