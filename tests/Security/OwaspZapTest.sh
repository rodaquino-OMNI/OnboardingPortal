#!/bin/bash

# OWASP ZAP Baseline Security Scan
# Per SECURITY_CHECKLIST.md requirements
# Tests Slices A & B for common vulnerabilities

set -e

echo "🔒 Starting OWASP ZAP Baseline Security Scan..."

# Configuration
TARGET_URL="${TARGET_URL:-https://dev.onboarding.local}"
REPORT_DIR="$(pwd)/tests/Security/reports"
REPORT_FILE="${REPORT_DIR}/zap-baseline-report.html"
JSON_REPORT="${REPORT_DIR}/zap-baseline-report.json"

# Create reports directory
mkdir -p "${REPORT_DIR}"

echo "Target: ${TARGET_URL}"
echo "Report: ${REPORT_FILE}"

# Run OWASP ZAP baseline scan
docker run --rm \
  -v $(pwd)/tests/Security:/zap/wrk/:rw \
  owasp/zap2docker-stable zap-baseline.py \
  -t "${TARGET_URL}" \
  -r zap-baseline-report.html \
  -J zap-baseline-report.json \
  -c zap-rules.conf \
  -d \
  -a \
  -I

# Move reports to reports directory
mv tests/Security/zap-baseline-report.html "${REPORT_FILE}" 2>/dev/null || true
mv tests/Security/zap-baseline-report.json "${JSON_REPORT}" 2>/dev/null || true

echo "📊 Analyzing scan results..."

# Check for high/critical findings
if [ -f "${REPORT_FILE}" ]; then
  FAIL_NEW=$(grep -c "FAIL-NEW:" "${REPORT_FILE}" || echo "0")
  FAIL_INPROG=$(grep -c "FAIL-INPROG:" "${REPORT_FILE}" || echo "0")
  WARN=$(grep -c "WARN:" "${REPORT_FILE}" || echo "0")

  echo "Results:"
  echo "  New Failures: ${FAIL_NEW}"
  echo "  In Progress Failures: ${FAIL_INPROG}"
  echo "  Warnings: ${WARN}"

  # Check if scan passed
  if [ "${FAIL_NEW}" = "0" ] && [ "${FAIL_INPROG}" = "0" ]; then
    echo "✅ Security scan PASSED - No high/critical findings detected"
    echo "⚠️  Warnings: ${WARN} (review recommended)"
    exit 0
  else
    echo "❌ Security scan FAILED - High/critical findings detected"
    echo "📄 Full report: ${REPORT_FILE}"
    exit 1
  fi
else
  echo "❌ Security scan failed - Report file not generated"
  exit 1
fi
