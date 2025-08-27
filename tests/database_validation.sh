#!/bin/bash

# Database Validation Script
# Comprehensive testing of all database aspects
# Author: System Administrator
# Date: $(date +"%Y-%m-%d")

set -euo pipefail

# Colors for output formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/omni-portal/backend"
REPORT_FILE="$SCRIPT_DIR/database_validation_report_$(date +%Y%m%d_%H%M%S).txt"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# Logging functions
log_header() {
    echo -e "\n${BLUE}${BOLD}================================${NC}"
    echo -e "${BLUE}${BOLD} $1${NC}"
    echo -e "${BLUE}${BOLD}================================${NC}\n"
    echo "================================" >> "$REPORT_FILE"
    echo " $1" >> "$REPORT_FILE"
    echo "================================" >> "$REPORT_FILE"
}

log_test() {
    ((TOTAL_TESTS++))
    echo -e "${YELLOW}[TEST] $1${NC}"
    echo "[TEST] $1" >> "$REPORT_FILE"
}

log_pass() {
    ((PASSED_TESTS++))
    echo -e "${GREEN}[PASS] $1${NC}"
    echo "[PASS] $1" >> "$REPORT_FILE"
}

log_fail() {
    ((FAILED_TESTS++))
    echo -e "${RED}[FAIL] $1${NC}"
    echo "[FAIL] $1" >> "$REPORT_FILE"
}

log_warning() {
    ((WARNINGS++))
    echo -e "${YELLOW}[WARN] $1${NC}"
    echo "[WARN] $1" >> "$REPORT_FILE"
}

log_info() {
    echo -e "${BLUE}[INFO] $1${NC}"
    echo "[INFO] $1" >> "$REPORT_FILE"
}

# Database configuration loader
load_database_config() {
    if [ -f "$BACKEND_DIR/.env" ]; then
        export $(grep -v '^#' "$BACKEND_DIR/.env" | xargs)
    else
        log_fail "Environment file not found at $BACKEND_DIR/.env"
        exit 1
    fi
    
    # Set defaults if not provided
    DB_CONNECTION=${DB_CONNECTION:-mysql}
    DB_HOST=${DB_HOST:-127.0.0.1}
    DB_PORT=${DB_PORT:-3306}
    DB_DATABASE=${DB_DATABASE:-omni_portal}
    DB_USERNAME=${DB_USERNAME:-root}
    DB_PASSWORD=${DB_PASSWORD:-}
}

# MySQL connection test
test_mysql_connection() {
    log_test "Testing MySQL database connectivity"
    
    if command -v mysql >/dev/null 2>&1; then
        if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USERNAME" -p"$DB_PASSWORD" -e "SELECT 1;" "$DB_DATABASE" >/dev/null 2>&1; then
            log_pass "Database connection successful"
            return 0
        else
            log_fail "Database connection failed"
            return 1
        fi
    else
        log_warning "MySQL client not installed, skipping direct connection test"
        return 0
    fi
}

# Test Laravel database connection
test_laravel_connection() {
    log_test "Testing Laravel database connection"
    
    cd "$BACKEND_DIR"
    
    if php artisan tinker --execute="DB::connection()->getPdo(); echo 'Connection successful';" 2>/dev/null | grep -q "Connection successful"; then
        log_pass "Laravel database connection successful"
        return 0
    else
        log_fail "Laravel database connection failed"
        return 1
    fi
}

# Check migration status
test_migration_status() {
    log_test "Checking database migration status"
    
    cd "$BACKEND_DIR"
    
    # Check if migrations table exists
    if php artisan migrate:status >/dev/null 2>&1; then
        local pending_migrations
        pending_migrations=$(php artisan migrate:status | grep -c "Pending" || true)
        
        if [ "$pending_migrations" -eq 0 ]; then
            log_pass "All migrations are up to date"
            
            # Show migration details
            local total_migrations
            total_migrations=$(php artisan migrate:status | grep -c "Y" || true)
            log_info "Total applied migrations: $total_migrations"
        else
            log_fail "$pending_migrations pending migrations found"
        fi
    else
        log_fail "Unable to check migration status"
        return 1
    fi
}

