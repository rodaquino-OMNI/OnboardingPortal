#!/bin/bash

# Omni Portal Docker Start Script

set -e

echo "🚀 Starting Omni Onboarding Portal..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please update .env file with your configuration"
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p backend/storage/{app,framework,logs}
mkdir -p backend/storage/framework/{cache,sessions,testing,views}
mkdir -p backend/bootstrap/cache

# Set permissions
echo "🔐 Setting permissions..."
chmod -R 775 backend/storage backend/bootstrap/cache

# Build and start containers
echo "🐳 Building Docker containers..."
docker-compose build

echo "🚀 Starting Docker containers..."
docker-compose up -d

# Wait for MySQL to be ready
echo "⏳ Waiting for MySQL to be ready..."
until docker-compose exec mysql mysqladmin ping -h localhost --silent; do
    echo "Waiting for MySQL..."
    sleep 2
done

# Run Laravel setup if needed
if [ ! -f "backend/.setup_complete" ]; then
    echo "🎨 Running Laravel setup..."
    
    # Install composer dependencies
    docker-compose exec php composer install
    
    # Generate application key
    docker-compose exec php php artisan key:generate
    
    # Run migrations
    docker-compose exec php php artisan migrate --force
    
    # Create storage link
    docker-compose exec php php artisan storage:link
    
    # Cache configuration
    docker-compose exec php php artisan config:cache
    docker-compose exec php php artisan route:cache
    
    # Mark setup as complete
    touch backend/.setup_complete
fi

# Install frontend dependencies if needed
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    docker-compose exec frontend npm install
fi

echo "✅ Omni Portal is ready!"
echo "🌐 Frontend: http://localhost:3000"
echo "🔌 API: http://localhost/api"
echo "📊 PHPMyAdmin: http://localhost:8080"
echo "📧 MailHog: http://localhost:8025"
echo "🔴 Redis Commander: http://localhost:8081"
echo ""
echo "📝 View logs: docker-compose logs -f [service]"
echo "🛑 Stop: docker-compose down"
