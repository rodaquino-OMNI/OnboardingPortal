#!/bin/bash
#############################################################################
# Docker Installation Script for Ubuntu/Debian
# This script installs Docker and Docker Compose
#############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_header() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║         Docker & Docker Compose Installation                  ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

main() {
    print_header

    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        print_error "This script should not be run as root"
        print_info "Please run as a regular user with sudo privileges"
        exit 1
    fi

    # Check for sudo privileges
    if ! sudo -v; then
        print_error "This script requires sudo privileges"
        exit 1
    fi

    # Update package index
    print_info "Updating package index..."
    sudo apt-get update -qq

    # Install prerequisites
    print_info "Installing prerequisites..."
    sudo apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release

    # Add Docker's official GPG key
    print_info "Adding Docker GPG key..."
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

    # Set up Docker repository
    print_info "Setting up Docker repository..."
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Update package index again
    sudo apt-get update -qq

    # Install Docker Engine
    print_info "Installing Docker Engine..."
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Start and enable Docker
    print_info "Starting Docker service..."
    sudo systemctl start docker
    sudo systemctl enable docker

    # Add current user to docker group
    print_info "Adding $USER to docker group..."
    sudo usermod -aG docker $USER

    # Install Docker Compose standalone (for compatibility)
    print_info "Installing Docker Compose standalone..."
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')
    sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose

    # Verify installation
    print_info "Verifying installation..."
    docker --version
    docker-compose --version

    print_success "════════════════════════════════════════════════════════════════"
    print_success "   Docker and Docker Compose installed successfully!            "
    print_success "════════════════════════════════════════════════════════════════"
    echo ""
    print_info "⚠️  Important: You need to log out and log back in for group changes to take effect"
    print_info "Or run: newgrp docker"
    echo ""
    print_info "Test your installation with: docker run hello-world"
    echo ""
}

main "$@"
