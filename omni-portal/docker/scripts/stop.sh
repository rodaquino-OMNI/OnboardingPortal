#!/bin/bash

# Omni Portal Docker Stop Script

set -e

echo "🛑 Stopping Omni Onboarding Portal..."

# Stop containers
docker-compose down

echo "✅ Omni Portal stopped successfully!"
