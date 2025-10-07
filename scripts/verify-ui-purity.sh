#!/bin/bash
# UI Purity Verification Script (ADR-003 Compliance)

echo "======================================"
echo "UI Package Purity Check (ADR-003)"
echo "======================================"
echo ""

VIOLATIONS=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "Checking packages/ui for violations..."
echo ""

# Check 1: No network imports
echo "1. Checking for network imports..."
if find packages/ui/src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.*" -exec grep -H "^\s*import.*\(fetch\|axios\|api\)" {} \; 2>/dev/null | grep -v ":\s*//" | grep -v ":\s*/\*" | grep -v ":\s*\*"; then
  echo -e "${RED}❌ VIOLATION: Network imports found${NC}"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo -e "${GREEN}✅ No network imports${NC}"
fi

# Check 2: No storage access
echo "2. Checking for storage access..."
if find packages/ui/src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.*" -exec grep -H "localStorage\|sessionStorage" {} \; 2>/dev/null | grep -v ":\s*//" | grep -v ":\s*/\*" | grep -v ":\s*\*"; then
  echo -e "${RED}❌ VIOLATION: Storage access found${NC}"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo -e "${GREEN}✅ No storage access${NC}"
fi

# Check 3: No orchestration
echo "3. Checking for orchestration logic..."
if find packages/ui/src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.*" -exec grep -H "useMutation\|useQuery" {} \; 2>/dev/null | grep -v ":\s*//" | grep -v ":\s*/\*" | grep -v ":\s*\*"; then
  echo -e "${RED}❌ VIOLATION: Orchestration logic found${NC}"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo -e "${GREEN}✅ No orchestration logic${NC}"
fi

echo ""
if [ $VIOLATIONS -eq 0 ]; then
  echo -e "${GREEN}✅ UI Package Purity: PASS${NC}"
  exit 0
else
  echo -e "${RED}❌ UI Package Purity: FAIL ($VIOLATIONS violations)${NC}"
  exit 1
fi
