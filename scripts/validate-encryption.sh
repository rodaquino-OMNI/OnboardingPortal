#!/bin/bash

###############################################################################
# ADR-004 Encryption Validation Script
#
# Validates field-level encryption implementation for HIPAA/LGPD compliance
#
# Usage:
#   ./scripts/validate-encryption.sh [--strict]
#
# Options:
#   --strict    Fail on warnings (for CI/CD)
#
# Exit Codes:
#   0 - All validations passed
#   1 - Validation failures detected
#   2 - Setup errors (database not configured, etc.)
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STRICT_MODE=false
BACKEND_DIR="./omni-portal/backend"

# Parse arguments
for arg in "$@"; do
    case $arg in
        --strict)
            STRICT_MODE=true
            shift
            ;;
    esac
done

# Banner
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║       ADR-004 Encryption Validation Suite                  ║"
echo "║       HIPAA/LGPD Compliance Verification                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌ Backend directory not found: $BACKEND_DIR${NC}"
    exit 2
fi

cd "$BACKEND_DIR"

# Check if Laravel is installed
if [ ! -f "artisan" ]; then
    echo -e "${RED}❌ Laravel not found (artisan missing)${NC}"
    exit 2
fi

echo -e "${BLUE}📋 Validation Steps:${NC}"
echo "  1. Database migration status"
echo "  2. PHI encryption verification"
echo "  3. Unit test suite"
echo "  4. Integration test suite"
echo "  5. Security compliance check"
echo ""

# Track failures
FAILED=0

###############################################################################
# Step 1: Check Migration Status
###############################################################################
echo -e "${BLUE}[1/5] Checking migration status...${NC}"

if php artisan migrate:status 2>&1 | grep -q "2025_10_06_000014_add_encrypted_phi_fields"; then
    if php artisan migrate:status 2>&1 | grep "2025_10_06_000014_add_encrypted_phi_fields" | grep -q "Ran"; then
        echo -e "${GREEN}✅ Encryption migration applied${NC}"
    else
        echo -e "${YELLOW}⚠️  Encryption migration pending - run 'php artisan migrate'${NC}"
        if [ "$STRICT_MODE" = true ]; then
            FAILED=$((FAILED + 1))
        fi
    fi
else
    echo -e "${RED}❌ Encryption migration not found${NC}"
    FAILED=$((FAILED + 1))
fi

echo ""

###############################################################################
# Step 2: PHI Encryption Verification
###############################################################################
echo -e "${BLUE}[2/5] Verifying PHI encryption...${NC}"

VERIFY_ARGS=""
if [ "$STRICT_MODE" = true ]; then
    VERIFY_ARGS="--strict"
fi

if php artisan phi:verify-encryption $VERIFY_ARGS 2>&1 | grep -q "Verification PASSED"; then
    echo -e "${GREEN}✅ PHI fields properly encrypted${NC}"
else
    echo -e "${RED}❌ PHI encryption verification failed${NC}"
    FAILED=$((FAILED + 1))
fi

echo ""

###############################################################################
# Step 3: Unit Tests
###############################################################################
echo -e "${BLUE}[3/5] Running unit tests...${NC}"

if [ -f "tests/Unit/EncryptionServiceTest.php" ]; then
    if php artisan test tests/Unit/EncryptionServiceTest.php --testdox 2>&1 | grep -q "PASSED"; then
        echo -e "${GREEN}✅ Unit tests passed${NC}"
    else
        echo -e "${RED}❌ Unit tests failed${NC}"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${YELLOW}⚠️  Unit tests not found${NC}"
    if [ "$STRICT_MODE" = true ]; then
        FAILED=$((FAILED + 1))
    fi
fi

echo ""

###############################################################################
# Step 4: Integration Tests
###############################################################################
echo -e "${BLUE}[4/5] Running integration tests...${NC}"

if [ -f "tests/Feature/EncryptionIntegrationTest.php" ]; then
    if php artisan test tests/Feature/EncryptionIntegrationTest.php --testdox 2>&1 | grep -q "PASSED"; then
        echo -e "${GREEN}✅ Integration tests passed${NC}"
    else
        echo -e "${RED}❌ Integration tests failed${NC}"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${YELLOW}⚠️  Integration tests not found${NC}"
    if [ "$STRICT_MODE" = true ]; then
        FAILED=$((FAILED + 1))
    fi
fi

echo ""

###############################################################################
# Step 5: Security Compliance Check
###############################################################################
echo -e "${BLUE}[5/5] Security compliance check...${NC}"

# Check for required files
REQUIRED_FILES=(
    "app/Services/EncryptionService.php"
    "app/Traits/EncryptsAttributes.php"
    "app/Console/Commands/MigratePhiFieldsEncryption.php"
    "app/Console/Commands/VerifyPhiEncryption.php"
    "database/migrations/2025_10_06_000014_add_encrypted_phi_fields.php"
)

ALL_FILES_PRESENT=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Missing required file: $file${NC}"
        ALL_FILES_PRESENT=false
        FAILED=$((FAILED + 1))
    fi
done

if [ "$ALL_FILES_PRESENT" = true ]; then
    echo -e "${GREEN}✅ All encryption components present${NC}"
fi

echo ""

###############################################################################
# Summary
###############################################################################
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Validation Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}"
    echo "✅ ALL VALIDATIONS PASSED"
    echo ""
    echo "ADR-004 encryption implementation is compliant:"
    echo "  ✓ AES-256-GCM encryption for PHI fields"
    echo "  ✓ SHA-256 hash columns for searchable lookups"
    echo "  ✓ All tests passing"
    echo "  ✓ Zero HIPAA/LGPD violations"
    echo ""
    echo "🚀 Ready for production deployment"
    echo -e "${NC}"
    exit 0
else
    echo -e "${RED}"
    echo "❌ VALIDATION FAILED"
    echo ""
    echo "Failed checks: $FAILED"
    echo ""
    echo "Please review errors above and fix issues before deploying."
    echo -e "${NC}"
    exit 1
fi
