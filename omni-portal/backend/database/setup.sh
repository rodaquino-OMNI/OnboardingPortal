#!/bin/bash

# Omni Onboarding Portal - Database Setup Script
# This script sets up the database for the healthcare onboarding system

echo "🏥 Omni Onboarding Portal - Database Setup"
echo "=========================================="

# Check if we're in the backend directory
if [ ! -f "artisan" ]; then
    echo "❌ Error: This script must be run from the Laravel backend directory"
    echo "Please navigate to the backend folder and run: ./database/setup.sh"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

# Generate application key if needed
if grep -q "APP_KEY=$" .env || grep -q "APP_KEY=\s*$" .env; then
    echo "🔑 Generating application key..."
    php artisan key:generate
    echo "✅ Application key generated"
else
    echo "✅ Application key already set"
fi

echo ""
echo "📊 Database Configuration"
echo "------------------------"
echo "Please ensure your database connection is configured in the .env file:"
echo "  DB_CONNECTION=mysql (or pgsql, sqlite)"
echo "  DB_HOST=127.0.0.1"
echo "  DB_PORT=3306"
echo "  DB_DATABASE=omni_onboarding"
echo "  DB_USERNAME=your_username"
echo "  DB_PASSWORD=your_password"
echo ""
read -p "Press enter when your database configuration is ready..."

# Run migrations
echo ""
echo "🔄 Running database migrations..."
php artisan migrate --force

if [ $? -eq 0 ]; then
    echo "✅ Migrations completed successfully"
else
    echo "❌ Migration failed. Please check your database configuration."
    exit 1
fi

# Run seeders
echo ""
echo "🌱 Seeding database with initial data..."
php artisan db:seed --force

if [ $? -eq 0 ]; then
    echo "✅ Database seeded successfully"
else
    echo "❌ Seeding failed. Please check the error messages above."
    exit 1
fi

echo ""
echo "🎉 Database setup completed successfully!"
echo ""
echo "📋 Initial User Accounts:"
echo "------------------------"
echo "Super Admin:"
echo "  Email: admin@omnihealth.com"
echo "  Password: Admin@123!"
echo ""
echo "Healthcare Professional:"
echo "  Email: maria.silva@omnihealth.com"
echo "  Password: Doctor@123!"
echo ""
echo "Company Admin:"
echo "  Email: ana.costa@techcorp.com"
echo "  Password: Company@123!"
echo ""
echo "Test Beneficiary:"
echo "  Email: joao.santos@example.com"
echo "  Password: User@123!"
echo ""
echo "🚀 Your Omni Onboarding Portal database is ready!"
echo "You can now start the Laravel development server with: php artisan serve"