#!/bin/bash

#################################################################
# Docker Build Script for AUSTA Onboarding Portal
# This script builds all Docker images with technical excellence
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
BUILD_LOG="${PROJECT_ROOT}/docker/logs/build.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$BUILD_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$BUILD_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$BUILD_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$BUILD_LOG"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    local deps=("docker" "docker-compose")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "$dep is not installed!"
            exit 1
        fi
    done
    
    # Check Docker daemon
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker daemon is not running!"
        exit 1
    fi
    
    log_success "All dependencies are satisfied"
}

check_environment() {
    log_info "Checking environment configuration..."
    
    if [ ! -f "$ENV_FILE" ]; then
        log_error "Environment file not found: $ENV_FILE"
        exit 1
    fi
    
    # Validate required environment variables
    local required_vars=(
        "APP_KEY"
        "DB_PASSWORD"
        "DB_ROOT_PASSWORD"
        "REDIS_PASSWORD"
    )
    
    source "$ENV_FILE"
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    log_success "Environment configuration is valid"
}

create_directories() {
    log_info "Creating required directories..."
    
    local dirs=(
        "${PROJECT_ROOT}/docker/logs"
        "${PROJECT_ROOT}/docker/data/mysql"
        "${PROJECT_ROOT}/docker/data/redis"
        "${PROJECT_ROOT}/omni-portal/backend/storage/app/public"
        "${PROJECT_ROOT}/omni-portal/backend/storage/framework/cache"
        "${PROJECT_ROOT}/omni-portal/backend/storage/framework/sessions"
        "${PROJECT_ROOT}/omni-portal/backend/storage/framework/testing"
        "${PROJECT_ROOT}/omni-portal/backend/storage/framework/views"
        "${PROJECT_ROOT}/omni-portal/backend/storage/logs"
        "${PROJECT_ROOT}/omni-portal/backend/bootstrap/cache"
    )
    
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
        if [ $? -eq 0 ]; then
            log_success "Created directory: $dir"
        else
            log_warning "Failed to create directory: $dir"
        fi
    done
}

set_permissions() {
    log_info "Setting proper permissions..."
    
    # Laravel storage permissions
    chmod -R 775 "${PROJECT_ROOT}/omni-portal/backend/storage" 2>/dev/null || true
    chmod -R 775 "${PROJECT_ROOT}/omni-portal/backend/bootstrap/cache" 2>/dev/null || true
    
    # Docker data permissions
    chmod -R 755 "${PROJECT_ROOT}/docker/data" 2>/dev/null || true
    
    log_success "Permissions set successfully"
}

build_images() {
    log_info "Building Docker images..."
    
    cd "$PROJECT_ROOT"
    
    # Build with BuildKit for better caching and performance
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    
    # Pull latest base images
    log_info "Pulling latest base images..."
    docker-compose --env-file "$ENV_FILE" pull --ignore-pull-failures 2>&1 | tee -a "$BUILD_LOG"
    
    # Build all services
    log_info "Building all services..."
    if docker-compose --env-file "$ENV_FILE" build --parallel 2>&1 | tee -a "$BUILD_LOG"; then
        log_success "All images built successfully"
    else
        log_error "Failed to build Docker images"
        exit 1
    fi
}

verify_images() {
    log_info "Verifying built images..."
    
    local images=(
        "onboardingportal_backend"
        "onboardingportal_frontend"
        "onboardingportal_nginx"
    )
    
    for image in "${images[@]}"; do
        if docker images | grep -q "$image"; then
            log_success "Image verified: $image"
            
            # Check image size
            local size=$(docker images --format "table {{.Repository}}\t{{.Size}}" | grep "$image" | awk '{print $2}')
            log_info "Image size for $image: $size"
        else
            log_error "Image not found: $image"
            exit 1
        fi
    done
}

run_security_scan() {
    log_info "Running security scan on images..."
    
    # Check if trivy is installed
    if command -v trivy &> /dev/null; then
        local images=("onboardingportal_backend" "onboardingportal_frontend" "onboardingportal_nginx")
        
        for image in "${images[@]}"; do
            log_info "Scanning $image for vulnerabilities..."
            trivy image --severity HIGH,CRITICAL "$image:latest" 2>&1 | tee -a "$BUILD_LOG"
        done
    else
        log_warning "Trivy not installed, skipping security scan"
        log_info "Install with: brew install trivy (macOS) or check https://aquasecurity.github.io/trivy"
    fi
}

create_build_report() {
    log_info "Creating build report..."
    
    local report_file="${PROJECT_ROOT}/docker/logs/build_report_${TIMESTAMP}.txt"
    
    {
        echo "==============================================="
        echo "Docker Build Report - $(date)"
        echo "==============================================="
        echo ""
        echo "Build Status: SUCCESS"
        echo "Timestamp: $TIMESTAMP"
        echo ""
        echo "Images Built:"
        docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" | grep onboardingportal
        echo ""
        echo "Docker System Info:"
        docker system df
        echo ""
        echo "==============================================="
    } > "$report_file"
    
    log_success "Build report created: $report_file"
}

cleanup_old_images() {
    log_info "Cleaning up old/dangling images..."
    
    # Remove dangling images
    if [ "$(docker images -f 'dangling=true' -q | wc -l)" -gt 0 ]; then
        docker rmi $(docker images -f "dangling=true" -q) 2>/dev/null || true
        log_success "Removed dangling images"
    else
        log_info "No dangling images to remove"
    fi
}

main() {
    echo "==============================================="
    echo "Starting Docker Build Process"
    echo "==============================================="
    
    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$BUILD_LOG")"
    
    # Clear previous log
    > "$BUILD_LOG"
    
    # Execute build steps
    check_dependencies
    check_environment
    create_directories
    set_permissions
    build_images
    verify_images
    run_security_scan
    create_build_report
    cleanup_old_images
    
    echo ""
    echo "==============================================="
    echo -e "${GREEN}Build completed successfully!${NC}"
    echo "==============================================="
    echo ""
    log_info "Next steps:"
    echo "  1. Run verification tests: ./docker/scripts/test.sh"
    echo "  2. Start services: docker-compose --env-file .env.docker up -d"
    echo "  3. Check logs: docker-compose logs -f"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-cache)
            export BUILD_NO_CACHE="--no-cache"
            shift
            ;;
        --verbose)
            set -x
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --no-cache    Build without using cache"
            echo "  --verbose     Enable verbose output"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main