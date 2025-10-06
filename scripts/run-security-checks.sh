#!/bin/bash
# Security Validation Script
# Phase 4 - Security Gates

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REPORTS_DIR="$PROJECT_ROOT/reports/security"

mkdir -p "$REPORTS_DIR"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Security Gates Validation${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

SECURITY_REPORT="$REPORTS_DIR/security-report.json"
SECURITY_PASSED=true

# Initialize JSON report
cat > "$SECURITY_REPORT" <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "checks": {}
}
EOF

update_security_check() {
    local check_name=$1
    local status=$2
    local severity=$3
    local findings=$4
    local details=$5

    if [ "$status" = "FAIL" ] && [ "$severity" = "CRITICAL" ]; then
        SECURITY_PASSED=false
    fi

    echo -e "${status:+$([[ $status == 'PASS' ]] && echo $GREEN || echo $RED)}$status $check_name${NC} - $findings findings"
    if [ -n "$details" ]; then
        echo -e "${YELLOW}  $details${NC}"
    fi

    jq --arg check "$check_name" \
       --arg status "$status" \
       --arg severity "$severity" \
       --arg findings "$findings" \
       --arg details "$details" \
       '.checks[$check] = {status: $status, severity: $severity, findings: $findings, details: $details}' \
       "$SECURITY_REPORT" > "$SECURITY_REPORT.tmp" && mv "$SECURITY_REPORT.tmp" "$SECURITY_REPORT"
}

# ==========================
# GATE 9: SAST Scanning
# ==========================

echo -e "${GREEN}SAST Scanning${NC}"
echo "-----------------------------------"

cd "$PROJECT_ROOT"

# Semgrep scan
echo "Running Semgrep SAST..."
if command -v semgrep &> /dev/null; then
    semgrep --config=auto \
        --json \
        --output "$REPORTS_DIR/semgrep-results.json" \
        --exclude="**/node_modules/**" \
        --exclude="**/vendor/**" \
        --exclude="**/tests/**" \
        omni-portal/ || true

    CRITICAL_FINDINGS=$(jq '[.results[] | select(.extra.severity == "ERROR")] | length' "$REPORTS_DIR/semgrep-results.json" 2>/dev/null || echo "0")
    HIGH_FINDINGS=$(jq '[.results[] | select(.extra.severity == "WARNING")] | length' "$REPORTS_DIR/semgrep-results.json" 2>/dev/null || echo "0")

    if [ "$CRITICAL_FINDINGS" = "0" ]; then
        update_security_check "Semgrep SAST" "PASS" "INFO" "0 critical" "$HIGH_FINDINGS high severity warnings"
    else
        update_security_check "Semgrep SAST" "FAIL" "CRITICAL" "$CRITICAL_FINDINGS critical" "Security vulnerabilities detected"
    fi
else
    update_security_check "Semgrep SAST" "SKIP" "INFO" "N/A" "Semgrep not installed"
fi

# SonarQube scan (if configured)
echo "Checking SonarQube configuration..."
if [ -f "sonar-project.properties" ]; then
    echo "SonarQube scan requires server setup - skipping in local mode"
    update_security_check "SonarQube SAST" "SKIP" "INFO" "N/A" "Requires CI environment"
else
    update_security_check "SonarQube SAST" "SKIP" "INFO" "N/A" "Not configured"
fi

# ==========================
# GATE 10: Dependency Scan
# ==========================

echo ""
echo -e "${GREEN}Dependency Vulnerability Scan${NC}"
echo "-----------------------------------"

# Backend dependencies (Composer)
echo "Scanning PHP dependencies..."
cd "$PROJECT_ROOT/omni-portal/backend"
if [ -f "composer.lock" ]; then
    composer audit --format=json > "$REPORTS_DIR/composer-audit.json" 2>&1 || true

    CRITICAL_VULNS=$(jq '[.advisories[] | select(.severity == "critical")] | length' "$REPORTS_DIR/composer-audit.json" 2>/dev/null || echo "0")
    HIGH_VULNS=$(jq '[.advisories[] | select(.severity == "high")] | length' "$REPORTS_DIR/composer-audit.json" 2>/dev/null || echo "0")

    if [ "$CRITICAL_VULNS" = "0" ]; then
        update_security_check "PHP Dependencies" "PASS" "INFO" "0 critical" "$HIGH_VULNS high severity vulnerabilities"
    else
        update_security_check "PHP Dependencies" "FAIL" "CRITICAL" "$CRITICAL_VULNS critical" "Critical vulnerabilities in dependencies"
    fi
