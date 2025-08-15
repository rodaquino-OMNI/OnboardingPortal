#!/bin/bash

#################################################################
# Docker Test & Verification Script for AUSTA Onboarding Portal
# This script performs comprehensive validation of Docker setup
#################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
ENV_FILE="${PROJECT_ROOT}/.env.docker"
TEST_LOG="${PROJECT_ROOT}/docker/logs/test.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$TEST_LOG"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1" | tee -a "$TEST_LOG"
    ((TESTS_PASSED++))
}

log_failure() {
    echo -e "${RED}[✗]${NC} $1" | tee -a "$TEST_LOG"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1" | tee -a "$TEST_LOG"
}

log_skip() {
    echo -e "${YELLOW}[SKIP]${NC} $1" | tee -a "$TEST_LOG"
    ((TESTS_SKIPPED++))
}

log_test() {
    echo -e "${MAGENTA}[TEST]${NC} $1" | tee -a "$TEST_LOG"
}

# Test functions
test_docker_compose() {
    log_test "Validating docker-compose.yml configuration..."
    
    if docker-compose --env-file "$ENV_FILE" config > /dev/null 2>&1; then
        log_success "Docker Compose configuration is valid"
    else
        log_failure "Docker Compose configuration is invalid"
        docker-compose --env-file "$ENV_FILE" config 2>&1 | tee -a "$TEST_LOG"
        return 1
    fi
}

test_services_running() {
    log_test "Checking if all services are running..."
    
    local services=("mysql" "redis" "backend" "frontend" "nginx")
    local all_running=true
    
    for service in "${services[@]}"; do
        if docker-compose --env-file "$ENV_FILE" ps | grep -q "${service}.*Up"; then
            log_success "Service $service is running"
        else
            log_failure "Service $service is not running"
            all_running=false
        fi
    done
    
    if [ "$all_running" = false ]; then
        return 1
    fi
}

test_mysql_connection() {
    log_test "Testing MySQL database connection..."
    
    # Wait for MySQL to be ready
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker-compose --env-file "$ENV_FILE" exec -T mysql mysql -u root -proot_secret -e "SELECT 1" &> /dev/null; then
            log_success "MySQL connection successful"
            
            # Check if database exists
            if docker-compose --env-file "$ENV_FILE" exec -T mysql mysql -u root -proot_secret -e "USE austa_portal" &> /dev/null; then
                log_success "Database 'austa_portal' exists"
            else
                log_failure "Database 'austa_portal' does not exist"
                return 1
            fi
            
            return 0
        fi
        
        ((attempt++))
        sleep 2
    done
    
    log_failure "MySQL connection failed after $max_attempts attempts"
    return 1
}

test_redis_connection() {
    log_test "Testing Redis connection..."
    
    if docker-compose --env-file "$ENV_FILE" exec -T redis redis-cli -a redis_secret ping | grep -q "PONG"; then
        log_success "Redis connection successful"
    else
        log_failure "Redis connection failed"
        return 1
    fi
}

test_backend_health() {
    log_test "Testing Backend (Laravel) health..."
    
    # Check PHP-FPM status
    if docker-compose --env-file "$ENV_FILE" exec -T backend php-fpm -t &> /dev/null; then
        log_success "PHP-FPM configuration is valid"
    else
        log_failure "PHP-FPM configuration is invalid"
        return 1
    fi
    
    # Check Laravel artisan
    if docker-compose --env-file "$ENV_FILE" exec -T backend php artisan --version &> /dev/null; then
        log_success "Laravel artisan is functional"
    else
        log_failure "Laravel artisan is not functional"
        return 1
    fi
    
    # Check if vendor directory exists
    if docker-compose --env-file "$ENV_FILE" exec -T backend test -d /var/www/vendor; then
        log_success "Vendor directory exists"
    else
        log_failure "Vendor directory missing - run composer install"
        return 1
    fi
}

test_frontend_health() {
    log_test "Testing Frontend (Next.js) health..."
    
    # Check if Next.js is responding
    local response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ] || [ "$response" = "302" ]; then
        log_success "Frontend is responding (HTTP $response)"
    else
        log_failure "Frontend is not responding (HTTP $response)"
        return 1
    fi
    
    # Check if node_modules exists
    if docker-compose --env-file "$ENV_FILE" exec -T frontend test -d /app/node_modules; then
        log_success "Node modules directory exists"
    else
        log_failure "Node modules directory missing"
        return 1
    fi
}

