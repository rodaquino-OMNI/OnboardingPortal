#!/bin/bash
#############################################################################
# OnboardingPortal - One-Command Deployment Script
# This script deploys the entire platform with Docker Compose
#############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

#############################################################################
# Helper Functions
#############################################################################

print_header() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║         OnboardingPortal - Full Stack Deployment              ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "${GREEN}➜ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is not installed. Please install it first."
        echo "Installation instructions: https://docs.docker.com/get-docker/"
        exit 1
    fi
}

#############################################################################
# Main Deployment
#############################################################################

main() {
    print_header

    # Step 1: Check prerequisites
    print_step "Step 1/8: Checking prerequisites..."
    check_command docker
    check_command docker-compose
    print_success "Docker and Docker Compose are installed"

    # Step 2: Check environment file
    print_step "Step 2/8: Setting up environment configuration..."
    if [ ! -f .env ]; then
        if [ -f .env.docker ]; then
            print_info "Creating .env from .env.docker template..."
            cp .env.docker .env
            print_warning "⚠️  IMPORTANT: Edit .env file and set APP_KEY"
            print_info "Run: docker-compose exec backend php artisan key:generate"
        else
            print_error ".env.docker template not found"
            exit 1
        fi
    else
        print_success ".env file exists"
    fi

    # Step 3: Check backend .env
    print_step "Step 3/8: Setting up backend environment..."
    if [ ! -f omni-portal/backend/.env ]; then
        if [ -f omni-portal/backend/.env.example ]; then
            print_info "Creating backend .env from example..."
            cp omni-portal/backend/.env.example omni-portal/backend/.env
        fi
    fi
    print_success "Backend environment configured"

    # Step 4: Build Docker images
    print_step "Step 4/8: Building Docker images..."
    print_info "This may take several minutes on first run..."
    docker-compose build --parallel
    print_success "Docker images built successfully"

    # Step 5: Start services
    print_step "Step 5/8: Starting services..."
    docker-compose up -d mysql redis
    print_info "Waiting for database to be ready..."
    sleep 15

    # Wait for MySQL to be healthy
    print_info "Checking database health..."
    for i in {1..30}; do
        if docker-compose exec -T mysql mysqladmin ping -h localhost -uroot -p${DB_ROOT_PASSWORD:-secret_root_pass} &> /dev/null; then
            print_success "Database is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Database failed to start"
            docker-compose logs mysql
            exit 1
        fi
        sleep 2
    done

    # Step 6: Start backend
    print_step "Step 6/8: Starting backend API..."
    docker-compose up -d backend
    print_info "Waiting for backend to initialize..."
    sleep 20

    # Check backend health
    for i in {1..30}; do
        if docker-compose exec -T backend php artisan about &> /dev/null; then
            print_success "Backend is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_warning "Backend may not be fully ready. Check logs: docker-compose logs backend"
        fi
        sleep 2
    done

    # Step 7: Start frontend and nginx
    print_step "Step 7/8: Starting frontend and nginx..."
    docker-compose up -d frontend nginx
    print_info "Waiting for services to stabilize..."
    sleep 10

    # Step 8: Verify deployment
    print_step "Step 8/8: Verifying deployment..."

    print_info "Checking service status..."
    docker-compose ps

    echo ""
    print_success "════════════════════════════════════════════════════════════════"
    print_success "   🎉 OnboardingPortal Successfully Deployed!                   "
    print_success "════════════════════════════════════════════════════════════════"
    echo ""

    print_info "📋 Service URLs:"
    echo "   • Frontend:        http://localhost:3000"
    echo "   • Backend API:     http://localhost:8000/api"
    echo "   • Nginx Proxy:     http://localhost"
    echo "   • Health Check:    http://localhost/health"
    echo ""

    print_info "🎯 Quick Start:"
    echo "   • UI Sandbox:      http://localhost:3000/_sandbox"
    echo "   • Register:        http://localhost:3000/register"
    echo "   • Health Quiz:     http://localhost:3000/health/questionnaire"
    echo ""

    print_info "🔧 Management Commands:"
    echo "   • View logs:       docker-compose logs -f [service]"
    echo "   • Stop all:        docker-compose down"
    echo "   • Restart:         docker-compose restart [service]"
    echo "   • Shell access:    docker-compose exec [service] sh"
    echo ""

    print_info "🗄️ Database Access:"
    echo "   • Host:            localhost:3306"
    echo "   • Database:        onboarding_portal"
    echo "   • Username:        onboarding_user"
    echo "   • Password:        secret_pass"
    echo ""

    print_warning "⚠️  Next Steps:"
    echo "   1. Generate APP_KEY: docker-compose exec backend php artisan key:generate"
    echo "   2. Run migrations:   docker-compose exec backend php artisan migrate"
    echo "   3. Seed database:    docker-compose exec backend php artisan db:seed"
    echo ""

    print_info "📚 For detailed documentation, see README.md and DEPLOYMENT_GUIDE.md"
    echo ""
}

# Handle script interruption
trap 'print_error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"
