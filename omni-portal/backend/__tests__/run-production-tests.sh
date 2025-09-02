#!/bin/bash

# Production Readiness Test Runner
# Comprehensive test suite to verify production deployment readiness

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    log "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        error "Node.js is required but not installed"
        exit 1
    fi
    
    if ! command -v php &> /dev/null; then
        error "PHP is required but not installed"
        exit 1
    fi
    
    if ! command -v curl &> /dev/null; then
        error "curl is required but not installed"
        exit 1
    fi
    
    success "All dependencies are available"
}

# Start backend services
start_backend() {
    log "Starting backend services..."
    
    # Get the absolute path to the backend directory
    BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
    cd "$BACKEND_DIR"
    
    # Check if Laravel is already running
    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        success "Backend is already running on port 8000"
        return 0
    fi
    
    # Install dependencies if needed
    if [ ! -d "vendor" ]; then
        log "Installing PHP dependencies..."
        composer install --no-dev --optimize-autoloader
    fi
    
    # Set up environment
    if [ ! -f ".env" ]; then
        log "Setting up environment file..."
        cp .env.example .env
        php artisan key:generate
    fi
    
    # Run migrations
    log "Running database migrations..."
    php artisan migrate --force
    
    # Clear caches
    log "Clearing caches..."
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
    
    # Start Laravel server in background
    log "Starting Laravel server..."
    nohup php artisan serve --host=0.0.0.0 --port=8000 > /tmp/laravel.log 2>&1 &
    LARAVEL_PID=$!
    
    # Wait for server to start
    log "Waiting for backend to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
            success "Backend is ready on port 8000"
            echo $LARAVEL_PID > /tmp/laravel.pid
            return 0
        fi
        sleep 2
    done
    
    error "Backend failed to start within 60 seconds"
    kill $LARAVEL_PID 2>/dev/null || true
    exit 1
}

# Start frontend services (if needed)
start_frontend() {
    log "Checking frontend services..."
    
    # Check if frontend is running
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        success "Frontend is already running on port 3000"
        return 0
    fi
    
    warning "Frontend not running - some tests may be limited"
}

# Install Node.js dependencies for tests
install_test_dependencies() {
    log "Installing test dependencies..."
    
    # Create package.json if it doesn't exist
    if [ ! -f "package.json" ]; then
        log "Creating package.json for test dependencies..."
        cat > package.json << 'EOF'
{
  "name": "production-readiness-tests",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test:production": "node __tests__/production-readiness-comprehensive.test.js"
  },
  "devDependencies": {
    "axios": "^1.6.0"
  }
}
EOF
    fi
    
    # Install dependencies
    if [ ! -d "node_modules" ]; then
        log "Installing Node.js dependencies..."
        npm install
    fi
}

# Run the comprehensive production tests
run_production_tests() {
    log "Running comprehensive production readiness tests..."
    log "This will test all critical system components and integrations"
    
    # Make the test file executable
    chmod +x __tests__/production-readiness-comprehensive.test.js
    
    # Run the tests
    if node __tests__/production-readiness-comprehensive.test.js; then
        success "Production readiness tests completed"
        return 0
    else
        error "Production readiness tests failed"
        return 1
    fi
}

# Additional system checks
run_system_checks() {
    log "Running additional system checks..."
    
    # Check disk space
    DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ $DISK_USAGE -gt 90 ]; then
        warning "Disk usage is high: ${DISK_USAGE}%"
    else
        success "Disk usage is acceptable: ${DISK_USAGE}%"
    fi
    
    # Check memory usage
    MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100)}')
    if [ $MEMORY_USAGE -gt 90 ]; then
        warning "Memory usage is high: ${MEMORY_USAGE}%"
    else
        success "Memory usage is acceptable: ${MEMORY_USAGE}%"
    fi
    
    # Check Laravel logs for errors
    if [ -f "storage/logs/laravel.log" ]; then
        ERROR_COUNT=$(grep -c "ERROR" storage/logs/laravel.log 2>/dev/null || echo "0")
        if [ $ERROR_COUNT -gt 10 ]; then
            warning "Found ${ERROR_COUNT} errors in Laravel logs"
        else
            success "Laravel error count is acceptable: ${ERROR_COUNT}"
        fi
    fi
    
    # Test database connection
    if php artisan tinker --execute="DB::connection()->getPdo(); echo 'Database connected successfully';" 2>/dev/null; then
        success "Database connection is working"
    else
        error "Database connection failed"
        return 1
    fi
    
    # Check required directories and permissions
    REQUIRED_DIRS=("storage/app" "storage/framework/cache" "storage/framework/sessions" "storage/logs")
    for dir in "${REQUIRED_DIRS[@]}"; do
        if [ -d "$dir" ] && [ -w "$dir" ]; then
            success "Directory $dir exists and is writable"
        else
            warning "Directory $dir may have permission issues"
        fi
    done
}

