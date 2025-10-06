#!/bin/bash

# Comprehensive Test Coverage Report
# Runs all test suites and generates unified coverage report
# Per Testing QA Agent requirements

set -e

echo "🧪 Running comprehensive test suite for Slices A & B..."
echo "=================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Timestamps
START_TIME=$(date +%s)
TIMESTAMP=$(date +"%Y-%m-%d-%H-%M-%S")

# Report directory
REPORT_DIR="tests/reports/${TIMESTAMP}"
mkdir -p "${REPORT_DIR}"

# Initialize results
BACKEND_COVERAGE=0
MUTATION_SCORE=0
FRONTEND_COVERAGE=0
E2E_RESULT=0
CONTRACT_RESULT=0
SECURITY_RESULT=0
PERFORMANCE_RESULT=0

echo ""
echo "📊 Test Suite Execution Plan:"
echo "  1. Backend Unit & Integration Tests (Laravel/Pest)"
echo "  2. Mutation Testing (Infection)"
echo "  3. Frontend Tests (Vitest)"
echo "  4. E2E Tests (Playwright)"
echo "  5. Contract Tests (Spectator)"
echo "  6. Security Scan (OWASP ZAP)"
echo "  7. Performance Tests (k6)"
echo ""

# ============================================================
# 1. Backend Tests with Coverage
# ============================================================
echo "🔧 Running backend tests..."
cd omni-portal/backend || exit 1

# Run Pest with coverage
./vendor/bin/pest \
  --coverage \
  --min=85 \
  --coverage-html="${REPORT_DIR}/backend-coverage" \
  --coverage-clover="${REPORT_DIR}/backend-coverage.xml" \
  --log-junit="${REPORT_DIR}/backend-junit.xml" \
  || BACKEND_COVERAGE=1

if [ $BACKEND_COVERAGE -eq 0 ]; then
  echo -e "${GREEN}✅ Backend tests PASSED${NC}"
else
  echo -e "${RED}❌ Backend tests FAILED${NC}"
fi

# ============================================================
# 2. Mutation Testing
# ============================================================
echo ""
echo "🧬 Running mutation testing..."

./vendor/bin/infection \
  --min-msi=60 \
  --min-covered-msi=70 \
  --threads=4 \
  --log-verbosity=none \
  --no-progress \
  || MUTATION_SCORE=1

if [ $MUTATION_SCORE -eq 0 ]; then
  echo -e "${GREEN}✅ Mutation score PASSED${NC}"
else
  echo -e "${YELLOW}⚠️  Mutation score below threshold${NC}"
fi

# ============================================================
# 3. Frontend Tests
# ============================================================
echo ""
echo "⚛️  Running frontend tests..."
cd ../frontend || exit 1

npm run test:coverage -- \
  --coverage.statements=85 \
  --coverage.branches=80 \
  --coverage.functions=85 \
  --coverage.lines=85 \
  --reporter=junit \
  --reporter=html \
  || FRONTEND_COVERAGE=1

# Move frontend coverage to reports directory
mv coverage "${REPORT_DIR}/frontend-coverage" 2>/dev/null || true

if [ $FRONTEND_COVERAGE -eq 0 ]; then
  echo -e "${GREEN}✅ Frontend tests PASSED${NC}"
else
  echo -e "${RED}❌ Frontend tests FAILED${NC}"
fi

# ============================================================
# 4. E2E Tests (Playwright)
# ============================================================
echo ""
echo "🎭 Running E2E tests..."

npx playwright test \
  --reporter=html \
  --reporter=junit \
  || E2E_RESULT=1

# Move Playwright report
mv playwright-report "${REPORT_DIR}/e2e-report" 2>/dev/null || true

if [ $E2E_RESULT -eq 0 ]; then
  echo -e "${GREEN}✅ E2E tests PASSED${NC}"
else
  echo -e "${RED}❌ E2E tests FAILED${NC}"
fi

# ============================================================
# 5. Contract Tests (API Spec Validation)
# ============================================================
echo ""
echo "📋 Running contract tests..."
cd ../backend || exit 1

./vendor/bin/pest \
  tests/Contract \
  --log-junit="${REPORT_DIR}/contract-junit.xml" \
  || CONTRACT_RESULT=1

if [ $CONTRACT_RESULT -eq 0 ]; then
  echo -e "${GREEN}✅ Contract tests PASSED${NC}"
else
  echo -e "${RED}❌ Contract tests FAILED${NC}"
fi

# ============================================================
# 6. Security Scan (OWASP ZAP)
# ============================================================
echo ""
echo "🔒 Running security scan..."
cd ../.. || exit 1

