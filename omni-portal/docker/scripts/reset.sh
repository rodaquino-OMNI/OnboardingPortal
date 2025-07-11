#!/bin/bash

# Omni Portal Docker Reset Script

set -e

echo "⚠️  WARNING: This will reset all data and containers!"
read -p "Are you sure? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "🧹 Cleaning up Docker environment..."
    
    # Stop and remove containers
    docker-compose down -v
    
    # Remove setup marker
    rm -f backend/.setup_complete
    
    # Clean Laravel caches
    rm -rf backend/bootstrap/cache/*
    rm -rf backend/storage/framework/cache/*
    rm -rf backend/storage/framework/sessions/*
    rm -rf backend/storage/framework/views/*
    
    # Clean frontend
    rm -rf frontend/node_modules
    rm -rf frontend/.next
    
    echo "✅ Reset complete! Run ./docker/scripts/start.sh to rebuild."
else
    echo "🚫 Reset cancelled."
fi
