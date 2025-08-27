#!/bin/bash

# Laravel Log Rotation Script
# Rotates Laravel logs with 10MB max size and 7-day retention
# Runs every 30 minutes via supervisor

set -euo pipefail

# Configuration
LARAVEL_LOG_DIR="/var/www/backend/storage/logs"
MAX_LOG_SIZE="10485760"  # 10MB in bytes
RETENTION_DAYS=7
ROTATION_INTERVAL=1800   # 30 minutes in seconds

# Function to rotate log if needed
rotate_log_if_needed() {
    local log_file="$1"
    local base_name=$(basename "$log_file" .log)
    
    if [[ -f "$log_file" ]]; then
        local file_size=$(stat -f%z "$log_file" 2>/dev/null || stat -c%s "$log_file" 2>/dev/null || echo "0")
        
        if [[ "$file_size" -gt "$MAX_LOG_SIZE" ]]; then
            echo "$(date '+%Y-%m-%d %H:%M:%S') - Rotating $log_file (size: ${file_size} bytes)"
            
            # Create timestamp for rotation
            local timestamp=$(date '+%Y%m%d_%H%M%S')
            local rotated_file="${LARAVEL_LOG_DIR}/${base_name}_${timestamp}.log"
            
            # Move current log to rotated version
            mv "$log_file" "$rotated_file"
            
            # Create new empty log file with correct permissions
            touch "$log_file"
            chmod 664 "$log_file"
            chown www-data:www-data "$log_file" 2>/dev/null || chown appuser:appuser "$log_file" 2>/dev/null || true
            
            # Compress rotated log to save space
            gzip "$rotated_file" &
            
            echo "$(date '+%Y-%m-%d %H:%M:%S') - Rotated $log_file to $rotated_file.gz"
        fi
    fi
}

# Function to clean old logs
clean_old_logs() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Cleaning logs older than $RETENTION_DAYS days"
    
    # Remove logs older than retention period
    find "$LARAVEL_LOG_DIR" -name "*.log.*" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$LARAVEL_LOG_DIR" -name "*.log.gz" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    
    # Clean up old backup files
    find "$LARAVEL_LOG_DIR" -name "laravel-backup-*.log" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
}

# Function to get disk usage statistics
get_disk_stats() {
    local logs_size=$(du -sh "$LARAVEL_LOG_DIR" 2>/dev/null | cut -f1 || echo "unknown")
    local disk_usage=$(df -h "$LARAVEL_LOG_DIR" | tail -1 | awk '{print $5}' || echo "unknown")
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Log directory size: $logs_size, Disk usage: $disk_usage"
}

# Main rotation loop
echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting Laravel log rotation service"
get_disk_stats

while true; do
    # Rotate Laravel application log
    rotate_log_if_needed "$LARAVEL_LOG_DIR/laravel.log"
    
    # Rotate other common Laravel logs
    rotate_log_if_needed "$LARAVEL_LOG_DIR/worker.log"
    rotate_log_if_needed "$LARAVEL_LOG_DIR/scheduler.log"
    rotate_log_if_needed "$LARAVEL_LOG_DIR/horizon.log"
    
    # Clean old logs every 4 hours (every 8th iteration)
    if [[ $(($(date +%s) / $ROTATION_INTERVAL % 8)) -eq 0 ]]; then
        clean_old_logs
        get_disk_stats
    fi
    
    # Wait for next rotation interval
    sleep $ROTATION_INTERVAL
done