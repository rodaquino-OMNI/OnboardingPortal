#!/bin/bash

#####################################################################
# Phase 8 Integration Deployment Script
#
# Purpose: Deploy database migrations, seeders, and verify integration
# Status: Ready for execution
# Requirements: PHP 8.2+, Composer, Laravel 11
#
# Usage:
#   ./scripts/deploy-phase8-integration.sh [environment]
#
# Environments:
#   - local (default)
#   - testing
#   - staging
#   - production
#
# What this script does:
#   1. Verifies environment
#   2. Runs database migrations
#   3. Seeds test data
#   4. Runs integration tests
#   5. Generates deployment report
#####################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
ENV="${1:-local}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="${BACKEND_DIR}/storage/logs/deploy-${TIMESTAMP}.log"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# Step counter
STEP=1
step() {
    echo ""
    log_info "Step ${STEP}/${TOTAL_STEPS}: $1"
    STEP=$((STEP + 1))
}

# Total steps
TOTAL_STEPS=8

# Header
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        Phase 8 Integration Deployment                         ║"
echo "║        Environment: ${ENV}                                      "
echo "║        Timestamp: ${TIMESTAMP}                                 "
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Verify environment
step "Verify environment"

cd "$BACKEND_DIR" || exit 1

if [ ! -f "composer.json" ]; then
    log_error "Not in Laravel project directory"
    exit 1
fi

log_success "Environment verified"

# Step 2: Check PHP version
step "Check PHP version"

PHP_VERSION=$(php -r 'echo PHP_VERSION;')
log_info "PHP version: $PHP_VERSION"

if ! php -v | grep -q "PHP 8\.[2-9]"; then
    log_error "PHP 8.2 or higher required"
    exit 1
fi

log_success "PHP version OK"

# Step 3: Check database connection
step "Check database connection"

if ! php artisan db:show > /dev/null 2>&1; then
    log_error "Database connection failed"
    log_info "Please check .env.${ENV} configuration"
    exit 1
fi

log_success "Database connection OK"

# Step 4: Run migrations
step "Run database migrations"

log_info "Running migrations..."

if [ "$ENV" = "local" ] || [ "$ENV" = "testing" ]; then
    # For local/testing: Fresh migrate
    log_warning "Running fresh migrations (destructive)"
    php artisan migrate:fresh --force
else
    # For staging/production: Safe migrate
    log_info "Running safe migrations"
    php artisan migrate --force
fi

log_success "Migrations completed"

# Step 5: Verify migrations
step "Verify migrations"

EXPECTED_TABLES=(
    "users"
    "questionnaires"
    "questionnaire_responses"
    "audit_logs"
    "feature_flags"
    "analytics_events"
)

log_info "Verifying required tables exist..."

for table in "${EXPECTED_TABLES[@]}"; do
    if php artisan tinker --execute="echo Schema::hasTable('$table') ? 'EXISTS' : 'MISSING';" | grep -q "EXISTS"; then
        log_success "Table '$table' exists"
    else
        log_error "Table '$table' missing"
        exit 1
    fi
done

log_success "All required tables verified"

# Step 6: Run seeders
step "Run seeders"

if [ "$ENV" = "local" ] || [ "$ENV" = "testing" ]; then
    log_info "Seeding database with test data..."
    php artisan db:seed --force
    log_success "Seeders completed"
else
    log_warning "Skipping seeders in $ENV (run manually if needed)"
fi

# Step 7: Verify seeded data
step "Verify seeded data"

log_info "Verifying seeded data..."

# Check feature flags
FEATURE_FLAG_COUNT=$(php artisan tinker --execute="echo App\Models\FeatureFlag::count();" | tail -1)
log_info "Feature flags: $FEATURE_FLAG_COUNT"

if [ "$FEATURE_FLAG_COUNT" -lt 3 ]; then
    log_error "Expected at least 3 feature flags, found $FEATURE_FLAG_COUNT"
    exit 1
fi

# Check questionnaires
QUESTIONNAIRE_COUNT=$(php artisan tinker --execute="echo App\Modules\Health\Models\Questionnaire::count();" | tail -1)
log_info "Questionnaires: $QUESTIONNAIRE_COUNT"

if [ "$QUESTIONNAIRE_COUNT" -lt 1 ]; then
    log_error "Expected at least 1 questionnaire, found $QUESTIONNAIRE_COUNT"
    exit 1
fi

# Check sliceC_health feature flag
SLICEC_ENABLED=$(php artisan tinker --execute="echo App\Models\FeatureFlag::where('key', 'sliceC_health')->value('enabled') ? 'true' : 'false';" | tail -1)
log_info "sliceC_health enabled: $SLICEC_ENABLED"

if [ "$SLICEC_ENABLED" != "true" ]; then
    log_error "sliceC_health feature flag not enabled"
    exit 1
fi

log_success "Seeded data verified"

# Step 8: Run integration tests
step "Run integration tests"

if [ "$ENV" = "local" ] || [ "$ENV" = "testing" ]; then
    log_info "Running health module integration tests..."

    if ./vendor/bin/phpunit --testsuite Health --testdox; then
        log_success "Integration tests passed"
    else
        log_error "Integration tests failed"
        exit 1
    fi
else
    log_warning "Skipping tests in $ENV"
fi

# Final summary
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                 DEPLOYMENT SUMMARY                             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
log_success "✅ Environment: $ENV"
log_success "✅ Migrations: Completed"
log_success "✅ Tables: Verified (${#EXPECTED_TABLES[@]}/${#EXPECTED_TABLES[@]})"
log_success "✅ Seeders: Completed"
log_success "✅ Feature flags: $FEATURE_FLAG_COUNT"
log_success "✅ Questionnaires: $QUESTIONNAIRE_COUNT"
log_success "✅ sliceC_health: Enabled"
if [ "$ENV" = "local" ] || [ "$ENV" = "testing" ]; then
    log_success "✅ Integration tests: Passed"
fi
echo ""
log_info "Log file: $LOG_FILE"
echo ""
log_success "🚀 Phase 8 integration deployment complete!"
echo ""
log_info "Next steps:"
log_info "1. Verify endpoints: GET /api/v1/health/schema"
log_info "2. Test authentication flow"
log_info "3. Monitor audit logs"
log_info "4. Review deployment log: $LOG_FILE"
echo ""
