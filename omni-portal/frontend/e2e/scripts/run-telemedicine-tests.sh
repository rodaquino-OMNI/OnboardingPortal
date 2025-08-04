#!/bin/bash

# ==========================================
# 🧠 ULTRA-THINK E2E TEST EXECUTION SCRIPT
# Telemedicine Booking Flow - Technical Excellence
# ==========================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/test-results"
REPORT_DIR="$PROJECT_ROOT/playwright-report"

echo -e "${BLUE}🧠 ULTRA-THINK E2E TEST SUITE${NC}"
echo -e "${BLUE}===============================================${NC}"
echo -e "Project Root: $PROJECT_ROOT"
echo -e "Results Directory: $RESULTS_DIR"
echo -e "Report Directory: $REPORT_DIR"
echo ""

# Create results directory
mkdir -p "$RESULTS_DIR"

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "info")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
        "success")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "error")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
    esac
}

# Function to run tests with specific configuration
run_test_suite() {
    local test_name=$1
    local test_file=$2
    local project=$3
    local additional_args=$4

    print_status "info" "Running $test_name tests on $project..."
    
    # Build the command
    local cmd="npx playwright test $test_file --project='$project' $additional_args"
    
    # Execute with error handling
    if eval $cmd; then
        print_status "success" "$test_name tests passed on $project"
        return 0
    else
        print_status "error" "$test_name tests failed on $project"
        return 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "info" "Checking prerequisites..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_status "error" "Node.js is not installed"
        exit 1
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        print_status "error" "npm is not installed"
        exit 1
    fi
    
    # Check if playwright is installed
    if ! npx playwright --version &> /dev/null; then
        print_status "warning" "Playwright not found, installing..."
        npm install @playwright/test
        npx playwright install
    fi
    
    print_status "success" "Prerequisites check completed"
}

# Function to start development server
start_dev_server() {
    print_status "info" "Starting development server..."
    
    # Check if server is already running
    if curl -s http://localhost:3000 > /dev/null; then
        print_status "success" "Development server already running"
        return 0
    fi
    
    # Start server in background
    npm run dev &
    SERVER_PID=$!
    
    # Wait for server to be ready
    local retries=30
    while [ $retries -gt 0 ]; do
        if curl -s http://localhost:3000 > /dev/null; then
            print_status "success" "Development server started (PID: $SERVER_PID)"
            return 0
        fi
        retries=$((retries - 1))
        sleep 2
    done
    
    print_status "error" "Failed to start development server"
    exit 1
}

# Function to cleanup
cleanup() {
    if [ ! -z "$SERVER_PID" ]; then
        print_status "info" "Stopping development server (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null || true
    fi
}

# Trap cleanup on script exit
trap cleanup EXIT

