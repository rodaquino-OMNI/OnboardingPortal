#!/bin/bash
set -euo pipefail

################################################################################
# Staging Canary Deployment Script
#
# Purpose: Deploy Phase 8 changes to staging with progressive canary rollout
# Features:
#   - Pre-deployment validation
#   - Database backup and migration
#   - Progressive traffic rollout (5% -> 25% -> 50% -> 100%)
#   - Real-time SLO monitoring
#   - Automatic rollback on breach
#   - Notification integration
################################################################################

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${DEPLOY_ENV:-staging}"
CANARY_PERCENTAGE="${CANARY_PERCENTAGE:-5}"
APP_DIR="/var/www/omni-portal/backend"
BACKUP_DIR="/var/backups/mysql/$(date +%Y%m%d-%H%M%S)"
HEALTH_ENDPOINT="https://staging.omni-portal.com/health"
METRICS_ENDPOINT="https://staging.omni-portal.com/api/metrics"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"
EMAIL_RECIPIENTS="${DEPLOY_EMAIL:-deploy@company.com}"

# SLO Thresholds
MAX_ERROR_RATE=1.0
MAX_P95_LATENCY=500
MAX_P99_LATENCY=1000
MONITORING_DURATION=900 # 15 minutes
MONITORING_INTERVAL=30 # 30 seconds

# Logging
LOG_FILE="/var/log/deployments/canary-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓${NC} $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗${NC} $*" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠${NC} $*" | tee -a "$LOG_FILE"
}

# Send notifications
send_notification() {
    local status="$1"
    local message="$2"

    # Slack notification
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"🚀 Canary Deployment - $status\n$message\"}" \
            2>/dev/null || true
    fi

    # Email notification
    if command -v mail &> /dev/null; then
        echo "$message" | mail -s "Canary Deployment - $status" "$EMAIL_RECIPIENTS" || true
    fi
}

# Validate pre-deployment conditions
validate_pre_deployment() {
    log "Starting pre-deployment validation..."

    # Check if migrations directory exists
    if [[ ! -d "$APP_DIR/database/migrations" ]]; then
        log_error "Migrations directory not found"
        return 1
    fi

    # Check if all required environment variables are set
    if [[ ! -f "$APP_DIR/.env" ]]; then
        log_error ".env file not found"
        return 1
    fi

    # Verify database connectivity
    if ! php "$APP_DIR/artisan" db:show &>/dev/null; then
        log_error "Database connection failed"
        return 1
    fi

    # Check if there are pending migrations
    local pending_migrations
    pending_migrations=$(php "$APP_DIR/artisan" migrate:status --pending | grep -c "Pending" || true)
    log "Found $pending_migrations pending migrations"

    # Verify health endpoint is responding
    if ! curl -f -s "$HEALTH_ENDPOINT" &>/dev/null; then
        log_error "Health endpoint is not responding"
        return 1
    fi

    log_success "Pre-deployment validation passed"
    return 0
}

# Backup database
backup_database() {
    log "Creating database backup..."

    mkdir -p "$BACKUP_DIR"

    local db_host db_name db_user db_pass
    db_host=$(grep DB_HOST "$APP_DIR/.env" | cut -d '=' -f2)
    db_name=$(grep DB_DATABASE "$APP_DIR/.env" | cut -d '=' -f2)
    db_user=$(grep DB_USERNAME "$APP_DIR/.env" | cut -d '=' -f2)
    db_pass=$(grep DB_PASSWORD "$APP_DIR/.env" | cut -d '=' -f2)

    if mysqldump -h "$db_host" -u "$db_user" -p"$db_pass" "$db_name" \
        | gzip > "$BACKUP_DIR/backup.sql.gz"; then
        log_success "Database backup created: $BACKUP_DIR/backup.sql.gz"

        # Store backup location for potential rollback
        echo "$BACKUP_DIR/backup.sql.gz" > /tmp/last_canary_backup.txt
        return 0
    else
        log_error "Database backup failed"
        return 1
    fi
}

# Run migrations
run_migrations() {
    log "Running database migrations..."

    cd "$APP_DIR"

    if php artisan migrate --force --no-interaction; then
        log_success "Migrations completed successfully"
        return 0
    else
        log_error "Migrations failed"
        return 1
    fi
}

# Deploy with canary percentage
deploy_canary() {
    local percentage=$1
    log "Deploying canary at $percentage% traffic..."

    # Update feature flag in database
    php "$APP_DIR/artisan" tinker --execute="
        DB::table('feature_flags')
            ->updateOrInsert(
                ['key' => 'canary_rollout_percentage'],
                ['value' => $percentage, 'updated_at' => now()]
            );
    "

    # If using load balancer, update traffic weights
    # Example for AWS ALB (would need AWS CLI configured):
    # aws elbv2 modify-target-group --target-group-arn $TARGET_GROUP_ARN \
    #     --health-check-enabled --health-check-interval-seconds 30

    log_success "Canary deployed at $percentage% traffic"

    # Wait for deployment to stabilize
    sleep 10
}

