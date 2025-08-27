#!/bin/bash

# Test Infrastructure Setup Script
set -e

echo "🔧 Setting up test environment..."

# Backend setup
cd omni-portal/backend

echo "📦 Installing backend dependencies..."
composer install --no-interaction --quiet --no-progress

echo "🗄️ Setting up test database..."
touch database/test.sqlite
php artisan key:generate --env=testing --force
php artisan config:clear --env=testing
php artisan migrate:fresh --env=testing --force --quiet

echo "✅ Running basic backend tests..."
timeout 30 php artisan test --stop-on-failure --quiet || echo "❌ Backend tests failed"

# Frontend setup  
cd ../frontend

echo "📦 Installing frontend dependencies..."
npm ci --silent --no-progress

echo "🔍 Running type check..."
npm run type-check || echo "❌ Type check failed"

echo "✅ Running basic frontend tests..."
timeout 30 npm test -- --passWithNoTests --silent --maxWorkers=1 || echo "❌ Frontend tests failed"

echo "🎉 Test environment setup complete!"