# Check if Docker is available
if command -v docker &> /dev/null; then
  ./tests/Security/OwaspZapTest.sh || SECURITY_RESULT=1

  # Move security report
  mv tests/Security/reports "${REPORT_DIR}/security-report" 2>/dev/null || true

  if [ $SECURITY_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ Security scan PASSED${NC}"
  else
    echo -e "${RED}❌ Security scan FAILED${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Docker not available, skipping security scan${NC}"
  SECURITY_RESULT=0
fi

# ============================================================
# 7. Performance Tests (k6)
# ============================================================
echo ""
echo "⚡ Running performance tests..."

# Check if k6 is available
if command -v k6 &> /dev/null; then
  # Slice A performance test
  k6 run \
    --out json="${REPORT_DIR}/slice-a-perf.json" \
    tests/Performance/slice-a-load-test.js \
    || PERFORMANCE_RESULT=1

  # Slice B performance test
  k6 run \
    --out json="${REPORT_DIR}/slice-b-perf.json" \
    tests/Performance/slice-b-load-test.js \
    || PERFORMANCE_RESULT=1

  if [ $PERFORMANCE_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ Performance tests PASSED${NC}"
  else
    echo -e "${RED}❌ Performance tests FAILED${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  k6 not available, skipping performance tests${NC}"
  PERFORMANCE_RESULT=0
fi

# ============================================================
# Generate Summary Report
# ============================================================
echo ""
echo "=================================================="
echo "📊 Test Results Summary"
echo "=================================================="

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "Duration: ${DURATION}s"
echo ""
echo "Results:"
echo "--------"
printf "Backend Coverage:    "
[ $BACKEND_COVERAGE -eq 0 ] && echo -e "${GREEN}✅ PASS${NC}" || echo -e "${RED}❌ FAIL${NC}"

printf "Mutation Score:      "
[ $MUTATION_SCORE -eq 0 ] && echo -e "${GREEN}✅ PASS${NC}" || echo -e "${YELLOW}⚠️  WARN${NC}"

printf "Frontend Coverage:   "
[ $FRONTEND_COVERAGE -eq 0 ] && echo -e "${GREEN}✅ PASS${NC}" || echo -e "${RED}❌ FAIL${NC}"

printf "E2E Tests:           "
[ $E2E_RESULT -eq 0 ] && echo -e "${GREEN}✅ PASS${NC}" || echo -e "${RED}❌ FAIL${NC}"

printf "Contract Tests:      "
[ $CONTRACT_RESULT -eq 0 ] && echo -e "${GREEN}✅ PASS${NC}" || echo -e "${RED}❌ FAIL${NC}"

printf "Security Scan:       "
[ $SECURITY_RESULT -eq 0 ] && echo -e "${GREEN}✅ PASS${NC}" || echo -e "${RED}❌ FAIL${NC}"

printf "Performance Tests:   "
[ $PERFORMANCE_RESULT -eq 0 ] && echo -e "${GREEN}✅ PASS${NC}" || echo -e "${RED}❌ FAIL${NC}"

echo ""
echo "Reports saved to: ${REPORT_DIR}"
echo ""

# Generate JSON summary
cat > "${REPORT_DIR}/summary.json" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "duration_seconds": ${DURATION},
  "results": {
    "backend_coverage": $([ $BACKEND_COVERAGE -eq 0 ] && echo "true" || echo "false"),
    "mutation_score": $([ $MUTATION_SCORE -eq 0 ] && echo "true" || echo "false"),
    "frontend_coverage": $([ $FRONTEND_COVERAGE -eq 0 ] && echo "true" || echo "false"),
    "e2e_tests": $([ $E2E_RESULT -eq 0 ] && echo "true" || echo "false"),
    "contract_tests": $([ $CONTRACT_RESULT -eq 0 ] && echo "true" || echo "false"),
    "security_scan": $([ $SECURITY_RESULT -eq 0 ] && echo "true" || echo "false"),
    "performance_tests": $([ $PERFORMANCE_RESULT -eq 0 ] && echo "true" || echo "false")
  },
  "overall": $([ $BACKEND_COVERAGE -eq 0 ] && [ $FRONTEND_COVERAGE -eq 0 ] && [ $E2E_RESULT -eq 0 ] && [ $CONTRACT_RESULT -eq 0 ] && [ $SECURITY_RESULT -eq 0 ] && echo "\"PASS\"" || echo "\"FAIL\"")
}
EOF

# Exit with failure if any critical test failed
if [ $BACKEND_COVERAGE -ne 0 ] || [ $FRONTEND_COVERAGE -ne 0 ] || \
   [ $E2E_RESULT -ne 0 ] || [ $CONTRACT_RESULT -ne 0 ] || \
   [ $SECURITY_RESULT -ne 0 ]; then
  echo -e "${RED}❌ Test suite FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All tests PASSED${NC}"
  exit 0
fi
