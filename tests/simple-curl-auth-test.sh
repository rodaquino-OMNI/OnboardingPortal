#!/bin/bash

# Simple Authentication Test using direct curl commands
# Bypasses middleware issues by testing core functionality

set -e

echo "🔐 SIMPLE CURL AUTHENTICATION TEST"
echo "=================================="
echo ""

# Test CSRF Cookie first
echo "1. Testing CSRF Cookie endpoint:"
echo "curl -s -I 'http://localhost:8000/sanctum/csrf-cookie'"
CSRF_RESPONSE=$(curl -s -I "http://localhost:8000/sanctum/csrf-cookie")
echo "Response:"
echo "$CSRF_RESPONSE"
echo ""

# Test Health endpoint
echo "2. Testing Health endpoint:"
echo "curl -s 'http://localhost:8000/api/health'"
HEALTH_RESPONSE=$(curl -s "http://localhost:8000/api/health")
echo "Response:"
echo "$HEALTH_RESPONSE"
echo ""

# Test credentials
echo "3. Testing Login endpoints:"
echo ""

CREDENTIALS=(
    "admin@omnihealth.com:Admin@123"
    "maria.silva@omnihealth.com:Doctor@123!"
    "carlos.santos@omnihealth.com:Coord@123!"
    "ana.costa@empresa.com:Employee@123!"
)

for cred in "${CREDENTIALS[@]}"; do
    EMAIL="${cred%%:*}"
    PASSWORD="${cred##*:}"
    
    echo "Testing: $EMAIL"
    echo "Command: curl -s -X POST 'http://localhost:8000/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}'"
    
    RESPONSE=$(curl -s -X POST "http://localhost:8000/api/auth/login" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -H "Origin: http://localhost:3000" \
        -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
    
    echo "Response:"
    echo "$RESPONSE"
    echo "---"
    echo ""
done

echo "Test completed at $(date)"