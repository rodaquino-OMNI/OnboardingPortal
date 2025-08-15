#!/bin/bash

#################################################################
# Docker Stop Script for AUSTA Onboarding Portal
# This script gracefully stops all Docker services
#################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
ENV_FILE="${PROJECT_ROOT}/.env.docker"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

save_state() {
    log_info "Saving application state..."
    
    # Clear Laravel caches before stopping
    if docker-compose --env-file "$ENV_FILE" ps | grep -q "backend.*Up"; then
        docker-compose --env-file "$ENV_FILE" exec -T backend php artisan cache:clear 2>/dev/null || true
        docker-compose --env-file "$ENV_FILE" exec -T backend php artisan queue:flush 2>/dev/null || true
    fi
    
    log_success "Application state saved"
}

stop_services() {
    log_info "Stopping Docker services..."
    
    # Stop services in reverse order of dependencies
    local services=("scheduler" "queue-worker" "frontend" "nginx" "backend" "redis" "mysql" "mailhog" "phpmyadmin" "redis-commander")
    
    for service in "${services[@]}"; do
        if docker-compose --env-file "$ENV_FILE" ps | grep -q "${service}.*Up"; then
            log_info "Stopping $service..."
            docker-compose --env-file "$ENV_FILE" stop "$service" 2>/dev/null || true
        fi
    done
    
    log_success "All services stopped"
}

remove_containers() {
    if [ "${REMOVE_CONTAINERS:-false}" = true ]; then
        log_info "Removing containers..."
        docker-compose --env-file "$ENV_FILE" down
        log_success "Containers removed"
    fi
}

remove_volumes() {
    if [ "${REMOVE_VOLUMES:-false}" = true ]; then
        log_warning "Removing volumes (this will delete all data)..."
        docker-compose --env-file "$ENV_FILE" down -v
        log_success "Volumes removed"
    fi
}

show_status() {
    log_info "Current status:"
    docker-compose --env-file "$ENV_FILE" ps
}

main() {
    echo "==============================================="
    echo "Stopping AUSTA Onboarding Portal (Docker)"
    echo "==============================================="
    
    # Parse options
    REMOVE_CONTAINERS=false
    REMOVE_VOLUMES=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --remove|-r)
                REMOVE_CONTAINERS=true
                shift
                ;;
            --remove-volumes|-v)
                REMOVE_CONTAINERS=true
                REMOVE_VOLUMES=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  -r, --remove         Remove containers after stopping"
                echo "  -v, --remove-volumes Remove containers and volumes (deletes data)"
                echo "  --help              Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Execute stop sequence
    save_state
    stop_services
    remove_containers
    remove_volumes
    show_status
    
    echo ""
    echo "==============================================="
    echo -e "${GREEN}Services stopped successfully!${NC}"
    echo "==============================================="
}

# Run main function
main "$@"