test_nginx_proxy() {
    log_test "Testing Nginx reverse proxy..."
    
    # Test Nginx configuration
    if docker-compose --env-file "$ENV_FILE" exec -T nginx nginx -t &> /dev/null; then
        log_success "Nginx configuration is valid"
    else
        log_failure "Nginx configuration is invalid"
        return 1
    fi
    
    # Test backend API through Nginx
    local api_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/test 2>/dev/null || echo "000")
    
    if [ "$api_response" = "200" ]; then
        log_success "Backend API accessible through Nginx (HTTP $api_response)"
    else
        log_warning "Backend API not responding through Nginx (HTTP $api_response)"
    fi
}

test_database_migrations() {
    log_test "Testing database migrations..."
    
    # Run migrations
    if docker-compose --env-file "$ENV_FILE" exec -T backend php artisan migrate:status &> /dev/null; then
        log_success "Database migrations checked successfully"
        
        # Run migrations (if not already run)
        if docker-compose --env-file "$ENV_FILE" exec -T backend php artisan migrate --force 2>&1 | tee -a "$TEST_LOG"; then
            log_success "Database migrations executed successfully"
        else
            log_warning "Database migrations may have issues"
        fi
    else
        log_failure "Cannot check database migrations"
        return 1
    fi
}

test_storage_permissions() {
    log_test "Testing storage permissions..."
    
    # Check if storage is writable
    if docker-compose --env-file "$ENV_FILE" exec -T backend touch /var/www/storage/logs/test.tmp && \
       docker-compose --env-file "$ENV_FILE" exec -T backend rm /var/www/storage/logs/test.tmp; then
        log_success "Storage directory is writable"
    else
        log_failure "Storage directory is not writable"
        return 1
    fi
}

test_ocr_capabilities() {
    log_test "Testing OCR capabilities..."
    
    # Check Tesseract in backend
    if docker-compose --env-file "$ENV_FILE" exec -T backend which tesseract &> /dev/null; then
        log_success "Tesseract OCR is installed in backend"
        
        # Check Tesseract version
        local tess_version=$(docker-compose --env-file "$ENV_FILE" exec -T backend tesseract --version 2>&1 | head -n 1)
        log_info "Tesseract version: $tess_version"
    else
        log_failure "Tesseract OCR is not installed in backend"
        return 1
    fi
    
    # Check Portuguese language data
    if docker-compose --env-file "$ENV_FILE" exec -T backend test -f /usr/share/tessdata/por.traineddata; then
        log_success "Portuguese OCR language data is installed"
    else
        log_failure "Portuguese OCR language data is missing"
        return 1
    fi
}

test_queue_worker() {
    log_test "Testing queue worker..."
    
    if docker-compose --env-file "$ENV_FILE" ps | grep -q "queue-worker.*Up"; then
        log_success "Queue worker is running"
        
        # Check if queue worker can process jobs
        if docker-compose --env-file "$ENV_FILE" exec -T backend php artisan queue:work --stop-when-empty &> /dev/null; then
            log_success "Queue worker can process jobs"
        else
            log_warning "Queue worker may have issues processing jobs"
        fi
    else
        log_failure "Queue worker is not running"
        return 1
    fi
}

test_scheduler() {
    log_test "Testing scheduler (cron)..."
    
    if docker-compose --env-file "$ENV_FILE" ps | grep -q "scheduler.*Up"; then
        log_success "Scheduler is running"
    else
        log_failure "Scheduler is not running"
        return 1
    fi
}

test_environment_variables() {
    log_test "Testing environment variables..."
    
    # Check critical env vars in backend
    local env_vars=("APP_KEY" "DB_CONNECTION" "DB_HOST" "REDIS_HOST")
    local all_set=true
    
    for var in "${env_vars[@]}"; do
        if docker-compose --env-file "$ENV_FILE" exec -T backend printenv "$var" &> /dev/null; then
            log_success "Environment variable $var is set"
        else
            log_failure "Environment variable $var is not set"
            all_set=false
        fi
    done
    
    if [ "$all_set" = false ]; then
        return 1
    fi
}