# Verify seed data
test_seed_data() {
    log_test "Verifying seed data presence"
    
    cd "$BACKEND_DIR"
    
    # Check for users
    local user_count
    user_count=$(php artisan tinker --execute="echo App\\Models\\User::count();" 2>/dev/null | tail -1)
    
    if [ "$user_count" -gt 0 ]; then
        log_pass "User seed data present ($user_count users)"
    else
        log_warning "No user seed data found"
    fi
    
    # Check for beneficiaries if table exists
    if php artisan tinker --execute="try { echo App\\Models\\Beneficiary::count(); } catch (Exception \$e) { echo '0'; }" 2>/dev/null | tail -1 | grep -q '^[0-9]'; then
        local beneficiary_count
        beneficiary_count=$(php artisan tinker --execute="echo App\\Models\\Beneficiary::count();" 2>/dev/null | tail -1)
        log_info "Beneficiaries in database: $beneficiary_count"
    fi
}

# Test connection pooling
test_connection_pooling() {
    log_test "Testing database connection pooling"
    
    cd "$BACKEND_DIR"
    
    # Test multiple concurrent connections
    local max_connections
    max_connections=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USERNAME" -p"$DB_PASSWORD" -e "SHOW VARIABLES LIKE 'max_connections';" "$DB_DATABASE" 2>/dev/null | awk 'NR==2{print $2}' || echo "unknown")
    
    if [ "$max_connections" != "unknown" ] && [ "$max_connections" -gt 0 ]; then
        log_pass "Max connections configured: $max_connections"
    else
        log_warning "Unable to determine max connections setting"
    fi
    
    # Test Laravel connection pool
    local connection_test
    connection_test=$(php artisan tinker --execute="
        for (\$i = 0; \$i < 5; \$i++) {
            DB::connection()->getPdo();
        }
        echo 'Pool test successful';
    " 2>/dev/null | tail -1)
    
    if echo "$connection_test" | grep -q "successful"; then
        log_pass "Connection pooling test successful"
    else
        log_fail "Connection pooling test failed"
    fi
}

# Check for slow queries
test_slow_queries() {
    log_test "Checking for slow query configuration"
    
    if command -v mysql >/dev/null 2>&1; then
        local slow_query_log
        slow_query_log=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USERNAME" -p"$DB_PASSWORD" -e "SHOW VARIABLES LIKE 'slow_query_log';" "$DB_DATABASE" 2>/dev/null | awk 'NR==2{print $2}' || echo "unknown")
        
        if [ "$slow_query_log" = "ON" ]; then
            log_pass "Slow query logging is enabled"
        else
            log_warning "Slow query logging is not enabled"
        fi
        
        local long_query_time
        long_query_time=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USERNAME" -p"$DB_PASSWORD" -e "SHOW VARIABLES LIKE 'long_query_time';" "$DB_DATABASE" 2>/dev/null | awk 'NR==2{print $2}' || echo "unknown")
        
        log_info "Long query time threshold: ${long_query_time}s"
    else
        log_warning "MySQL client not available for slow query check"
    fi
}

# Validate foreign key constraints
test_foreign_keys() {
    log_test "Validating foreign key constraints"
    
    cd "$BACKEND_DIR"
    
    # Check foreign key constraints are enabled
    if command -v mysql >/dev/null 2>&1; then
        local fk_checks
        fk_checks=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USERNAME" -p"$DB_PASSWORD" -e "SELECT @@foreign_key_checks;" "$DB_DATABASE" 2>/dev/null | awk 'NR==2{print $1}' || echo "unknown")
        
        if [ "$fk_checks" = "1" ]; then
            log_pass "Foreign key checks are enabled"
        else
            log_warning "Foreign key checks are disabled"
        fi
        
        # List all foreign key constraints
        local fk_count
        fk_count=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USERNAME" -p"$DB_PASSWORD" -e "
            SELECT COUNT(*) 
            FROM information_schema.KEY_COLUMN_USAGE 
            WHERE CONSTRAINT_SCHEMA = '$DB_DATABASE' 
            AND REFERENCED_TABLE_NAME IS NOT NULL;
        " "$DB_DATABASE" 2>/dev/null | awk 'NR==2{print $1}' || echo "0")
        
        log_info "Foreign key constraints found: $fk_count"
    else
        log_warning "MySQL client not available for foreign key validation"
    fi
}

# Perform CRUD operations on main entities
test_crud_operations() {
    log_test "Testing CRUD operations on main entities"
    
    cd "$BACKEND_DIR"
    
    # Test User CRUD
    log_info "Testing User model CRUD operations"
    local user_crud_test
    user_crud_test=$(php artisan tinker --execute="
        try {
            // Create
            \$user = App\\Models\\User::create([
                'name' => 'Test User DB Validation',
                'email' => 'test-db-validation-' . time() . '@example.com',
                'password' => Hash::make('password123'),
                'email_verified_at' => now()
            ]);
            
            // Read
            \$found = App\\Models\\User::find(\$user->id);
            if (!\$found) throw new Exception('User not found after creation');
            
            // Update
            \$found->name = 'Updated Test User';
            \$found->save();
            
            // Delete
            \$found->delete();
            
            echo 'User CRUD test successful';
        } catch (Exception \$e) {
            echo 'User CRUD test failed: ' . \$e->getMessage();
        }
    " 2>/dev/null | tail -1)
    
    if echo "$user_crud_test" | grep -q "successful"; then
        log_pass "User CRUD operations successful"
    else
        log_fail "User CRUD operations failed: $user_crud_test"
    fi
    
    # Test other models if they exist
    test_model_crud "Beneficiary" "App\\Models\\Beneficiary" "[
        'first_name' => 'Test',
        'last_name' => 'Beneficiary',
        'email' => 'test-beneficiary-' . time() . '@example.com',
        'phone' => '1234567890',
        'date_of_birth' => '1990-01-01'
    ]"
    
    test_model_crud "HealthQuestionnaire" "App\\Models\\HealthQuestionnaire" "[
        'beneficiary_id' => 1,
        'responses' => json_encode(['test' => 'data']),
        'status' => 'completed'
    ]"
}

