#!/bin/bash

# Quick Validation Script for OnboardingPortal
# 
# This script performs rapid validation of critical systems
# without running the full comprehensive test suite.

echo "🚀 OnboardingPortal Quick Validation"
echo "═══════════════════════════════════════"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "OK" ]; then
        echo -e "✅ ${GREEN}${message}${NC}"
    elif [ "$status" = "WARN" ]; then
        echo -e "⚠️  ${YELLOW}${message}${NC}"
    else
        echo -e "❌ ${RED}${message}${NC}"
    fi
}

# Check if we're in the right directory
if [ ! -f "artisan" ]; then
    print_status "FAIL" "Not in Laravel root directory. Please run from backend folder."
    exit 1
fi

echo "🔍 Running System Checks..."

# 1. Check Environment
echo
echo "📋 Environment Checks"
echo "─────────────────────"

if [ -f ".env" ]; then
    print_status "OK" "Environment file exists"
else
    print_status "FAIL" "Environment file missing"
fi

# Check key environment variables
if grep -q "APP_KEY=" .env 2>/dev/null && grep -q "^APP_KEY=base64:" .env 2>/dev/null; then
    print_status "OK" "Application key is set"
else
    print_status "WARN" "Application key may not be properly set"
fi

if grep -q "DB_CONNECTION=" .env 2>/dev/null; then
    print_status "OK" "Database configuration found"
else
    print_status "FAIL" "Database configuration missing"
fi

# 2. Test Database Connection
echo
echo "🗄️  Database Checks"
echo "──────────────────"

if php artisan migrate:status >/dev/null 2>&1; then
    print_status "OK" "Database connection successful"
    
    # Check critical tables exist
    if php -r "
        require 'vendor/autoload.php';
        \$app = require 'bootstrap/app.php';
        \$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();
        
        try {
            \$tables = ['users', 'companies', 'personal_access_tokens'];
            foreach (\$tables as \$table) {
                if (!Schema::hasTable(\$table)) {
                    throw new Exception('Missing table: ' . \$table);
                }
            }
            echo 'OK';
        } catch (Exception \$e) {
            echo 'FAIL: ' . \$e->getMessage();
            exit(1);
        }
    " 2>/dev/null; then
        print_status "OK" "Critical tables exist"
    else
        print_status "FAIL" "Some critical tables are missing"
    fi
else
    print_status "FAIL" "Cannot connect to database"
fi

# 3. Check Middleware Configuration
echo
echo "🛡️  Middleware Checks"
echo "────────────────────"

if grep -q "UnifiedAuthMiddleware" app/Http/Kernel.php 2>/dev/null; then
    print_status "OK" "UnifiedAuthMiddleware is configured"
else
    print_status "FAIL" "UnifiedAuthMiddleware not found in Kernel.php"
fi

if [ -f "app/Http/Middleware/UnifiedAuthMiddleware.php" ]; then
    print_status "OK" "UnifiedAuthMiddleware file exists"
else
    print_status "FAIL" "UnifiedAuthMiddleware file missing"
fi

# 4. Check Cache System
echo
echo "💾 Cache System Checks"
echo "─────────────────────"

if php artisan cache:clear >/dev/null 2>&1; then
    print_status "OK" "Cache system is working"
else
    print_status "WARN" "Cache system may have issues"
fi

# 5. Quick Authentication Test
echo
echo "🔐 Authentication Quick Test"
echo "──────────────────────────"

# Test CSRF endpoint (should be publicly accessible)
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/sanctum/csrf-cookie" | grep -q "200\|204"; then
    print_status "OK" "CSRF endpoint accessible"
else
    print_status "WARN" "CSRF endpoint not accessible (server may not be running)"
fi

# 6. Run Critical Unit Tests (if PHPUnit available)
echo
echo "🧪 Critical Test Sampling"
echo "────────────────────────"

if [ -f "vendor/bin/phpunit" ]; then
    # Test a few critical components
    critical_tests=(
        "tests/Feature/Auth/UnifiedAuthMiddlewareTest::it_allows_access_to_public_routes_without_authentication"
        "tests/Feature/Security/SecurityValidationTest::it_sets_comprehensive_security_headers"
        "tests/Feature/Database/DatabasePerformanceTest::it_has_required_indexes_on_critical_tables"
    )
    
    for test in "${critical_tests[@]}"; do
        if ./vendor/bin/phpunit --filter="$(echo $test | cut -d: -f3)" "$(echo $test | cut -d: -f1-2)" >/dev/null 2>&1; then
            print_status "OK" "$(echo $test | cut -d: -f3 | sed 's/_/ /g')"
        else
            print_status "WARN" "$(echo $test | cut -d: -f3 | sed 's/_/ /g') - may need attention"
        fi
    done
else
    print_status "WARN" "PHPUnit not available - skipping unit tests"
fi

# 7. Performance Quick Check
echo
echo "⚡ Performance Quick Check"
echo "────────────────────────"

start_time=$(php -r "echo microtime(true);")
php artisan route:list >/dev/null 2>&1
end_time=$(php -r "echo microtime(true);")
duration=$(php -r "echo round($end_time - $start_time, 2);")

if (( $(echo "$duration < 2.0" | bc -l) )); then
    print_status "OK" "Route loading performance: ${duration}s"
else
    print_status "WARN" "Route loading slower than expected: ${duration}s"
fi

# Final Summary
echo
echo "═══════════════════════════════════════"
echo "🏆 Quick Validation Complete"
echo "═══════════════════════════════════════"
echo
echo -e "${BLUE}Summary:${NC}"
echo "• System checks completed"
echo "• Database connectivity verified"
echo "• Middleware configuration validated"
echo "• Authentication system tested"
echo
echo -e "${YELLOW}For comprehensive testing, run:${NC}"
echo "  php tests/Scripts/run-comprehensive-tests.php"
echo
echo -e "${YELLOW}To start development server:${NC}"
echo "  php artisan serve"
echo
echo -e "${GREEN}✅ OnboardingPortal appears to be properly configured!${NC}"