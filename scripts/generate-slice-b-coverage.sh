#!/bin/bash
set -e

echo "=========================================="
echo "Generating Slice B Coverage Report"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Backend Coverage
echo -e "\n${YELLOW}Running Backend Tests (PHP)${NC}"
cd omni-portal/backend

if [ -f "vendor/bin/phpunit" ]; then
    php artisan test --coverage --min=90 --filter=SliceB || {
        echo -e "${RED}Backend tests failed to meet 90% coverage${NC}"
        exit 1
    }
    echo -e "${GREEN}✅ Backend coverage passed${NC}"
else
    echo -e "${RED}PHPUnit not found. Run: composer install${NC}"
    exit 1
fi

# Frontend Coverage
echo -e "\n${YELLOW}Running Frontend Tests (E2E)${NC}"
cd ../../

if [ -f "package.json" ]; then
    npm run test:coverage -- --testPathPattern=documents || {
        echo -e "${RED}Frontend tests failed${NC}"
        exit 1
    }
    echo -e "${GREEN}✅ Frontend coverage passed${NC}"
else
    echo -e "${RED}package.json not found${NC}"
    exit 1
fi

# Generate combined report
echo -e "\n${YELLOW}Generating Combined Coverage Report${NC}"

REPORT_DIR="coverage-reports/slice-b"
mkdir -p "$REPORT_DIR"

echo "Backend Coverage: See omni-portal/backend/coverage/" > "$REPORT_DIR/summary.txt"
echo "Frontend Coverage: See coverage/" >> "$REPORT_DIR/summary.txt"
echo "Generated: $(date)" >> "$REPORT_DIR/summary.txt"

echo -e "${GREEN}✅ Coverage report generated at: $REPORT_DIR${NC}"
echo -e "\n=========================================="
echo -e "${GREEN}Slice B Coverage Report Complete${NC}"
echo -e "=========================================="
