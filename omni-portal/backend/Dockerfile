# Multi-stage build for Laravel PHP application
ARG PHP_VERSION=8.2

# Stage 1: Dependencies
FROM php:${PHP_VERSION}-fpm-alpine AS dependencies

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    libzip-dev \
    zip \
    unzip \
    mysql-client \
    postgresql-dev \
    oniguruma-dev \
    libxml2-dev \
    imagemagick-dev \
    $PHPIZE_DEPS

# Install PHP extensions
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install \
    pdo \
    pdo_mysql \
    pdo_pgsql \
    mbstring \
    zip \
    exif \
    pcntl \
    gd \
    xml \
    bcmath \
    opcache \
    intl

# Install Redis extension
RUN pecl install redis && docker-php-ext-enable redis

# Install ImageMagick extension
RUN pecl install imagick && docker-php-ext-enable imagick

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www

# Copy composer files
COPY composer.json composer.lock ./

# Install PHP dependencies
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist

# Stage 2: Builder
FROM dependencies AS builder

WORKDIR /var/www

# Copy application code
COPY . .

# Copy dependencies from previous stage
COPY --from=dependencies /var/www/vendor ./vendor

# Generate optimized autoloader and run post-install scripts
RUN composer dump-autoload --optimize --classmap-authoritative && \
    composer run-script post-autoload-dump

# Stage 3: Production
FROM php:${PHP_VERSION}-fpm-alpine AS production

# Install runtime dependencies only
RUN apk add --no-cache \
    curl \
    libpng \
    libjpeg-turbo \
    freetype \
    libzip \
    mysql-client \
    postgresql \
    oniguruma \
    libxml2 \
    imagemagick \
    supervisor \
    nginx

# Install PHP extensions (same as dependencies stage)
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install \
    pdo \
    pdo_mysql \
    pdo_pgsql \
    mbstring \
    zip \
    exif \
    pcntl \
    gd \
    xml \
    bcmath \
    opcache \
    intl

# Install Redis and ImageMagick extensions
RUN pecl install redis imagick \
    && docker-php-ext-enable redis imagick

# Create non-root user
RUN addgroup -g 1001 -S laravel && \
    adduser -S laravel -u 1001 -G laravel

# Copy PHP configuration
COPY docker/php/php.ini /usr/local/etc/php/php.ini
COPY docker/php/opcache.ini /usr/local/etc/php/conf.d/opcache.ini

# Copy supervisor configuration
COPY docker/supervisor/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Set working directory
WORKDIR /var/www

# Copy application from builder stage
COPY --from=builder --chown=laravel:laravel /var/www .

# Create required directories and set permissions
RUN mkdir -p /var/www/storage/logs \
    /var/www/storage/framework/cache \
    /var/www/storage/framework/sessions \
    /var/www/storage/framework/views \
    /var/www/bootstrap/cache && \
    chown -R laravel:laravel /var/www && \
    chmod -R 775 /var/www/storage /var/www/bootstrap/cache

# Create health check script
RUN echo '#!/bin/sh' > /usr/local/bin/health-check.sh && \
    echo 'php artisan config:cache' >> /usr/local/bin/health-check.sh && \
    echo 'php artisan route:cache' >> /usr/local/bin/health-check.sh && \
    echo 'php artisan view:cache' >> /usr/local/bin/health-check.sh && \
    chmod +x /usr/local/bin/health-check.sh

# Switch to non-root user
USER laravel

# Expose port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9000/health || exit 1

# Use supervisor to run PHP-FPM and other services
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

# Development stage
FROM builder AS development

# Install development dependencies
RUN composer install --dev

# Install Xdebug for development
RUN apk add --no-cache $PHPIZE_DEPS \
    && pecl install xdebug \
    && docker-php-ext-enable xdebug \
    && apk del $PHPIZE_DEPS

# Copy Xdebug configuration
COPY docker/php/xdebug.ini /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini

# Set development environment
ENV APP_ENV=local
ENV APP_DEBUG=true

# Expose port for development
EXPOSE 8000

# Development command
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]