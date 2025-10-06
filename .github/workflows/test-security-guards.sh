#!/bin/bash

# Local testing script for Sprint 2A Security Guards
# Run this before pushing to catch violations early

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔒 Sprint 2A Security Guards - Local Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FAILED=0

# Guard 1: Forbidden browser storage in sensitive paths
echo ""
echo "🔒 Testing Guard 1: No browser storage in auth/health..."
if grep -r --include=\*.{ts,tsx,js,jsx} -n "localStorage\|sessionStorage\|IndexedDB" \
  apps/*/src/auth apps/*/src/health apps/*/src/features/health 2>/dev/null; then
  echo "❌ Guard 1 FAILED"
  FAILED=$((FAILED + 1))
else
  echo "✅ Guard 1 PASSED"
fi

# Guard 2: No imports from archive
echo ""
echo "🔒 Testing Guard 2: No imports from archive/..."
if grep -r --include=\*.{ts,tsx,js,jsx} -E "from ['\"].*archive/|import.*from ['\"].*archive/" \
  apps packages 2>/dev/null | grep -v node_modules; then
  echo "❌ Guard 2 FAILED"
  FAILED=$((FAILED + 1))
else
  echo "✅ Guard 2 PASSED"
fi

# Guard 3: UI package purity
echo ""
echo "🔒 Testing Guard 3: UI package purity..."
if grep -r --include=\*.{ts,tsx,js,jsx} -n "localStorage\|sessionStorage\|fetch(\|axios" \
  packages/ui/src 2>/dev/null | grep -v "// "; then
  echo "❌ Guard 3 FAILED"
  FAILED=$((FAILED + 1))
else
  echo "✅ Guard 3 PASSED"
fi

# Guard 4: Orchestration boundary
echo ""
echo "🔒 Testing Guard 4: Orchestration boundary..."
if grep -r --include=\*.{ts,tsx,js,jsx} -n "from '@/hooks/use\|from '@/services/api'\|import api from" \
  packages/ui/src 2>/dev/null | grep -v "useToast" | grep -v "useMediaQuery"; then
  echo "❌ Guard 4 FAILED"
  FAILED=$((FAILED + 1))
else
  echo "✅ Guard 4 PASSED"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAILED -eq 0 ]; then
  echo "✅ ALL SECURITY GUARDS PASSED"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
else
  echo "❌ $FAILED GUARD(S) FAILED"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Fix violations before pushing"
  exit 1
fi
