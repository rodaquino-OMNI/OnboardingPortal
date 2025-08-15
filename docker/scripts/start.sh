#!/bin/bash

#################################################################
# Docker Start Script for AUSTA Onboarding Portal
# This script starts all Docker services with proper initialization
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
START_LOG="${PROJECT_ROOT}/docker/logs/start.log"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$START_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$START_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$START_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$START_LOG"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Check if images are built
    if ! docker images | grep -q "onboardingportal_backend"; then
        log_warning "Docker images not found. Building now..."
        "${PROJECT_ROOT}/docker/scripts/build.sh"
    fi
    
    # Check environment file
    if [ ! -f "$ENV_FILE" ]; then
        log_error "Environment file not found: $ENV_FILE"
        log_info "Please copy .env.docker.example to .env.docker and configure it"
        exit 1
    fi
    
    log_success "Prerequisites checked"
}

stop_existing_services() {
    log_info "Stopping any existing services..."
    
    docker-compose --env-file "$ENV_FILE" down --remove-orphans 2>/dev/null || true
    
    log_success "Existing services stopped"
}

start_infrastructure() {
    log_info "Starting infrastructure services (MySQL, Redis)..."
    
    docker-compose --env-file "$ENV_FILE" up -d mysql redis
    
    # Wait for MySQL to be ready
    log_info "Waiting for MySQL to be ready..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker-compose --env-file "$ENV_FILE" exec -T mysql mysql -u root -proot_secret -e "SELECT 1" &> /dev/null; then
            log_success "MySQL is ready"
            break
        fi
        
        ((attempt++))
        echo -n "."
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "MySQL failed to start within timeout"
        exit 1
    fi
    
    # Wait for Redis
    log_info "Waiting for Redis to be ready..."
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker-compose --env-file "$ENV_FILE" exec -T redis redis-cli -a redis_secret ping | grep -q "PONG"; then
            log_success "Redis is ready"
            break
        fi
        
        ((attempt++))
        echo -n "."
        sleep 1
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "Redis failed to start within timeout"
        exit 1
    fi
}

prepare_backend() {
    log_info "Preparing backend (Laravel)..."
    
    # Start backend service
    docker-compose --env-file "$ENV_FILE" up -d backend
    
    sleep 5  # Wait for container to be ready
    
    # Install composer dependencies if not present
    if ! docker-compose --env-file "$ENV_FILE" exec -T backend test -d /var/www/vendor; then
        log_info "Installing composer dependencies..."
        docker-compose --env-file "$ENV_FILE" exec -T backend composer install --no-interaction --prefer-dist --optimize-autoloader
    fi
    
    # Generate application key if not set
    if ! grep -q "^APP_KEY=base64:" "$ENV_FILE"; then
        log_info "Generating application key..."
        docker-compose --env-file "$ENV_FILE" exec -T backend php artisan key:generate
    fi
    
    # Run database migrations
    log_info "Running database migrations..."
    docker-compose --env-file "$ENV_FILE" exec -T backend php artisan migrate --force
    
    # Create storage symlink
    log_info "Creating storage symlink..."
    docker-compose --env-file "$ENV_FILE" exec -T backend php artisan storage:link 2>/dev/null || true
    
    # Clear and cache configurations
    log_info "Optimizing Laravel configuration..."
    docker-compose --env-file "$ENV_FILE" exec -T backend php artisan config:clear
    docker-compose --env-file "$ENV_FILE" exec -T backend php artisan cache:clear
    docker-compose --env-file "$ENV_FILE" exec -T backend php artisan route:clear
    docker-compose --env-file "$ENV_FILE" exec -T backend php artisan view:clear
    
    # Cache for production
    if [ "${APP_ENV:-local}" = "production" ]; then
        docker-compose --env-file "$ENV_FILE" exec -T backend php artisan config:cache
        docker-compose --env-file "$ENV_FILE" exec -T backend php artisan route:cache
        docker-compose --env-file "$ENV_FILE" exec -T backend php artisan view:cache
    fi
    
    log_success "Backend prepared successfully"
}