else
    update_security_check "PHP Dependencies" "SKIP" "INFO" "N/A" "composer.lock not found"
fi

# Frontend dependencies (npm)
echo "Scanning npm dependencies..."
cd "$PROJECT_ROOT/omni-portal/frontend"
if [ -f "package-lock.json" ]; then
    npm audit --json > "$REPORTS_DIR/npm-audit.json" 2>&1 || true

    CRITICAL_NPM=$(jq '.metadata.vulnerabilities.critical // 0' "$REPORTS_DIR/npm-audit.json" || echo "0")
    HIGH_NPM=$(jq '.metadata.vulnerabilities.high // 0' "$REPORTS_DIR/npm-audit.json" || echo "0")

    if [ "$CRITICAL_NPM" = "0" ]; then
        update_security_check "NPM Dependencies" "PASS" "INFO" "0 critical" "$HIGH_NPM high severity vulnerabilities"
    else
        update_security_check "NPM Dependencies" "FAIL" "CRITICAL" "$CRITICAL_NPM critical" "Critical vulnerabilities in dependencies"
    fi
else
    update_security_check "NPM Dependencies" "SKIP" "INFO" "N/A" "package-lock.json not found"
fi

# ==========================
# GATE 11: localStorage Usage
# ==========================

echo ""
echo -e "${GREEN}localStorage Security Check${NC}"
echo "-----------------------------------"

cd "$PROJECT_ROOT"

echo "Scanning for localStorage in sensitive modules..."
LOCALSTORAGE_FILES=$(grep -r "localStorage\." \
    --include="*.ts" \
    --include="*.tsx" \
    --include="*.js" \
    --include="*.jsx" \
    omni-portal/frontend/src/auth/ \
    omni-portal/frontend/src/health/ \
    2>/dev/null || echo "")

if [ -z "$LOCALSTORAGE_FILES" ]; then
    update_security_check "localStorage Usage" "PASS" "INFO" "0" "No localStorage in auth/health modules"
else
    FILE_COUNT=$(echo "$LOCALSTORAGE_FILES" | wc -l)
    update_security_check "localStorage Usage" "FAIL" "CRITICAL" "$FILE_COUNT" "localStorage found in sensitive modules"
    echo "$LOCALSTORAGE_FILES" > "$REPORTS_DIR/localstorage-violations.txt"
fi

# ==========================
# GATE 12: Archive Imports
# ==========================

echo ""
echo -e "${GREEN}Archive Import Check${NC}"
echo "-----------------------------------"

echo "Scanning for archive/** imports..."
ARCHIVE_IMPORTS=$(grep -r "from.*archive/" \
    --include="*.ts" \
    --include="*.tsx" \
    --include="*.js" \
    --include="*.jsx" \
    --include="*.php" \
    omni-portal/ \
    2>/dev/null || echo "")

if [ -z "$ARCHIVE_IMPORTS" ]; then
    update_security_check "Archive Imports" "PASS" "INFO" "0" "No imports from archive/**"
else
    FILE_COUNT=$(echo "$ARCHIVE_IMPORTS" | wc -l)
    update_security_check "Archive Imports" "FAIL" "CRITICAL" "$FILE_COUNT" "Legacy archive imports detected"
    echo "$ARCHIVE_IMPORTS" > "$REPORTS_DIR/archive-import-violations.txt"
fi

# ==========================
# Additional Security Checks
# ==========================

echo ""
echo -e "${GREEN}Additional Security Checks${NC}"
echo "-----------------------------------"

