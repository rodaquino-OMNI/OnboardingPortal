#!/bin/bash

# UI Testing Suite Runner
# Comprehensive UI testing across all categories

echo "🧪 Starting Comprehensive UI Testing Suite"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run test and track results
run_test_suite() {
    local test_name="$1"
    local test_pattern="$2"
    local description="$3"
    
    echo -e "\n${BLUE}📋 Running: $test_name${NC}"
    echo "Description: $description"
    echo "Pattern: $test_pattern"
    echo "----------------------------------------"
    
    # Run the test
    npm test -- --testPathPattern="$test_pattern" --verbose --passWithNoTests
    
    local test_result=$?
    
    if [ $test_result -eq 0 ]; then
        echo -e "${GREEN}✅ $test_name: PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ $test_name: FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Please run this script from the frontend directory.${NC}"
    exit 1
fi

# Check if Jest is available
if ! npm list jest >/dev/null 2>&1; then
    echo -e "${RED}Error: Jest is not installed. Please run 'npm install' first.${NC}"
    exit 1
fi

echo -e "${YELLOW}🔍 Environment Check${NC}"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Jest version: $(npx jest --version)"
echo ""

# 1. Comprehensive UI Tests
run_test_suite \
    "Comprehensive UI Tests" \
    "__tests__/ui-testing/comprehensive-ui-tests.test.tsx" \
    "Main UI testing suite covering responsive design, interactive elements, accessibility, and browser compatibility"

# 2. Visual Regression Tests
run_test_suite \
    "Visual Regression Tests" \
    "__tests__/ui-testing/visual-regression-tests.test.tsx" \
    "Visual consistency tests for layouts, components states, and theme consistency"

# 3. Browser Compatibility Tests
run_test_suite \
    "Browser Compatibility Tests" \
    "__tests__/ui-testing/browser-compatibility-tests.test.tsx" \
    "Cross-browser compatibility testing for major browsers and platforms"

# 4. Screenshot Tests
run_test_suite \
    "Screenshot Tests" \
    "__tests__/ui-testing/screenshot-tests.test.tsx" \
    "DOM snapshot testing for visual regression detection"

# 5. Run existing accessibility tests
run_test_suite \
    "Existing Accessibility Tests" \
    "__tests__/accessibility/AccessibilityCompliance.test.tsx" \
    "Existing accessibility compliance tests"

# 6. Run mobile-specific tests
run_test_suite \
    "Mobile Viewport Tests" \
    "__tests__/mobile/" \
    "Mobile-specific viewport and touch interaction tests"

# Generate coverage report for UI tests
echo -e "\n${BLUE}📊 Generating Coverage Report${NC}"
npm test -- --testPathPattern="__tests__/ui-testing/" --coverage --coverageDirectory=coverage/ui-tests

# Summary
echo ""
echo "=========================================="
echo -e "${BLUE}🏁 UI Testing Suite Complete${NC}"
echo "=========================================="
echo "Total Test Suites: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All UI tests passed successfully!${NC}"
    echo -e "${GREEN}✅ Application is ready for production deployment${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  Some tests failed. Please review the output above.${NC}"
    exit 1
fi