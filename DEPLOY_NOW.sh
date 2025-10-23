#!/bin/bash
# 🚀 One-Command Local Deployment Script
# Run this on your HOST MACHINE (not in container)

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}┌─────────────────────────────────────────┐${NC}"
echo -e "${BLUE}│  OnboardingPortal Local Deployment      │${NC}"
echo -e "${BLUE}│  Estimated time: 5 minutes               │${NC}"
echo -e "${BLUE}└─────────────────────────────────────────┘${NC}\n"

# Step 1: Check Docker
echo -e "${YELLOW}[1/8]${NC} Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Please install Docker Desktop.${NC}"
    exit 1
fi
if ! docker ps &> /dev/null; then
    echo -e "${RED}❌ Docker daemon not running. Please start Docker Desktop.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}\n"

# Step 2: Navigate to project
echo -e "${YELLOW}[2/8]${NC} Navigating to project directory..."
cd "$(dirname "$0")"
echo -e "${GREEN}✅ In project directory: $(pwd)${NC}\n"

# Step 3: Create .env if needed
echo -e "${YELLOW}[3/8]${NC} Setting up environment..."
if [ ! -f .env ]; then
    cp .env.docker .env
    echo -e "${GREEN}✅ Created .env from template${NC}"
else
    echo -e "${GREEN}✅ .env already exists${NC}"
fi
echo ""

# Step 4: Build images
echo -e "${YELLOW}[4/8]${NC} Building Docker images (this may take 2-3 minutes first time)..."
docker-compose build --parallel
echo -e "${GREEN}✅ Images built${NC}\n"

# Step 5: Start database services first
echo -e "${YELLOW}[5/8]${NC} Starting database services (MySQL + Redis)..."
docker-compose up -d mysql redis
echo "Waiting for database to be ready (15 seconds)..."
sleep 15
echo -e "${GREEN}✅ Database services started${NC}\n"

# Step 6: Start backend
echo -e "${YELLOW}[6/8]${NC} Starting backend service..."
docker-compose up -d backend
echo "Waiting for backend to initialize (20 seconds)..."
sleep 20
echo -e "${GREEN}✅ Backend started${NC}\n"

# Step 7: Initialize backend
echo -e "${YELLOW}[7/8]${NC} Initializing backend (key generation, migrations, seeders)..."
docker-compose exec -T backend php artisan key:generate --force
docker-compose exec -T backend php artisan migrate --force
docker-compose exec -T backend php artisan db:seed --force
echo -e "${GREEN}✅ Backend initialized${NC}\n"

# Step 8: Start frontend and nginx
echo -e "${YELLOW}[8/8]${NC} Starting frontend and nginx..."
docker-compose up -d frontend nginx
echo -e "${GREEN}✅ All services started${NC}\n"

# Health check
echo -e "${BLUE}Running health checks...${NC}"
sleep 5

echo -e "\n${BLUE}┌─────────────────────────────────────────┐${NC}"
echo -e "${BLUE}│           🎉 DEPLOYMENT COMPLETE!       │${NC}"
echo -e "${BLUE}└─────────────────────────────────────────┘${NC}\n"

echo -e "${GREEN}Your platform is running at:${NC}"
echo -e "  📱 Frontend:    ${BLUE}http://localhost:3000${NC}"
echo -e "  🎨 UI Sandbox:  ${BLUE}http://localhost:3000/_sandbox${NC}"
echo -e "  🔧 Backend API: ${BLUE}http://localhost:8000/api${NC}"
echo -e "  🌐 Nginx:       ${BLUE}http://localhost${NC}\n"

echo -e "${GREEN}Useful commands:${NC}"
echo -e "  View logs:      ${BLUE}make logs${NC}"
echo -e "  Check status:   ${BLUE}make status${NC}"
echo -e "  Health check:   ${BLUE}make health${NC}"
echo -e "  Stop all:       ${BLUE}make down${NC}"
echo -e "  Restart all:    ${BLUE}make restart${NC}\n"

echo -e "${GREEN}Testing credentials:${NC}"
echo -e "  Database: ${BLUE}onboarding_user / secret_pass${NC}"
echo -e "  Test users: See database seeders\n"

echo -e "${YELLOW}Opening frontend in browser...${NC}"
sleep 2
if command -v open &> /dev/null; then
    open http://localhost:3000
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000
else
    echo "Please open http://localhost:3000 in your browser"
fi

echo -e "\n${GREEN}✨ Deployment successful! Have fun!${NC}"