# Performance benchmarks
run_performance_benchmarks() {
    log "Running performance benchmarks..."
    
    # Simple load test with curl
    log "Testing API response times..."
    
    ENDPOINTS=(
        "/api/health"
        "/sanctum/csrf-cookie"
        "/api/auth/login"
    )
    
    for endpoint in "${ENDPOINTS[@]}"; do
        log "Testing endpoint: $endpoint"
        
        # Test response time
        RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}" "http://localhost:8000$endpoint" 2>/dev/null || echo "ERROR")
        
        if [ "$RESPONSE_TIME" != "ERROR" ]; then
            if (( $(echo "$RESPONSE_TIME < 1.0" | bc -l) )); then
                success "Endpoint $endpoint: ${RESPONSE_TIME}s (GOOD)"
            elif (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
                warning "Endpoint $endpoint: ${RESPONSE_TIME}s (ACCEPTABLE)"
            else
                warning "Endpoint $endpoint: ${RESPONSE_TIME}s (SLOW)"
            fi
        else
            error "Endpoint $endpoint: FAILED"
        fi
    done
}

# Security checks
run_security_checks() {
    log "Running security checks..."
    
    # Check for debug mode in production
    if grep -q "APP_DEBUG=true" .env 2>/dev/null; then
        error "APP_DEBUG is enabled - this should be false in production"
    else
        success "APP_DEBUG is properly configured"
    fi
    
    # Check for default keys
    if grep -q "base64:.*=" .env 2>/dev/null; then
        success "APP_KEY is set"
    else
        warning "APP_KEY may not be properly configured"
    fi
    
    # Test security headers
    log "Checking security headers..."
    SECURITY_HEADERS=(
        "X-Frame-Options"
        "X-Content-Type-Options"
        "X-XSS-Protection"
    )
    
    for header in "${SECURITY_HEADERS[@]}"; do
        if curl -s -I "http://localhost:8000/api/health" | grep -i "$header" > /dev/null; then
            success "Security header present: $header"
        else
            warning "Security header missing: $header"
        fi
    done
}

# Cleanup function
cleanup() {
    log "Cleaning up test environment..."
    
    # Kill Laravel server if we started it
    if [ -f "/tmp/laravel.pid" ]; then
        LARAVEL_PID=$(cat /tmp/laravel.pid)
        if kill -0 $LARAVEL_PID 2>/dev/null; then
            log "Stopping Laravel server (PID: $LARAVEL_PID)..."
            kill $LARAVEL_PID
            rm -f /tmp/laravel.pid
        fi
    fi
    
    # Clean up temporary files
    rm -f /tmp/laravel.log
}

# Signal handlers
trap cleanup EXIT
trap cleanup INT
trap cleanup TERM

# Main execution
main() {
    log "Starting Production Readiness Test Suite"
    log "========================================"
    
    # Change to backend directory
    BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
    cd "$BACKEND_DIR"
    
    # Run all checks
    check_dependencies
    start_backend
    start_frontend
    install_test_dependencies
    run_system_checks
    run_security_checks
    run_performance_benchmarks
    
    log "========================================"
    log "Running Comprehensive Integration Tests"
    log "========================================"
    
    # Run the main test suite
    if run_production_tests; then
        success "All production readiness tests completed successfully!"
        log "Check the generated report for detailed results"
        
        # Show final summary
        if [ -f "__tests__/production-readiness-report.json" ]; then
            log "Production readiness report generated:"
            echo "$(cat __tests__/production-readiness-report.json | grep -E '(passed|failed|successRate|readinessScore)' | head -10)"
        fi
        
        exit 0
    else
        error "Production readiness tests failed!"
        error "Review the test output and fix any issues before deploying to production"
        exit 1
    fi
}

# Run main function
main "$@"