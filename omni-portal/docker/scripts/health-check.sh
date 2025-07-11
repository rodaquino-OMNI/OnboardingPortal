#!/bin/bash

# Health check script for Omni Portal services

set -e

echo "🏥 Checking Omni Portal Health..."
echo "================================"

# Function to check service health
check_service() {
    local service=$1
    local url=$2
    local expected_status=${3:-200}
    
    if curl -f -s -o /dev/null -w "%{http_code}" "$url" | grep -q "$expected_status"; then
        echo "✅ $service: Healthy"
        return 0
    else
        echo "❌ $service: Unhealthy"
        return 1
    fi
}

# Function to check container status
check_container() {
    local container=$1
    
    if docker-compose ps | grep -q "$container.*Up"; then
        echo "✅ $container: Running"
        return 0
    else
        echo "❌ $container: Not running"
        return 1
    fi
}

# Check containers
echo "
📦 Container Status:"
check_container "omni_nginx"
check_container "omni_php"
check_container "omni_frontend"
check_container "omni_mysql"
check_container "omni_redis"
check_container "omni_queue"
check_container "omni_scheduler"

# Check services
echo "
🌐 Service Health:"
check_service "Frontend" "http://localhost:3000" "200"
check_service "API" "http://localhost/api" "200\|404"
check_service "Nginx" "http://localhost" "200\|301\|302"

# Check database
echo "
🗄 Database Status:"
if docker-compose exec mysql mysqladmin ping -h localhost --silent 2>/dev/null; then
    echo "✅ MySQL: Responsive"
else
    echo "❌ MySQL: Not responsive"
fi

# Check Redis
echo "
🔴 Redis Status:"
if docker-compose exec redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo "✅ Redis: Responsive"
else
    echo "❌ Redis: Not responsive"
fi

# Check disk usage
echo "
💾 Disk Usage:"
docker system df

# Check resource usage
echo "
📊 Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep omni_ || true

echo "
================================"
echo "🎯 Health check complete!"
