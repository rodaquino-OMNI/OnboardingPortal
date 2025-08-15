#!/bin/bash

#################################################################
# Docker Cleanup Script for AUSTA Onboarding Portal
# This script cleans up Docker resources and legacy code
#################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
ENV_FILE="${PROJECT_ROOT}/.env.docker"
CLEANUP_LOG="${PROJECT_ROOT}/docker/logs/cleanup.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Counters
FILES_REMOVED=0
SPACE_FREED=0

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$CLEANUP_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$CLEANUP_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$CLEANUP_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$CLEANUP_LOG"
}

log_action() {
    echo -e "${MAGENTA}[CLEAN]${NC} $1" | tee -a "$CLEANUP_LOG"
}

confirm_action() {
    local message="$1"
    
    if [ "${FORCE_CLEANUP:-false}" = true ]; then
        return 0
    fi
    
    read -p "$message (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        return 0
    else
        return 1
    fi
}

cleanup_docker_resources() {
    log_action "Cleaning Docker resources..."
    
    # Stop all containers
    if docker-compose --env-file "$ENV_FILE" ps -q | wc -l | grep -q -v "^0$"; then
        log_info "Stopping running containers..."
        docker-compose --env-file "$ENV_FILE" down
    fi
    
    # Remove dangling images
    local dangling_images=$(docker images -f "dangling=true" -q | wc -l)
    if [ "$dangling_images" -gt 0 ]; then
        log_info "Removing $dangling_images dangling images..."
        docker rmi $(docker images -f "dangling=true" -q) 2>/dev/null || true
        log_success "Dangling images removed"
    fi
    
    # Remove unused volumes
    if confirm_action "Remove unused Docker volumes?"; then
        docker volume prune -f
        log_success "Unused volumes removed"
    fi
    
    # Remove unused networks
    docker network prune -f
    log_success "Unused networks removed"
    
    # Show Docker disk usage
    log_info "Docker disk usage after cleanup:"
    docker system df
}

cleanup_legacy_files() {
    log_action "Cleaning legacy files..."
    
    # List of legacy files/directories to remove
    local legacy_items=(
        "${PROJECT_ROOT}/Homestead.yaml"
        "${PROJECT_ROOT}/Homestead.json"
        "${PROJECT_ROOT}/Vagrantfile"
        "${PROJECT_ROOT}/.vagrant"
        "${PROJECT_ROOT}/omni-portal/backend/Homestead.yaml"
        "${PROJECT_ROOT}/omni-portal/backend/Homestead.json"
        "${PROJECT_ROOT}/omni-portal/backend/Vagrantfile"
        "${PROJECT_ROOT}/omni-portal/backend/.vagrant"
        "${PROJECT_ROOT}/omni-portal/backend/docker-compose.yml"
        "${PROJECT_ROOT}/omni-portal/frontend/docker-compose.yml"
    )
    
    for item in "${legacy_items[@]}"; do
        if [ -e "$item" ]; then
            if confirm_action "Remove legacy item: $item?"; then
                rm -rf "$item"
                ((FILES_REMOVED++))
                log_success "Removed: $item"
            fi
        fi
    done
    
    log_info "Removed $FILES_REMOVED legacy files/directories"
}

cleanup_laravel_cache() {
    log_action "Cleaning Laravel cache..."
    
    if [ -d "${PROJECT_ROOT}/omni-portal/backend" ]; then
        # Clear framework cache
        local cache_dirs=(
            "${PROJECT_ROOT}/omni-portal/backend/bootstrap/cache/*.php"
            "${PROJECT_ROOT}/omni-portal/backend/storage/framework/cache/data/*"
            "${PROJECT_ROOT}/omni-portal/backend/storage/framework/sessions/*"
            "${PROJECT_ROOT}/omni-portal/backend/storage/framework/views/*.php"
            "${PROJECT_ROOT}/omni-portal/backend/storage/logs/*.log"
        )
        
        for pattern in "${cache_dirs[@]}"; do
            if ls $pattern 1> /dev/null 2>&1; then
                rm -f $pattern
                log_success "Cleared: $(dirname $pattern)"
            fi
        done
        
        # Clear compiled files
        rm -f "${PROJECT_ROOT}/omni-portal/backend/storage/framework/compiled.php" 2>/dev/null || true
        rm -f "${PROJECT_ROOT}/omni-portal/backend/storage/framework/services.json" 2>/dev/null || true
        rm -f "${PROJECT_ROOT}/omni-portal/backend/storage/framework/events.scanned.php" 2>/dev/null || true
        rm -f "${PROJECT_ROOT}/omni-portal/backend/storage/framework/routes.scanned.php" 2>/dev/null || true
        rm -f "${PROJECT_ROOT}/omni-portal/backend/storage/framework/down" 2>/dev/null || true
    fi
}

cleanup_nextjs_cache() {
    log_action "Cleaning Next.js cache..."
    
    if [ -d "${PROJECT_ROOT}/omni-portal/frontend" ]; then
        # Clear Next.js build cache
        local cache_dirs=(
            "${PROJECT_ROOT}/omni-portal/frontend/.next"
            "${PROJECT_ROOT}/omni-portal/frontend/out"
            "${PROJECT_ROOT}/omni-portal/frontend/.vercel"
            "${PROJECT_ROOT}/omni-portal/frontend/.turbo"
        )
        
        for dir in "${cache_dirs[@]}"; do
            if [ -d "$dir" ]; then
                if confirm_action "Remove Next.js cache: $dir?"; then
                    rm -rf "$dir"
                    log_success "Removed: $dir"
                fi
            fi
        done
    fi
}