test_api_endpoints() {
    log_test "Testing API endpoints..."
    
    # Test health endpoint
    local health_response=$(curl -s http://localhost:8000/health 2>/dev/null || echo "{}")
    
    if echo "$health_response" | grep -q "healthy\|ok\|success"; then
        log_success "Health endpoint is responding"
    else
        log_warning "Health endpoint may not be configured"
    fi
    
    # Test API test endpoint
    local api_test=$(curl -s http://localhost:8000/api/test 2>/dev/null || echo "{}")
    
    if echo "$api_test" | grep -q "working"; then
        log_success "API test endpoint is working"
    else
        log_warning "API test endpoint not responding as expected"
    fi
}

test_development_tools() {
    log_test "Testing development tools..."
    
    # Check if MailHog is running
    if docker-compose --env-file "$ENV_FILE" ps | grep -q "mailhog.*Up"; then
        log_success "MailHog (mail catcher) is running"
        
        # Test MailHog web interface
        local mailhog_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8025 2>/dev/null || echo "000")
        if [ "$mailhog_response" = "200" ]; then
            log_success "MailHog web interface accessible at http://localhost:8025"
        else
            log_warning "MailHog web interface not accessible"
        fi
    else
        log_skip "MailHog not configured"
    fi
    
    # Check if phpMyAdmin is running
    if docker-compose --env-file "$ENV_FILE" ps | grep -q "phpmyadmin.*Up"; then
        log_success "phpMyAdmin is running"
        
        # Test phpMyAdmin web interface
        local pma_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>/dev/null || echo "000")
        if [ "$pma_response" = "200" ]; then
            log_success "phpMyAdmin accessible at http://localhost:8080"
        else
            log_warning "phpMyAdmin web interface not accessible"
        fi
    else
        log_skip "phpMyAdmin not configured"
    fi
}

run_integration_tests() {
    log_test "Running integration tests..."
    
    # Create a test file upload
    local test_file="/tmp/test_upload.txt"
    echo "Test content for OCR" > "$test_file"
    
    # Test file upload capability (if endpoint exists)
    # This is a placeholder - actual endpoint needs to be configured
    log_skip "File upload integration test - endpoint needs configuration"
    
    rm -f "$test_file"
}

generate_test_report() {
    log_info "Generating test report..."
    
    local report_file="${PROJECT_ROOT}/docker/logs/test_report_${TIMESTAMP}.txt"
    local total_tests=$((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))
    local pass_rate=0
    
    if [ $total_tests -gt 0 ]; then
        pass_rate=$((TESTS_PASSED * 100 / total_tests))
    fi
    
    {
        echo "==============================================="
        echo "Docker Test Report - $(date)"
        echo "==============================================="
        echo ""
        echo "Test Summary:"
        echo "  Total Tests: $total_tests"
        echo "  Passed: $TESTS_PASSED"
        echo "  Failed: $TESTS_FAILED"
        echo "  Skipped: $TESTS_SKIPPED"
        echo "  Pass Rate: ${pass_rate}%"
        echo ""
        echo "Service Status:"
        docker-compose --env-file "$ENV_FILE" ps
        echo ""
        echo "Container Health:"
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        echo "==============================================="
    } > "$report_file"
    
    log_success "Test report created: $report_file"
    
    # Return overall test status
    if [ $TESTS_FAILED -eq 0 ]; then
        return 0
    else
        return 1
    fi
}

main() {
    echo "==============================================="
    echo "Starting Docker Test Suite"
    echo "==============================================="
    
    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$TEST_LOG")"
    
    # Clear previous log
    > "$TEST_LOG"
    
    # Check if services are up
    log_info "Ensuring services are running..."
    if ! docker-compose --env-file "$ENV_FILE" ps | grep -q "Up"; then
        log_warning "Services are not running. Starting them now..."
        docker-compose --env-file "$ENV_FILE" up -d
        sleep 10  # Wait for services to initialize
    fi
    
    # Run all tests
    test_docker_compose
    test_services_running
    test_mysql_connection
    test_redis_connection
    test_backend_health
    test_frontend_health
    test_nginx_proxy
    test_database_migrations
    test_storage_permissions
    test_ocr_capabilities
    test_queue_worker
    test_scheduler
    test_environment_variables
    test_api_endpoints
    test_development_tools
    run_integration_tests
    
    # Generate report
    generate_test_report
    
    echo ""
    echo "==============================================="
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}All tests passed successfully!${NC}"
        echo "==============================================="
        exit 0
    else
        echo -e "${RED}Some tests failed. Please review the report.${NC}"
        echo "==============================================="
        exit 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose)
            set -x
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --verbose     Enable verbose output"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main