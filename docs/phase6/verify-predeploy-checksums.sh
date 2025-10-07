#!/bin/bash
# Verify all Phase 6 pre-deployment artifact checksums
# Usage: ./verify-predeploy-checksums.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CHECKSUMS_FILE="$SCRIPT_DIR/SLICE_C_PREDEPLOY_CHECKS_CHECKSUMS.txt"

echo "=========================================="
echo "Phase 6 Pre-Deployment Checksums Verification"
echo "=========================================="
echo ""
echo "Project Root: $PROJECT_ROOT"
echo "Checksums File: $CHECKSUMS_FILE"
echo ""

if [ ! -f "$CHECKSUMS_FILE" ]; then
  echo "❌ ERROR: Checksums file not found: $CHECKSUMS_FILE"
  exit 1
fi

echo "Verifying 13 artifacts..."
echo ""

cd "$PROJECT_ROOT"

# Track results
TOTAL=0
PASSED=0
FAILED=0
MISSING=0

while IFS= read -r line; do
  # Skip empty lines and comments
  [[ -z "$line" || "$line" =~ ^# ]] && continue

  TOTAL=$((TOTAL + 1))

  # Extract checksum and file path
  EXPECTED_CHECKSUM=$(echo "$line" | awk '{print $1}')
  FILE_PATH=$(echo "$line" | awk '{$1=""; print $0}' | xargs)

  echo "[$TOTAL/13] Checking: $FILE_PATH"

  if [ ! -f "$FILE_PATH" ]; then
    echo "    ❌ MISSING: File does not exist"
    MISSING=$((MISSING + 1))
    continue
  fi

  # Calculate actual checksum
  ACTUAL_CHECKSUM=$(shasum -a 256 "$FILE_PATH" | awk '{print $1}')

  if [ "$EXPECTED_CHECKSUM" = "$ACTUAL_CHECKSUM" ]; then
    echo "    ✅ PASS: Checksum matches"
    PASSED=$((PASSED + 1))
  else
    echo "    ❌ FAIL: Checksum mismatch"
    echo "       Expected: $EXPECTED_CHECKSUM"
    echo "       Actual:   $ACTUAL_CHECKSUM"
    FAILED=$((FAILED + 1))
  fi

  echo ""
done < "$CHECKSUMS_FILE"

echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo "Total artifacts:  $TOTAL"
echo "✅ Passed:        $PASSED"
echo "❌ Failed:        $FAILED"
echo "⚠️  Missing:       $MISSING"
echo ""

if [ $FAILED -gt 0 ] || [ $MISSING -gt 0 ]; then
  echo "❌ VERIFICATION FAILED"
  echo ""
  echo "Pre-deployment validation is COMPROMISED."
  echo "DO NOT proceed to staging canary until all artifacts pass verification."
  exit 1
else
  echo "✅ VERIFICATION PASSED"
  echo ""
  echo "All 13 artifacts verified successfully."
  echo "Pre-deployment checklist is APPROVED."
  echo ""
  echo "Next steps:"
  echo "  1. Obtain sign-offs from 5 roles (see SLICE_C_PREDEPLOY_CHECKS.md)"
  echo "  2. Activate observability stack (T+1)"
  echo "  3. Execute staging canary deployment (T+2 → T+3)"
  exit 0
fi