cleanup_node_modules() {
    if [ "${DEEP_CLEAN:-false}" = true ]; then
        log_action "Deep cleaning node_modules..."
        
        # Find all node_modules directories
        local node_dirs=$(find "${PROJECT_ROOT}" -type d -name "node_modules" 2>/dev/null)
        
        if [ -n "$node_dirs" ]; then
            echo "$node_dirs" | while read -r dir; do
                if confirm_action "Remove node_modules: $dir?"; then
                    rm -rf "$dir"
                    log_success "Removed: $dir"
                fi
            done
        fi
    fi
}

cleanup_vendor() {
    if [ "${DEEP_CLEAN:-false}" = true ]; then
        log_action "Deep cleaning vendor directories..."
        
        if [ -d "${PROJECT_ROOT}/omni-portal/backend/vendor" ]; then
            if confirm_action "Remove vendor directory (will need composer install)?"; then
                rm -rf "${PROJECT_ROOT}/omni-portal/backend/vendor"
                log_success "Removed vendor directory"
            fi
        fi
    fi
}

cleanup_logs() {
    log_action "Cleaning log files..."
    
    # Find and remove old log files
    find "${PROJECT_ROOT}" -type f -name "*.log" -mtime +7 -exec rm {} \; 2>/dev/null || true
    
    # Truncate large log files
    find "${PROJECT_ROOT}" -type f -name "*.log" -size +10M -exec truncate -s 0 {} \; 2>/dev/null || true
    
    log_success "Log files cleaned"
}

cleanup_temp_files() {
    log_action "Cleaning temporary files..."
    
    # Remove common temporary files
    find "${PROJECT_ROOT}" -type f \( \
        -name "*.tmp" -o \
        -name "*.temp" -o \
        -name "*.cache" -o \
        -name "*.bak" -o \
        -name "*.backup" -o \
        -name "*.swp" -o \
        -name "*.swo" -o \
        -name ".DS_Store" -o \
        -name "Thumbs.db" \
    \) -exec rm {} \; 2>/dev/null || true
    
    log_success "Temporary files removed"
}

optimize_git_repo() {
    log_action "Optimizing Git repository..."
    
    if [ -d "${PROJECT_ROOT}/.git" ]; then
        cd "$PROJECT_ROOT"
        
        # Clean untracked files (with confirmation)
        if confirm_action "Clean untracked Git files?"; then
            git clean -fd
        fi
        
        # Garbage collection
        git gc --aggressive --prune=now
        
        log_success "Git repository optimized"
    fi
}

generate_cleanup_report() {
    log_info "Generating cleanup report..."
    
    local report_file="${PROJECT_ROOT}/docker/logs/cleanup_report_${TIMESTAMP}.txt"
    
    # Calculate space freed
    local space_after=$(du -sh "${PROJECT_ROOT}" 2>/dev/null | cut -f1)
    
    {
        echo "==============================================="
        echo "Docker Cleanup Report - $(date)"
        echo "==============================================="
        echo ""
        echo "Actions Performed:"
        echo "  Files Removed: $FILES_REMOVED"
        echo "  Space After Cleanup: $space_after"
        echo ""
        echo "Docker Status:"
        docker system df
        echo ""
        echo "Active Containers:"
        docker ps
        echo ""
        echo "==============================================="
    } > "$report_file"
    
    log_success "Cleanup report created: $report_file"
}

main() {
    echo "==============================================="
    echo "Docker Cleanup Utility"
    echo "==============================================="
    
    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$CLEANUP_LOG")"
    
    # Clear previous log
    > "$CLEANUP_LOG"
    
    # Parse options
    FORCE_CLEANUP=false
    DEEP_CLEAN=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force|-f)
                FORCE_CLEANUP=true
                shift
                ;;
            --deep|-d)
                DEEP_CLEAN=true
                shift
                ;;
            --all|-a)
                FORCE_CLEANUP=true
                DEEP_CLEAN=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  -f, --force    Skip confirmation prompts"
                echo "  -d, --deep     Deep clean (removes node_modules, vendor)"
                echo "  -a, --all      Force cleanup everything"
                echo "  --help         Show this help message"
                echo ""
                echo "This script will clean:"
                echo "  - Docker dangling images and unused resources"
                echo "  - Legacy configuration files"
                echo "  - Laravel and Next.js cache"
                echo "  - Temporary files"
                echo "  - Old log files"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Record initial space
    local space_before=$(du -sh "${PROJECT_ROOT}" 2>/dev/null | cut -f1)
    log_info "Space before cleanup: $space_before"
    
    # Execute cleanup tasks
    cleanup_docker_resources
    cleanup_legacy_files
    cleanup_laravel_cache
    cleanup_nextjs_cache
    cleanup_node_modules
    cleanup_vendor
    cleanup_logs
    cleanup_temp_files
    optimize_git_repo
    
    # Generate report
    generate_cleanup_report
    
    echo ""
    echo "==============================================="
    echo -e "${GREEN}Cleanup completed successfully!${NC}"
    echo "==============================================="
}

# Run main function
main "$@"