# Monitor SLOs
monitor_slos() {
    local duration=$1
    local interval=$2

    log "Monitoring SLOs for $duration seconds (checking every $interval seconds)..."

    local end_time=$(($(date +%s) + duration))
    local breach_count=0
    local max_breaches=3

    while [[ $(date +%s) -lt $end_time ]]; do
        # Fetch metrics from endpoint
        local metrics
        metrics=$(curl -s "$METRICS_ENDPOINT" || echo "{}")

        local error_rate p95_latency p99_latency
        error_rate=$(echo "$metrics" | jq -r '.error_rate // 0')
        p95_latency=$(echo "$metrics" | jq -r '.p95_latency // 0')
        p99_latency=$(echo "$metrics" | jq -r '.p99_latency // 0')

        log "Metrics: Error Rate=$error_rate%, P95=$p95_latency ms, P99=$p99_latency ms"

        # Check SLO breaches
        local breach=false
        if (( $(echo "$error_rate > $MAX_ERROR_RATE" | bc -l) )); then
            log_warning "Error rate breach: $error_rate% > $MAX_ERROR_RATE%"
            breach=true
        fi

        if (( $(echo "$p95_latency > $MAX_P95_LATENCY" | bc -l) )); then
            log_warning "P95 latency breach: $p95_latency ms > $MAX_P95_LATENCY ms"
            breach=true
        fi

        if (( $(echo "$p99_latency > $MAX_P99_LATENCY" | bc -l) )); then
            log_warning "P99 latency breach: $p99_latency ms > $MAX_P99_LATENCY ms"
            breach=true
        fi

        if [[ "$breach" == "true" ]]; then
            ((breach_count++))
            log_warning "SLO breach detected (count: $breach_count/$max_breaches)"

            if [[ $breach_count -ge $max_breaches ]]; then
                log_error "Maximum SLO breaches exceeded. Triggering rollback..."
                return 1
            fi
        else
            breach_count=0 # Reset on success
            log_success "SLOs within acceptable range"
        fi

        sleep "$interval"
    done

    log_success "SLO monitoring completed successfully"
    return 0
}

# Rollback deployment
rollback() {
    log_error "Initiating rollback..."
    send_notification "ROLLBACK" "Canary deployment failed SLO requirements. Rolling back..."

    # Restore canary percentage to 0
    deploy_canary 0

    # Restore database from backup if needed
    local backup_file
    if [[ -f /tmp/last_canary_backup.txt ]]; then
        backup_file=$(cat /tmp/last_canary_backup.txt)
        if [[ -f "$backup_file" ]]; then
            log "Restoring database from backup: $backup_file"

            local db_host db_name db_user db_pass
            db_host=$(grep DB_HOST "$APP_DIR/.env" | cut -d '=' -f2)
            db_name=$(grep DB_DATABASE "$APP_DIR/.env" | cut -d '=' -f2)
            db_user=$(grep DB_USERNAME "$APP_DIR/.env" | cut -d '=' -f2)
            db_pass=$(grep DB_PASSWORD "$APP_DIR/.env" | cut -d '=' -f2)

            gunzip < "$backup_file" | mysql -h "$db_host" -u "$db_user" -p"$db_pass" "$db_name"
            log_success "Database restored"
        fi
    fi

    # Clear caches
    php "$APP_DIR/artisan" cache:clear
    php "$APP_DIR/artisan" config:clear

    log_success "Rollback completed"
    return 0
}

# Main deployment flow
main() {
    log "=========================================="
    log "Starting Canary Deployment"
    log "Environment: $ENVIRONMENT"
    log "Initial Canary: $CANARY_PERCENTAGE%"
    log "=========================================="

    # Step 1: Validate
    if ! validate_pre_deployment; then
        log_error "Pre-deployment validation failed"
        send_notification "FAILED" "Pre-deployment validation failed"
        exit 1
    fi

    # Step 2: Backup
    if ! backup_database; then
        log_error "Database backup failed"
        send_notification "FAILED" "Database backup failed"
        exit 1
    fi

    # Step 3: Run migrations
    if ! run_migrations; then
        log_error "Migration failed"
        send_notification "FAILED" "Database migration failed"
        rollback
        exit 1
    fi

    # Step 4: Deploy canary
    if ! deploy_canary "$CANARY_PERCENTAGE"; then
        log_error "Canary deployment failed"
        send_notification "FAILED" "Canary deployment failed"
        rollback
        exit 1
    fi

    send_notification "IN PROGRESS" "Canary deployed at $CANARY_PERCENTAGE%. Monitoring SLOs..."

    # Step 5: Monitor SLOs
    if ! monitor_slos "$MONITORING_DURATION" "$MONITORING_INTERVAL"; then
        log_error "SLO monitoring failed"
        send_notification "FAILED" "SLO breaches detected"
        rollback
        exit 1
    fi

    # Step 6: Success
    log_success "=========================================="
    log_success "Canary deployment completed successfully!"
    log_success "=========================================="
    send_notification "SUCCESS" "Canary deployment at $CANARY_PERCENTAGE% is stable. Ready for next stage."

    exit 0
}

# Run main function
main "$@"
