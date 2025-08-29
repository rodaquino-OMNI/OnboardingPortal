#!/bin/bash

# OnboardingPortal Application Monitor
# Continuously monitors all services and reports errors

echo "🔍 Starting OnboardingPortal Application Monitor..."
echo "================================================"
echo "Services:"
echo "  - Backend: http://localhost:8000"
echo "  - Frontend: http://localhost:3000"
echo "  - WebSocket: ws://localhost:8080"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check service health
check_service() {
    local name=$1
    local url=$2
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [ "$response" = "200" ] || [ "$response" = "204" ]; then
        echo -e "${GREEN}✓${NC} $name: OK (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗${NC} $name: ERROR (HTTP $response)"
        return 1
    fi
}

# Function to check for Laravel errors
check_laravel_logs() {
    local log_file="/Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/backend/storage/logs/laravel-$(date +%Y-%m-%d).log"
    
    if [ -f "$log_file" ]; then
        local errors=$(tail -n 100 "$log_file" | grep -E "ERROR|CRITICAL|ALERT|EMERGENCY" | wc -l)
        if [ "$errors" -gt 0 ]; then
            echo -e "${YELLOW}⚠${NC} Laravel: $errors errors in last 100 log lines"
            tail -n 100 "$log_file" | grep -E "ERROR|CRITICAL|ALERT|EMERGENCY" | tail -n 5
        fi
    fi
}

# Main monitoring loop
while true; do
    clear
    echo "🔍 OnboardingPortal Monitor - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "================================================"
    
    # Check backend health
    echo -e "\n📡 Service Health:"
    check_service "Backend API" "http://localhost:8000/api/health"
    check_service "Frontend" "http://localhost:3000"
    
    # Check WebSocket
    ws_response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/apps/715792" 2>/dev/null)
    if [ "$ws_response" = "200" ] || [ "$ws_response" = "404" ]; then
        echo -e "${GREEN}✓${NC} WebSocket: Running"
    else
        echo -e "${RED}✗${NC} WebSocket: Not responding"
    fi
    
    # Check for errors
    echo -e "\n📝 Error Monitoring:"
    check_laravel_logs
    
    # Check process status
    echo -e "\n🔧 Process Status:"
    if pgrep -f "php artisan serve" > /dev/null; then
        echo -e "${GREEN}✓${NC} Laravel server running"
    else
        echo -e "${RED}✗${NC} Laravel server NOT running"
    fi
    
    if pgrep -f "next dev" > /dev/null; then
        echo -e "${GREEN}✓${NC} Next.js server running"
    else
        echo -e "${RED}✗${NC} Next.js server NOT running"
    fi
    
    if pgrep -f "reverb:start" > /dev/null; then
        echo -e "${GREEN}✓${NC} Reverb WebSocket running"
    else
        echo -e "${RED}✗${NC} Reverb WebSocket NOT running"
    fi
    
    # Test critical endpoints
    echo -e "\n🧪 Endpoint Tests:"
    
    # Test login endpoint
    login_response=$(curl -s -X POST http://localhost:8000/api/auth/login \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -d '{"email":"test@example.com","password":"password"}' \
        -w "\n%{http_code}" 2>/dev/null | tail -n 1)
    
    if [ "$login_response" = "422" ] || [ "$login_response" = "401" ] || [ "$login_response" = "200" ]; then
        echo -e "${GREEN}✓${NC} Auth API: Responding (HTTP $login_response)"
    else
        echo -e "${RED}✗${NC} Auth API: Error (HTTP $login_response)"
    fi
    
    echo -e "\n================================================"
    echo "Press Ctrl+C to stop monitoring"
    echo "Refreshing in 10 seconds..."
    
    sleep 10
done