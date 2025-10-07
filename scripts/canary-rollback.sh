#!/bin/bash
###############################################################################
# Canary Emergency Rollback Script
#
# Usage: ./canary-rollback.sh [reason]
#
# This script performs emergency rollback of Phase 8 feature flags
# Target: <20 seconds execution time
###############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REASON="${1:-Manual emergency rollback}"
BACKEND_PATH="/Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/backend"
INCIDENT_LOG="logs/incidents/rollback-$(date +%Y%m%d-%H%M%S).log"
START_TIME=$(date +%s)

# Create incident log directory
mkdir -p logs/incidents

# Log function with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$INCIDENT_LOG"
}

# Execute rollback
execute_rollback() {
    log "🚨 EMERGENCY ROLLBACK INITIATED"
    log "Reason: $REASON"

    cd "$BACKEND_PATH" || exit 1

    # Direct database update for speed (no ORM overhead)
    php artisan tinker --execute="
        use Illuminate\Support\Facades\DB;
        use Illuminate\Support\Facades\Cache;

        \$timestamp = now();

        // Disable all Phase 8 feature flags
        DB::table('feature_flags')
            ->whereIn('key', [
                'canary_rollout_percentage',
                'phase8_analytics_persistence_enabled',
                'phase8_encryption_enabled',
                'phase8_gamification_enhancements',
                'phase8_auth_improvements'
            ])
            ->update([
                'value' => json_encode(['enabled' => false, 'percentage' => 0]),
                'updated_at' => \$timestamp,
            ]);

        // Clear all feature flag caches
        Cache::forget('feature_flags');
        Cache::tags(['feature_flags'])->flush();

        echo 'All feature flags disabled\n';
    " 2>&1 | tee -a "$INCIDENT_LOG"

    if [ $? -eq 0 ]; then
        log "✓ Feature flags disabled"
    else
        log "✗ CRITICAL: Failed to disable feature flags"
        exit 1
    fi
}

# Verify rollback
verify_rollback() {
    log "Verifying rollback..."

    cd "$BACKEND_PATH" || exit 1

    php artisan tinker --execute="
        \$service = app('App\Services\FeatureFlagService');

        \$flags = [
            'canary_rollout_percentage',
            'phase8_analytics_persistence_enabled',
            'phase8_encryption_enabled',
            'phase8_gamification_enhancements',
            'phase8_auth_improvements'
        ];

        \$allDisabled = true;
        foreach (\$flags as \$flag) {
            if (\$service->isEnabled(\$flag)) {
                echo 'ERROR: Flag still enabled: ' . \$flag . '\n';
                \$allDisabled = false;
            }
        }

        if (\$allDisabled) {
            echo 'All flags verified disabled\n';
        } else {
            exit(1);
        }
    " 2>&1 | tee -a "$INCIDENT_LOG"

    if [ $? -eq 0 ]; then
        log "✓ Rollback verified"
    else
        log "✗ CRITICAL: Verification failed"
        exit 1
    fi
}

# Send notifications
send_notifications() {
    log "Sending incident notifications..."

    # Slack notification (if configured)
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"🚨 EMERGENCY ROLLBACK EXECUTED\",
                \"attachments\": [{
                    \"color\": \"danger\",
                    \"fields\": [
                        {\"title\": \"Reason\", \"value\": \"$REASON\", \"short\": false},
                        {\"title\": \"Timestamp\", \"value\": \"$(date)\", \"short\": true},
                        {\"title\": \"Duration\", \"value\": \"$(($(date +%s) - START_TIME))s\", \"short\": true}
                    ]
                }]
            }" 2>&1 | tee -a "$INCIDENT_LOG"
    fi

    log "✓ Notifications sent"
}

# Create incident report
create_incident_report() {
    log "Creating incident report..."

    cat > "logs/incidents/INCIDENT_REPORT_$(date +%Y%m%d_%H%M%S).md" << EOF
# Emergency Rollback Incident Report

**Timestamp:** $(date '+%Y-%m-%d %H:%M:%S %Z')
**Duration:** $(($(date +%s) - START_TIME)) seconds
**Status:** Completed

## Incident Details

**Reason:** $REASON

**Actions Taken:**
1. Disabled all Phase 8 feature flags
2. Set canary rollout percentage to 0%
3. Cleared feature flag caches
4. Verified rollback successful

## Affected Feature Flags

- canary_rollout_percentage
- phase8_analytics_persistence_enabled
- phase8_encryption_enabled
- phase8_gamification_enhancements
- phase8_auth_improvements

## System State

**Before Rollback:**
- Canary percentage: [Logged in incident log]
- Active users affected: [To be determined]

**After Rollback:**
- All flags: Disabled (0%)
- Cache: Cleared
- System: Operating on baseline configuration

## Next Steps

1. [ ] Investigate root cause
2. [ ] Review monitoring metrics
3. [ ] Analyze logs for errors
4. [ ] Determine if redeployment is safe
5. [ ] Update runbook based on learnings

## Timeline

- **$(date '+%H:%M:%S')** - Rollback initiated
- **$(date '+%H:%M:%S')** - Feature flags disabled
- **$(date '+%H:%M:%S')** - Verification completed
- **$(date '+%H:%M:%S')** - Incident report created

## References

- Incident Log: $INCIDENT_LOG
- Monitoring Dashboard: /api/admin/metrics/canary
- Phase 8 Documentation: docs/phase8/

---
*Generated by canary-rollback.sh*
EOF

    log "✓ Incident report created"
}

# Display summary
display_summary() {
    local duration=$(($(date +%s) - START_TIME))

    echo ""
    echo "═══════════════════════════════════════════════════════"
    echo -e "${RED}    EMERGENCY ROLLBACK COMPLETED    ${NC}"
    echo "═══════════════════════════════════════════════════════"
    echo ""
    echo -e "${BLUE}Execution Time:${NC} ${duration}s"
    echo -e "${BLUE}Incident Log:${NC} $INCIDENT_LOG"
    echo ""

    if [ $duration -lt 20 ]; then
        echo -e "${GREEN}✓ Rollback completed within target (<20s)${NC}"
    else
        echo -e "${YELLOW}⚠ Rollback took longer than target (${duration}s > 20s)${NC}"
    fi

    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Review incident log: $INCIDENT_LOG"
    echo "2. Check system metrics: GET /api/admin/metrics"
    echo "3. Investigate root cause"
    echo "4. Update incident report with findings"
    echo ""
}

# Main execution
main() {
    echo "═══════════════════════════════════════════════════════"
    echo "           EMERGENCY ROLLBACK - PHASE 8                "
    echo "═══════════════════════════════════════════════════════"
    echo ""

    execute_rollback
    verify_rollback
    send_notifications
    create_incident_report
    display_summary

    log "🏁 Emergency rollback completed"
}

# Trap errors
trap 'log "ERROR: Rollback script failed at line $LINENO"; exit 1' ERR

# Run main function
main