# Check for hardcoded secrets
echo "Scanning for potential secrets..."
SECRET_PATTERNS=(
    "password.*=.*['\"][^'\"]{8,}['\"]"
    "api[_-]?key.*=.*['\"][^'\"]{16,}['\"]"
    "secret.*=.*['\"][^'\"]{16,}['\"]"
    "token.*=.*['\"][^'\"]{20,}['\"]"
)

SECRET_FINDINGS=0
for pattern in "${SECRET_PATTERNS[@]}"; do
    MATCHES=$(grep -rE "$pattern" \
        --include="*.ts" \
        --include="*.tsx" \
        --include="*.js" \
        --include="*.jsx" \
        --include="*.php" \
        --exclude-dir="node_modules" \
        --exclude-dir="vendor" \
        --exclude-dir="tests" \
        omni-portal/ 2>/dev/null | wc -l || echo "0")
    SECRET_FINDINGS=$((SECRET_FINDINGS + MATCHES))
done

if [ "$SECRET_FINDINGS" = "0" ]; then
    update_security_check "Hardcoded Secrets" "PASS" "INFO" "0" "No potential secrets found"
else
    update_security_check "Hardcoded Secrets" "FAIL" "HIGH" "$SECRET_FINDINGS" "Potential hardcoded secrets detected"
fi

# Check for SQL injection patterns
echo "Scanning for SQL injection patterns..."
SQL_PATTERNS=$(grep -rE '\$_(GET|POST|REQUEST).*\$.*query' \
    --include="*.php" \
    --exclude-dir="vendor" \
    --exclude-dir="tests" \
    omni-portal/backend/ 2>/dev/null | wc -l || echo "0")

if [ "$SQL_PATTERNS" = "0" ]; then
    update_security_check "SQL Injection Patterns" "PASS" "INFO" "0" "No suspicious SQL patterns"
else
    update_security_check "SQL Injection Patterns" "FAIL" "HIGH" "$SQL_PATTERNS" "Potential SQL injection vulnerabilities"
fi

# Check for XSS vulnerabilities
echo "Scanning for XSS patterns..."
XSS_PATTERNS=$(grep -rE 'innerHTML.*\$|dangerouslySetInnerHTML' \
    --include="*.ts" \
    --include="*.tsx" \
    --include="*.js" \
    --include="*.jsx" \
    --exclude-dir="node_modules" \
    omni-portal/frontend/ 2>/dev/null | wc -l || echo "0")

if [ "$XSS_PATTERNS" = "0" ]; then
    update_security_check "XSS Patterns" "PASS" "INFO" "0" "No suspicious XSS patterns"
else
    update_security_check "XSS Patterns" "FAIL" "MEDIUM" "$XSS_PATTERNS" "Potential XSS vulnerabilities"
fi

# ==========================
# GENERATE FINAL REPORT
# ==========================

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Security Gates Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

TOTAL_CHECKS=$(jq '.checks | length' "$SECURITY_REPORT")
PASSED_CHECKS=$(jq '[.checks[] | select(.status == "PASS")] | length' "$SECURITY_REPORT")
FAILED_CHECKS=$(jq '[.checks[] | select(.status == "FAIL")] | length' "$SECURITY_REPORT")

echo "Total Checks: $TOTAL_CHECKS"
echo -e "${GREEN}Passed: $PASSED_CHECKS${NC}"
echo -e "${RED}Failed: $FAILED_CHECKS${NC}"
echo ""

# Update summary
jq --argjson total "$TOTAL_CHECKS" \
   --argjson passed "$PASSED_CHECKS" \
   --argjson failed "$FAILED_CHECKS" \
   '.summary = {total: $total, passed: $passed, failed: $failed}' \
   "$SECURITY_REPORT" > "$SECURITY_REPORT.tmp" && mv "$SECURITY_REPORT.tmp" "$SECURITY_REPORT"

echo "Full report: $SECURITY_REPORT"
echo ""

if [ "$SECURITY_PASSED" = false ]; then
    echo -e "${RED}CRITICAL security issues found. Pipeline must stop.${NC}"
    exit 1
else
    echo -e "${GREEN}All critical security gates passed. ✓${NC}"
    exit 0
fi