# Main execution
main() {
    print_status "info" "Starting Telemedicine E2E Test Suite..."
    
    # Change to project directory
    cd "$PROJECT_ROOT"
    
    # Check prerequisites
    check_prerequisites
    
    # Start development server
    start_dev_server
    
    # Parse command line arguments
    local test_type="all"
    local browser="chromium"
    local headed=false
    local debug=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --type=*)
                test_type="${1#*=}"
                shift
                ;;
            --browser=*)
                browser="${1#*=}"
                shift
                ;;
            --headed)
                headed=true
                shift
                ;;
            --debug)
                debug=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --type=TYPE      Test type: all, core, auth, errors, mobile, performance (default: all)"
                echo "  --browser=BROWSER Browser: chromium, firefox, webkit (default: chromium)"
                echo "  --headed         Run tests in headed mode"
                echo "  --debug          Enable debug mode"
                echo "  --help           Show this help message"
                exit 0
                ;;
            *)
                print_status "error" "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Build additional arguments
    local additional_args=""
    if [ "$headed" = true ]; then
        additional_args="$additional_args --headed"
    fi
    if [ "$debug" = true ]; then
        additional_args="$additional_args --debug"
    fi
    
    print_status "info" "Configuration:"
    print_status "info" "  Test Type: $test_type"
    print_status "info" "  Browser: $browser"
    print_status "info" "  Headed: $headed"
    print_status "info" "  Debug: $debug"
    echo ""
    
    # Initialize test results
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    
    # Core Booking Flow Tests
    if [ "$test_type" = "all" ] || [ "$test_type" = "core" ]; then
        print_status "info" "🎯 Running Core Booking Flow Tests..."
        total_tests=$((total_tests + 1))
        if run_test_suite "Core Booking Flow" "telemedicine-booking-flow.spec.ts" "$browser" "--grep='Core Authenticated Booking Flow' $additional_args"; then
            passed_tests=$((passed_tests + 1))
        else
            failed_tests=$((failed_tests + 1))
        fi
        echo ""
    fi
    
    # Authentication & Session Tests
    if [ "$test_type" = "all" ] || [ "$test_type" = "auth" ]; then
        print_status "info" "🔐 Running Authentication & Session Tests..."
        total_tests=$((total_tests + 1))
        if run_test_suite "Authentication & Session" "telemedicine-booking-flow.spec.ts" "$browser" "--grep='Authentication.*Session Management' $additional_args"; then
            passed_tests=$((passed_tests + 1))
        else
            failed_tests=$((failed_tests + 1))
        fi
        echo ""
    fi
    
    # Error Scenarios Tests
    if [ "$test_type" = "all" ] || [ "$test_type" = "errors" ]; then
        print_status "info" "⚠️ Running Error Scenarios Tests..."
        total_tests=$((total_tests + 1))
        if run_test_suite "Error Scenarios" "telemedicine-booking-flow.spec.ts" "$browser" "--grep='Error Scenarios.*Edge Cases' $additional_args"; then
            passed_tests=$((passed_tests + 1))
        else
            failed_tests=$((failed_tests + 1))
        fi
        echo ""
    fi
    
    # Mobile & Cross-Device Tests
    if [ "$test_type" = "all" ] || [ "$test_type" = "mobile" ]; then
        print_status "info" "📱 Running Mobile & Cross-Device Tests..."
        total_tests=$((total_tests + 1))
        if run_test_suite "Mobile & Cross-Device" "telemedicine-booking-flow.spec.ts" "Mobile Chrome" "--grep='Mobile.*Cross-Device' $additional_args"; then
            passed_tests=$((passed_tests + 1))
        else
            failed_tests=$((failed_tests + 1))
        fi
        echo ""
    fi
    
    # Performance Tests
    if [ "$test_type" = "all" ] || [ "$test_type" = "performance" ]; then
        print_status "info" "⚡ Running Performance Tests..."
        total_tests=$((total_tests + 1))
        if run_test_suite "Performance" "telemedicine-booking-flow.spec.ts" "$browser" "--grep='Performance.*Load Testing' $additional_args"; then
            passed_tests=$((passed_tests + 1))
        else
            failed_tests=$((failed_tests + 1))
        fi
        echo ""
    fi
    
    # Accessibility Tests
    if [ "$test_type" = "all" ]; then
        print_status "info" "♿ Running Accessibility Tests..."
        total_tests=$((total_tests + 1))
        if run_test_suite "Accessibility" "telemedicine-booking-flow.spec.ts" "$browser" "--grep='Accessibility Validation' $additional_args"; then
            passed_tests=$((passed_tests + 1))
        else
            failed_tests=$((failed_tests + 1))
        fi
        echo ""
    fi
    
    # Browser Navigation Tests
    if [ "$test_type" = "all" ]; then
        print_status "info" "🧭 Running Browser Navigation Tests..."
        total_tests=$((total_tests + 1))
        if run_test_suite "Browser Navigation" "telemedicine-booking-flow.spec.ts" "$browser" "--grep='Browser Navigation.*State Management' $additional_args"; then
            passed_tests=$((passed_tests + 1))
        else
            failed_tests=$((failed_tests + 1))
        fi
        echo ""
    fi
    
    # Generate test report
    print_status "info" "Generating test report..."
    npx playwright show-report --host=0.0.0.0 &
    REPORT_PID=$!
    
    # Final summary
    echo ""
    print_status "info" "🧠 ULTRA-THINK E2E TEST SUITE COMPLETE"
    print_status "info" "============================================="
    print_status "info" "Total Tests: $total_tests"
    print_status "success" "Passed: $passed_tests"
    if [ $failed_tests -gt 0 ]; then
        print_status "error" "Failed: $failed_tests"
    else
        print_status "success" "Failed: $failed_tests"
    fi
    echo ""
    
    if [ $failed_tests -eq 0 ]; then
        print_status "success" "🎉 ALL TESTS PASSED! Telemedicine booking flow is production-ready!"
        print_status "info" "📊 Test report available at: http://localhost:9323"
        print_status "info" "📁 Test results saved to: $RESULTS_DIR"
    else
        print_status "error" "❌ Some tests failed. Please review the results and fix issues."
        print_status "info" "📊 Test report available at: http://localhost:9323"
        print_status "info" "📁 Test results saved to: $RESULTS_DIR"
        exit 1
    fi
    
    # Keep report server running
    print_status "info" "Press Ctrl+C to stop the report server and exit"
    wait $REPORT_PID
}

# Execute main function
main "$@"