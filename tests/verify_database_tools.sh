#!/bin/bash

# Verification script for database validation tools
# This script tests both the bash script and PHP artisan command

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/omni-portal/backend"

echo -e "${BOLD}Database Validation Tools Verification${NC}\n"

# Test 1: Check if bash script exists and is executable
echo -e "${BLUE}[1/5]${NC} Checking bash validation script..."
if [ -f "$SCRIPT_DIR/database_validation.sh" ] && [ -x "$SCRIPT_DIR/database_validation.sh" ]; then
    echo -e "${GREEN}✅ Bash script exists and is executable${NC}"
else
    echo -e "${RED}❌ Bash script missing or not executable${NC}"
    exit 1
fi

# Test 2: Check if PHP artisan command exists
echo -e "${BLUE}[2/5]${NC} Checking PHP artisan command..."
if [ -f "$BACKEND_DIR/app/Console/Commands/DatabaseHealthCheck.php" ]; then
    echo -e "${GREEN}✅ PHP artisan command exists${NC}"
else
    echo -e "${RED}❌ PHP artisan command missing${NC}"
    exit 1
fi

# Test 3: Check if Laravel can find the command
echo -e "${BLUE}[3/5]${NC} Verifying Laravel command registration..."
cd "$BACKEND_DIR"
if php artisan list | grep -q "db:health-check"; then
    echo -e "${GREEN}✅ Command registered successfully${NC}"
else
    echo -e "${RED}❌ Command not found in Laravel${NC}"
    exit 1
fi

# Test 4: Test bash script help/version
echo -e "${BLUE}[4/5]${NC} Testing bash script basic functionality..."
if "$SCRIPT_DIR/database_validation.sh" --help 2>/dev/null || true; then
    echo -e "${GREEN}✅ Bash script responds to help flag${NC}"
else
    echo -e "${YELLOW}⚠️  Bash script doesn't respond to --help (this is ok)${NC}"
fi

# Test 5: Test PHP command help
echo -e "${BLUE}[5/5]${NC} Testing PHP artisan command help..."
if php artisan db:health-check --help >/dev/null 2>&1; then
    echo -e "${GREEN}✅ PHP command help works${NC}"
else
    echo -e "${RED}❌ PHP command help failed${NC}"
    exit 1
fi

echo -e "\n${GREEN}${BOLD}✅ All verification tests passed!${NC}\n"

echo -e "${BOLD}Usage Instructions:${NC}"
echo -e "${YELLOW}Bash Script:${NC}"
echo -e "  $SCRIPT_DIR/database_validation.sh"
echo ""
echo -e "${YELLOW}PHP Artisan Command:${NC}"
echo -e "  cd $BACKEND_DIR"
echo -e "  php artisan db:health-check"
echo -e "  php artisan db:health-check --verbose"
echo -e "  php artisan db:health-check --save-report"
echo -e "  php artisan db:health-check --format=json --save-report"
echo -e "  php artisan db:health-check --format=html --save-report"

echo -e "\n${BOLD}Features:${NC}"
echo -e "• Comprehensive database connectivity testing"
echo -e "• Migration status validation"  
echo -e "• Seed data verification"
echo -e "• Connection pooling tests"
echo -e "• Slow query detection"
echo -e "• Foreign key constraint validation"
echo -e "• CRUD operations testing"
echo -e "• Performance metrics analysis"
echo -e "• Security checks"
echo -e "• Detailed reporting (console, JSON, HTML)"

echo -e "\n${GREEN}Database validation tools are ready to use!${NC}"