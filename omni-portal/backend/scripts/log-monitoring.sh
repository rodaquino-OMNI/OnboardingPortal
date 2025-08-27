#!/bin/bash

# Laravel Log Monitoring and Health Check Script
# Provides real-time monitoring and performance metrics for log rotation

set -euo pipefail

# Configuration
LOG_DIR="${1:-/Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/backend/storage/logs}"
MONITORING_LOG="$LOG_DIR/monitoring.log"
ALERT_THRESHOLD_MB=50
DISK_USAGE_THRESHOLD=85

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to log with timestamp
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$MONITORING_LOG"
}

# Function to get file size in MB
get_file_size_mb() {
    local file="$1"
    if [[ -f "$file" ]]; then
        local size_bytes=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")
        echo $((size_bytes / 1024 / 1024))
    else
        echo "0"
    fi
}

# Function to check disk usage
check_disk_usage() {
    local usage=$(df "$LOG_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
    echo "$usage"
}

# Function to get directory size
get_directory_size() {
    local dir="$1"
    du -sm "$dir" 2>/dev/null | cut -f1 || echo "0"
}

# Function to count log files
count_log_files() {
    local pattern="$1"
    find "$LOG_DIR" -name "$pattern" -type f 2>/dev/null | wc -l || echo "0"
}

# Function to display header
display_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}    Laravel Log Monitoring Report${NC}"
    echo -e "${BLUE}    $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${BLUE}================================================${NC}"
}

# Function to display log file status
display_log_status() {
    echo -e "\n${YELLOW}📊 Log File Status:${NC}"
    echo "----------------------------------------"
    
    local files=("laravel.log" "worker.log" "scheduler.log" "horizon.log" "php-fpm.stdout.log" "php-fpm.stderr.log")
    
    for file in "${files[@]}"; do
        local filepath="$LOG_DIR/$file"
        if [[ -f "$filepath" ]]; then
            local size_mb=$(get_file_size_mb "$filepath")
            local status_color=""
            local status_icon=""
            
            if [[ $size_mb -gt $ALERT_THRESHOLD_MB ]]; then
                status_color="$RED"
                status_icon="🔴"
            elif [[ $size_mb -gt 10 ]]; then
                status_color="$YELLOW"
                status_icon="🟡"
            else
                status_color="$GREEN"
                status_icon="🟢"
            fi
            
            printf "%-25s %s %3dMB %s\n" "$file" "$status_icon" "$size_mb" "${status_color}${NC}"
        else
            printf "%-25s ❌ Missing\n" "$file"
        fi
    done
}

# Function to display rotation statistics
display_rotation_stats() {
    echo -e "\n${YELLOW}🔄 Rotation Statistics:${NC}"
    echo "----------------------------------------"
    
    local rotated_count=$(count_log_files "*.log.*")
    local compressed_count=$(count_log_files "*.log.gz")
    local backup_count=$(count_log_files "*-backup-*.log")
    
    echo "Rotated files:      $rotated_count"
    echo "Compressed files:   $compressed_count"
    echo "Backup files:       $backup_count"
    echo "Total log files:    $(($(count_log_files "*.log") + rotated_count))"
}

# Function to display disk usage
display_disk_usage() {
    echo -e "\n${YELLOW}💾 Disk Usage:${NC}"
    echo "----------------------------------------"
    
    local log_dir_size=$(get_directory_size "$LOG_DIR")
    local disk_usage=$(check_disk_usage)
    local disk_status_color=""
    local disk_icon=""
    
    if [[ $disk_usage -gt $DISK_USAGE_THRESHOLD ]]; then
        disk_status_color="$RED"
        disk_icon="🔴"
    elif [[ $disk_usage -gt 70 ]]; then
        disk_status_color="$YELLOW"
        disk_icon="🟡"
    else
        disk_status_color="$GREEN"
        disk_icon="🟢"
    fi
    
    echo "Log directory size: ${log_dir_size}MB"
    echo "Disk usage:         ${disk_status_color}${disk_usage}%${NC} $disk_icon"
}

# Function to display rotation health
display_rotation_health() {
    echo -e "\n${YELLOW}🏥 Rotation Health Check:${NC}"
    echo "----------------------------------------"
    
    local issues=0
    
    # Check if log rotation script is running
    if pgrep -f "log-rotation.sh" > /dev/null; then
        echo "✅ Log rotation service: Running"
    else
        echo "❌ Log rotation service: Not running"
        ((issues++))
    fi
    
    # Check logrotate configuration
    if [[ -f "/etc/logrotate.d/laravel" ]]; then
        echo "✅ Logrotate config: Present"
    else
        echo "❌ Logrotate config: Missing"
        ((issues++))
    fi
    
    # Check supervisor log rotation
    if supervisorctl status log-rotator 2>/dev/null | grep -q "RUNNING"; then
        echo "✅ Supervisor rotator: Running"
    else
        echo "❌ Supervisor rotator: Not running"
        ((issues++))
    fi
    
    # Overall health status
    if [[ $issues -eq 0 ]]; then
        echo -e "\n${GREEN}🎉 Overall Status: HEALTHY${NC}"
    else
        echo -e "\n${RED}⚠️  Overall Status: ISSUES DETECTED ($issues)${NC}"
    fi
}

# Function to display performance recommendations
display_recommendations() {
    echo -e "\n${YELLOW}💡 Performance Recommendations:${NC}"
    echo "----------------------------------------"
    
    local laravel_log_size=$(get_file_size_mb "$LOG_DIR/laravel.log")
    local total_size=$(get_directory_size "$LOG_DIR")
    
    if [[ $laravel_log_size -gt 20 ]]; then
        echo "🔸 Laravel log is ${laravel_log_size}MB - consider immediate rotation"
    fi
    
    if [[ $total_size -gt 100 ]]; then
        echo "🔸 Log directory is ${total_size}MB - cleanup recommended"
    fi
    
    local old_files=$(find "$LOG_DIR" -name "*.log.*" -mtime +7 2>/dev/null | wc -l)
    if [[ $old_files -gt 0 ]]; then
        echo "🔸 Found $old_files old log files - cleanup needed"
    fi
    
    if [[ $(check_disk_usage) -gt $DISK_USAGE_THRESHOLD ]]; then
        echo "🔸 High disk usage detected - immediate cleanup required"
    fi
}

# Main execution
main() {
    # Create monitoring log if it doesn't exist
    mkdir -p "$(dirname "$MONITORING_LOG")"
    touch "$MONITORING_LOG"
    
    # Log monitoring start
    log_message "INFO" "Log monitoring check started"
    
    # Display comprehensive report
    display_header
    display_log_status
    display_rotation_stats
    display_disk_usage
    display_rotation_health
    display_recommendations
    
    echo -e "\n${BLUE}================================================${NC}"
    echo -e "${BLUE}    Report saved to: $MONITORING_LOG${NC}"
    echo -e "${BLUE}================================================${NC}"
    
    # Log monitoring completion
    log_message "INFO" "Log monitoring check completed"
}

# Execute main function
main "$@"