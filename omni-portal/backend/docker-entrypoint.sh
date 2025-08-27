#!/bin/sh
# Docker entrypoint script to ensure all fixes persist

# Ensure storage directories exist with proper permissions
mkdir -p /var/www/html/storage/{logs,framework/{sessions,views,cache/data},app/public}
mkdir -p /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

# Clear any stale caches
cd /var/www/html
php artisan config:clear
php artisan cache:clear
php artisan view:clear

# Rebuild optimized caches
php artisan config:cache
php artisan route:cache
php artisan optimize

# Run migrations to ensure database is up to date
php artisan migrate --force

# Start the application
exec "$@"