prepare_frontend() {
    log_info "Preparing frontend (Next.js)..."
    
    # Start frontend service
    docker-compose --env-file "$ENV_FILE" up -d frontend
    
    sleep 5  # Wait for container to be ready
    
    # Install npm dependencies if not present
    if ! docker-compose --env-file "$ENV_FILE" exec -T frontend test -d /app/node_modules; then
        log_info "Installing npm dependencies..."
        docker-compose --env-file "$ENV_FILE" exec -T frontend npm install
    fi
    
    # Build for production if needed
    if [ "${NODE_ENV:-development}" = "production" ]; then
        log_info "Building frontend for production..."
        docker-compose --env-file "$ENV_FILE" exec -T frontend npm run build
    fi
    
    log_success "Frontend prepared successfully"
}

start_all_services() {
    log_info "Starting all remaining services..."
    
    docker-compose --env-file "$ENV_FILE" up -d
    
    log_success "All services started"
}

health_check() {
    log_info "Performing health checks..."
    
    sleep 5  # Wait for services to fully initialize
    
    local services=("mysql" "redis" "backend" "frontend" "nginx" "queue-worker" "scheduler")
    local all_healthy=true
    
    for service in "${services[@]}"; do
        if docker-compose --env-file "$ENV_FILE" ps | grep -q "${service}.*Up"; then
            log_success "$service is healthy"
        else
            log_error "$service is not healthy"
            all_healthy=false
        fi
    done
    
    if [ "$all_healthy" = false ]; then
        log_warning "Some services are not healthy. Check logs with: docker-compose logs"
    fi
}

display_access_info() {
    echo ""
    echo "==============================================="
    echo -e "${GREEN}Services started successfully!${NC}"
    echo "==============================================="
    echo ""
    echo "Access URLs:"
    echo "  Frontend:        http://localhost:3000"
    echo "  Backend API:     http://localhost:8000/api"
    echo "  phpMyAdmin:      http://localhost:8080"
    echo "  MailHog:         http://localhost:8025"
    echo "  Redis Commander: http://localhost:8081"
    echo ""
    echo "Database Credentials:"
    echo "  Host:     localhost:3306"
    echo "  Database: austa_portal"
    echo "  Username: austa_user"
    echo "  Password: austa_password"
    echo ""
    echo "Useful Commands:"
    echo "  View logs:       docker-compose logs -f [service]"
    echo "  Stop services:   docker-compose down"
    echo "  Restart service: docker-compose restart [service]"
    echo "  Run tests:       ./docker/scripts/test.sh"
    echo "  Laravel CLI:     docker-compose exec backend php artisan"
    echo "  MySQL CLI:       docker-compose exec mysql mysql -u root -proot_secret"
    echo ""
    echo "==============================================="
}

main() {
    echo "==============================================="
    echo "Starting AUSTA Onboarding Portal (Docker)"
    echo "==============================================="
    
    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$START_LOG")"
    
    # Clear previous log
    > "$START_LOG"
    
    # Parse options
    DETACHED_MODE=true
    SKIP_PREP=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --attached|-a)
                DETACHED_MODE=false
                shift
                ;;
            --skip-prep)
                SKIP_PREP=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  -a, --attached    Run in attached mode (show logs)"
                echo "  --skip-prep       Skip backend/frontend preparation"
                echo "  --help           Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Execute startup sequence
    check_prerequisites
    stop_existing_services
    start_infrastructure
    
    if [ "$SKIP_PREP" = false ]; then
        prepare_backend
        prepare_frontend
    fi
    
    start_all_services
    health_check
    display_access_info
    
    # Show logs if in attached mode
    if [ "$DETACHED_MODE" = false ]; then
        log_info "Showing service logs (Ctrl+C to exit)..."
        docker-compose --env-file "$ENV_FILE" logs -f
    fi
}

# Run main function
main "$@"