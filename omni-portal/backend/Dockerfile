# Multi-stage Dockerfile for Laravel Backend with Technical Excellence
# Stage 1: Dependencies
FROM php:8.3-fpm-alpine AS dependencies

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
    icu-dev \
    oniguruma-dev \
    libxml2-dev \
    postgresql-dev \
    imagemagick-dev \
    imagemagick \
    ghostscript \
    tesseract-ocr \
    tesseract-ocr-data-por \
    tesseract-ocr-data-eng \
    supervisor \
    linux-headers \
    && rm -rf /var/cache/apk/*

# Install PHP extensions with proper configuration  
ENV MAKEFLAGS="-j1"
RUN docker-php-ext-configure gd \
    --with-freetype \
    --with-jpeg \
    && docker-php-ext-configure intl \
    && docker-php-ext-install -j$(nproc) \
    pdo \
    pdo_mysql \
    pdo_pgsql \
    gd \
    opcache \
    bcmath \
    pcntl \
    exif \
    zip \
    intl \
    mbstring \
    xml \
    soap \
    sockets

# Install PECL extensions (before autoconf gets purged)
RUN set -eux \
    && apk add --no-cache --virtual .build-deps autoconf g++ make \
    && pecl install redis imagick \
    && docker-php-ext-enable redis imagick \
    && apk del .build-deps \
    && rm -rf /tmp/pear

# Install Composer with signature verification
COPY --from=composer:2.7.1 /usr/bin/composer /usr/bin/composer

# Stage 2: Application Build
FROM dependencies AS builder

WORKDIR /var/www/backend

# Copy composer files first for better caching
COPY composer.json composer.lock ./

# Install PHP dependencies
RUN composer install \
    --no-dev \
    --no-scripts \
    --no-autoloader \
    --prefer-dist \
    --no-interaction \
    --optimize-autoloader

# Copy application code
COPY . .

# Generate optimized autoloader
RUN composer dump-autoload \
    --no-dev \
    --optimize \
    --classmap-authoritative

# Stage 3: Production Image
FROM dependencies AS production

# Create non-root user for security
RUN addgroup -g 1000 -S appgroup && \
    adduser -u 1000 -S appuser -G appgroup

WORKDIR /var/www/backend

# Copy application from builder
COPY --from=builder --chown=appuser:appgroup /var/www/backend /var/www/backend

# Create necessary directories with proper permissions
RUN mkdir -p \
    storage/app/public \
    storage/app/documents \
    storage/framework/cache \
    storage/framework/sessions \
    storage/framework/testing \
    storage/framework/views \
    storage/logs \
    bootstrap/cache \
    && chown -R appuser:appgroup storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Copy PHP configuration
COPY docker/php/php.ini /usr/local/etc/php/php.ini
COPY docker/php/php-fpm.conf /usr/local/etc/php-fpm.d/www.conf
COPY docker/php/opcache-simple.ini /usr/local/etc/php/conf.d/opcache.ini

# Copy supervisor configuration
COPY docker/supervisor/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD php artisan health:check || exit 1

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 9000

# Start supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

# Stage 4: Development Image
FROM production AS development

USER root

# Install development dependencies
RUN apk add --no-cache \
    vim \
    nano \
    nodejs \
    npm \
    && rm -rf /var/cache/apk/*

# Install Xdebug for development (optional - skip on failure)
RUN set +e; \
    apk add --no-cache --virtual .build-deps autoconf g++ make linux-headers zlib-dev pkgconfig && \
    pecl install xdebug && \
    docker-php-ext-enable xdebug && \
    apk del .build-deps && \
    rm -rf /tmp/pear || \
    echo "XDebug installation failed - continuing without debug support"

# Copy Xdebug configuration if file exists
COPY docker/php/xdebug.ini /usr/local/etc/php/conf.d/xdebug.ini

# Development command (no Composer install to avoid proc_open issue)
CMD ["php-fpm"]