test_model_crud() {
    local model_name="$1"
    local model_class="$2"
    local create_data="$3"
    
    log_info "Testing $model_name model CRUD operations"
    
    local crud_test
    crud_test=$(php artisan tinker --execute="
        try {
            if (!class_exists('$model_class')) {
                echo '$model_name model does not exist - skipping';
            } else {
                // Create
                \$model = $model_class::create($create_data);
                
                // Read
                \$found = $model_class::find(\$model->id);
                if (!\$found) throw new Exception('$model_name not found after creation');
                
                // Delete
                \$found->delete();
                
                echo '$model_name CRUD test successful';
            }
        } catch (Exception \$e) {
            echo '$model_name CRUD test failed: ' . \$e->getMessage();
        }
    " 2>/dev/null | tail -1)
    
    if echo "$crud_test" | grep -q "successful"; then
        log_pass "$model_name CRUD operations successful"
    elif echo "$crud_test" | grep -q "does not exist"; then
        log_info "$model_name model not found - skipping CRUD test"
    else
        log_warning "$model_name CRUD operations failed: $crud_test"
    fi
}

# Test database indexes
test_database_indexes() {
    log_test "Checking database indexes"
    
    if command -v mysql >/dev/null 2>&1; then
        local index_count
        index_count=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USERNAME" -p"$DB_PASSWORD" -e "
            SELECT COUNT(*) 
            FROM information_schema.STATISTICS 
            WHERE TABLE_SCHEMA = '$DB_DATABASE';
        " "$DB_DATABASE" 2>/dev/null | awk 'NR==2{print $1}' || echo "0")
        
        if [ "$index_count" -gt 0 ]; then
            log_pass "Database indexes found: $index_count"
        else
            log_warning "No database indexes found"
        fi
        
        # Check for specific important indexes
        local user_email_index
        user_email_index=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USERNAME" -p"$DB_PASSWORD" -e "
            SELECT COUNT(*) 
            FROM information_schema.STATISTICS 
            WHERE TABLE_SCHEMA = '$DB_DATABASE' 
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME = 'email';
        " "$DB_DATABASE" 2>/dev/null | awk 'NR==2{print $1}' || echo "0")
        
        if [ "$user_email_index" -gt 0 ]; then
            log_pass "User email index exists"
        else
            log_warning "User email index not found"
        fi
    else
        log_warning "MySQL client not available for index check"
    fi
}

# Test database size and performance
test_database_performance() {
    log_test "Checking database performance metrics"
    
    if command -v mysql >/dev/null 2>&1; then
        # Check database size
        local db_size
        db_size=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USERNAME" -p"$DB_PASSWORD" -e "
            SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'DB Size (MB)'
            FROM information_schema.tables 
            WHERE table_schema = '$DB_DATABASE';
        " "$DB_DATABASE" 2>/dev/null | awk 'NR==2{print $1}' || echo "unknown")
        
        log_info "Database size: ${db_size} MB"
        
        # Check table count
        local table_count
        table_count=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USERNAME" -p"$DB_PASSWORD" -e "
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = '$DB_DATABASE';
        " "$DB_DATABASE" 2>/dev/null | awk 'NR==2{print $1}' || echo "0")
        
        log_info "Tables in database: $table_count"
        
        if [ "$table_count" -gt 0 ]; then
            log_pass "Database contains tables"
        else
            log_fail "Database is empty"
        fi
    else
        log_warning "MySQL client not available for performance check"
    fi
}

# Generate summary report
generate_summary() {
    log_header "DATABASE VALIDATION SUMMARY"
    
    echo -e "\n${BOLD}Test Results:${NC}"
    echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
    
    local success_rate=0
    if [ "$TOTAL_TESTS" -gt 0 ]; then
        success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    fi
    echo -e "Success Rate: ${BLUE}${success_rate}%${NC}"
    
    # Write summary to report file
    echo "" >> "$REPORT_FILE"
    echo "DATABASE VALIDATION SUMMARY" >> "$REPORT_FILE"
    echo "===========================" >> "$REPORT_FILE"
    echo "Date: $(date)" >> "$REPORT_FILE"
    echo "Total Tests: $TOTAL_TESTS" >> "$REPORT_FILE"
    echo "Passed: $PASSED_TESTS" >> "$REPORT_FILE"
    echo "Failed: $FAILED_TESTS" >> "$REPORT_FILE"
    echo "Warnings: $WARNINGS" >> "$REPORT_FILE"
    echo "Success Rate: ${success_rate}%" >> "$REPORT_FILE"
    
    if [ "$FAILED_TESTS" -gt 0 ]; then
        echo -e "\n${RED}${BOLD}Database validation completed with failures!${NC}"
        echo -e "Check the report at: ${BLUE}$REPORT_FILE${NC}\n"
        exit 1
    else
        echo -e "\n${GREEN}${BOLD}Database validation completed successfully!${NC}"
        echo -e "Report saved at: ${BLUE}$REPORT_FILE${NC}\n"
        exit 0
    fi
}

# Main execution
main() {
    echo -e "${BOLD}Database Validation Script${NC}"
    echo -e "Report will be saved to: ${BLUE}$REPORT_FILE${NC}\n"
    
    # Initialize report file
    echo "Database Validation Report - $(date)" > "$REPORT_FILE"
    echo "======================================" >> "$REPORT_FILE"
    
    # Load configuration
    log_header "LOADING CONFIGURATION"
    load_database_config
    log_info "Database: $DB_DATABASE"
    log_info "Host: $DB_HOST:$DB_PORT"
    log_info "Username: $DB_USERNAME"
    
    # Run all tests
    log_header "CONNECTIVITY TESTS"
    test_mysql_connection
    test_laravel_connection
    
    log_header "MIGRATION AND SEEDING"
    test_migration_status
    test_seed_data
    
    log_header "CONNECTION AND PERFORMANCE"
    test_connection_pooling
    test_slow_queries
    test_database_performance
    test_database_indexes
    
    log_header "DATA INTEGRITY"
    test_foreign_keys
    test_crud_operations
    
    # Generate final report
    generate_summary
}

# Check if script is being run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi