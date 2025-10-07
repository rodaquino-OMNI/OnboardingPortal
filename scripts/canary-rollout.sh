#!/bin/bash
###############################################################################
# Canary Rollout Script
#
# Usage: ./canary-rollout.sh <stage>
# Stages: 5, 25, 50, 100
#
# This script manages progressive feature flag rollout for Phase 8 enhancements
###############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STAGE=${1:-}
FLAG_NAME="phase8_analytics_persistence_enabled"
BACKEND_PATH="/Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/backend"
LOG_FILE="logs/canary-rollout-$(date +%Y%m%d-%H%M%S).log"

# Validate stage input
validate_stage() {
    case $STAGE in
        5|25|50|100)
            echo -e "${GREEN}✓ Valid stage: ${STAGE}%${NC}"
            ;;
        *)
            echo -e "${RED}✗ Invalid stage. Must be one of: 5, 25, 50, 100${NC}"
            echo "Usage: $0 <stage>"
            exit 1
            ;;
    esac
}

# Get current feature flag status
get_current_status() {
    echo -e "${BLUE}📊 Checking current feature flag status...${NC}"
    cd "$BACKEND_PATH" || exit 1

    php artisan tinker --execute="
        \$service = app('App\Services\FeatureFlagService');
        echo 'Current percentage: ' . \$service->getFlag('canary_rollout_percentage', 0) . '%\n';
        echo 'Analytics persistence: ' . (\$service->isEnabled('$FLAG_NAME') ? 'enabled' : 'disabled') . '\n';
    " 2>&1 | tee -a "$LOG_FILE"
}

# Pre-rollout health check
pre_rollout_check() {
    echo -e "${BLUE}🔍 Running pre-rollout health checks...${NC}"

    # Check database connection
    if ! php artisan db:show > /dev/null 2>&1; then
        echo -e "${RED}✗ Database connection failed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Database connection OK${NC}"

    # Check cache
    if ! php artisan cache:has feature_flags > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠ Cache miss, will be populated${NC}"
    else
        echo -e "${GREEN}✓ Cache OK${NC}"
    fi

    # Check monitoring endpoints
    if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health | grep -q "200"; then
        echo -e "${RED}✗ Health endpoint not responding${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Health endpoint OK${NC}"
}

# Update feature flag percentage
update_flag() {
    echo -e "${BLUE}🚀 Updating canary rollout to ${STAGE}%...${NC}"

    cd "$BACKEND_PATH" || exit 1

    php artisan tinker --execute="
        use Illuminate\Support\Facades\DB;

        // Update canary percentage
        DB::table('feature_flags')->updateOrInsert(
            ['key' => 'canary_rollout_percentage'],
            [
                'key' => 'canary_rollout_percentage',
                'value' => json_encode(['enabled' => true, 'percentage' => $STAGE]),
                'updated_at' => now(),
            ]
        );

        // Update analytics persistence flag
        DB::table('feature_flags')->updateOrInsert(
            ['key' => '$FLAG_NAME'],
            [
                'key' => '$FLAG_NAME',
                'value' => json_encode(['enabled' => true, 'percentage' => $STAGE]),
                'updated_at' => now(),
            ]
        );

        // Clear cache
        \Illuminate\Support\Facades\Cache::forget('feature_flags');

        echo 'Updated canary rollout to ${STAGE}%\n';
    " 2>&1 | tee -a "$LOG_FILE"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Feature flag updated successfully${NC}"
    else
        echo -e "${RED}✗ Failed to update feature flag${NC}"
        exit 1
    fi
}

# Post-rollout verification
post_rollout_check() {
    echo -e "${BLUE}✅ Verifying rollout...${NC}"

    sleep 2

    cd "$BACKEND_PATH" || exit 1

    php artisan tinker --execute="
        \$service = app('App\Services\FeatureFlagService');
        \$percentage = \$service->getFlag('canary_rollout_percentage', 0);

        if (\$percentage != $STAGE) {
            echo 'ERROR: Verification failed! Expected ${STAGE}%, got ' . \$percentage . '%\n';
            exit(1);
        }

        echo 'Verification passed: ${STAGE}%\n';
    " 2>&1 | tee -a "$LOG_FILE"
}

# Display monitoring instructions
show_monitoring_instructions() {
    echo ""
    echo -e "${YELLOW}📊 MONITORING INSTRUCTIONS FOR STAGE ${STAGE}%${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    case $STAGE in
        5)
            echo "Duration: 2-4 hours"
            echo "SLOs:"
            echo "  • p95 latency: <500ms"
            echo "  • Error rate: <1%"
            echo "  • Analytics ingestion: ≥99.5%"
            echo "  • PII detector: 0 violations"
            ;;
        25)
            echo "Duration: 2 hours"
            echo "SLOs:"
            echo "  • p95 latency: <500ms"
            echo "  • Error rate: <1%"
            echo "  • Analytics ingestion: ≥99.5%"
            ;;
        50)
            echo "Duration: 4 hours"
            echo "SLOs:"
            echo "  • p95 latency: <450ms"
            echo "  • Error rate: <0.8%"
            echo "  • Analytics ingestion: ≥99.7%"
            ;;
        100)
            echo "Duration: 24 hours"
            echo "SLOs:"
            echo "  • p95 latency: <400ms"
            echo "  • Error rate: <0.5%"
            echo "  • Analytics ingestion: ≥99.9%"
            ;;
    esac

    echo ""
    echo "Monitor via:"
    echo "  • GET /api/admin/metrics/canary"
    echo "  • GET /api/admin/analytics/performance"
    echo "  • Prometheus: http://localhost:9090"
    echo ""
    echo "Auto-rollback: 3 consecutive SLO breaches"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Confirmation prompt
confirm_rollout() {
    echo ""
    echo -e "${YELLOW}⚠️  CONFIRMATION REQUIRED${NC}"
    echo "You are about to update the canary rollout to ${STAGE}%"
    echo -n "Proceed? (yes/no): "
    read -r confirmation

    if [[ ! "$confirmation" =~ ^[Yy][Ee][Ss]$ ]]; then
        echo -e "${RED}Rollout cancelled${NC}"
        exit 0
    fi
}

# Main execution
main() {
    echo "═══════════════════════════════════════════════════════"
    echo "        CANARY ROLLOUT - PHASE 8 ENHANCEMENTS         "
    echo "═══════════════════════════════════════════════════════"
    echo ""

    validate_stage
    get_current_status
    confirm_rollout
    pre_rollout_check
    update_flag
    post_rollout_check
    show_monitoring_instructions

    echo ""
    echo -e "${GREEN}✓ Canary rollout to ${STAGE}% completed successfully${NC}"
    echo -e "${BLUE}📝 Log file: $LOG_FILE${NC}"
    echo ""
}

# Create logs directory
mkdir -p logs

# Run main function
main
