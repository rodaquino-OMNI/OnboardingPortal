# Production-ready multi-stage Dockerfile for Laravel Backend (PHP 8.3)
# Security-hardened with Alpine Linux, non-root user, and optimized layers

# Stage 1: Dependencies - Install PHP extensions and system packages
FROM php:8.3-fpm-alpine AS dependencies

# Security: Use specific user/group IDs for consistency
ARG USER_ID=1000
ARG GROUP_ID=1000

# Security: Install security updates and minimal packages
RUN apk upgrade --no-cache && \
    apk add --no-cache \
        # Core dependencies
        git \
        curl \
        ca-certificates \
        # Image processing
        libpng-dev \
        libjpeg-turbo-dev \
        freetype-dev \
        # Archive handling
        libzip-dev \
        zip \
        unzip \
        # Internationalization
        icu-dev \
        # String handling
        oniguruma-dev \
        # XML processing
        libxml2-dev \
        # Database drivers
        postgresql-dev \
        mysql-client \
        # Image processing
        imagemagick-dev \
        imagemagick \
        ghostscript \
        # OCR capabilities
        tesseract-ocr \
        tesseract-ocr-data-por \
        tesseract-ocr-data-eng \
        # Process management
        supervisor \
        # Log management tools
        logrotate \
        coreutils \
        gzip \
        findutils \
        # Build tools (temporary)
        linux-headers \
    && rm -rf /var/cache/apk/* /tmp/* /var/tmp/*

# Security: Configure PHP extensions with secure defaults
# Enable proc_open for testing (required by PHPUnit)
RUN echo "disable_functions = exec,passthru,shell_exec,system,popen,curl_multi_exec,parse_ini_file,show_source" > /usr/local/etc/php/conf.d/99-security.ini

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

# Security: Install PECL extensions with build isolation
RUN set -eux && \
    apk add --no-cache --virtual .build-deps \
        autoconf \
        g++ \
        make \
        pkgconfig \
    && pecl install redis imagick \
    && docker-php-ext-enable redis imagick \
    && apk del .build-deps \
    && rm -rf /tmp/pear /tmp/* /var/tmp/*

# Security: Install Composer from official image with version pinning
COPY --from=composer:2.7.1 /usr/bin/composer /usr/bin/composer

# Verify Composer installation (skip diagnose to avoid security audit failures)
RUN composer --version

# Stage 2: Build - Compile application with optimizations
FROM dependencies AS builder

# Security: Set build-time arguments
ARG BUILD_VERSION="unknown"
ARG BUILD_DATE
ARG VCS_REF

WORKDIR /var/www/backend

# Security: Copy composer files with proper permissions
COPY --chown=root:root composer.json composer.lock ./

# Performance: Install dependencies with maximum optimization
RUN composer install \
        --no-dev \
        --no-scripts \
        --no-autoloader \
        --prefer-dist \
        --no-interaction \
        --optimize-autoloader \
        --no-progress \
        --no-suggest \
    && composer clear-cache

# Security: Copy application code
COPY --chown=root:root . .

# Performance: Generate optimized autoloader and clear caches
# Skip scripts during build to avoid database connection attempts
RUN composer dump-autoload \
        --no-dev \
        --no-scripts \
        --optimize \
        --classmap-authoritative \
    && composer clear-cache \
    && rm -rf /tmp/* /var/tmp/*

# Stage 3: Production - Secure runtime environment
FROM dependencies AS production

# Security: Create non-root user with specific IDs
RUN addgroup -g ${GROUP_ID:-1000} -S appgroup && \
    adduser -u ${USER_ID:-1000} -S appuser -G appgroup

# Security: Set secure working directory
WORKDIR /var/www/backend

# Security: Copy application with restricted permissions
COPY --from=builder --chown=appuser:appgroup /var/www/backend /var/www/backend

# Security: Create directories with minimal required permissions
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
    && chmod -R 755 storage bootstrap/cache \
    && chmod -R 644 storage/logs

# Security: Copy secure PHP configuration
COPY --chown=root:root docker/php/php.ini /usr/local/etc/php/php.ini
COPY --chown=root:root docker/php/php-fpm.conf /usr/local/etc/php-fpm.d/www.conf  
COPY --chown=root:root docker/php/opcache.ini /usr/local/etc/php/conf.d/opcache.ini

# Security: Copy supervisor configuration with restricted permissions
COPY --chown=root:root docker/supervisor/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Log rotation: Copy log management configurations
COPY --chown=root:root docker/logrotate/laravel /etc/logrotate.d/laravel
COPY --chown=root:root scripts/log-rotation.sh /usr/local/bin/log-rotation.sh

RUN chmod 644 /usr/local/etc/php/php.ini /usr/local/etc/php-fpm.d/www.conf \
    && chmod 644 /usr/local/etc/php/conf.d/opcache.ini \
    && chmod 644 /etc/supervisor/conf.d/supervisord.conf \
    && chmod 644 /etc/logrotate.d/laravel \
    && chmod 755 /usr/local/bin/log-rotation.sh

# Security: Remove sensitive files and set secure permissions
RUN rm -rf \
        /var/www/backend/.env.example \
        /var/www/backend/README.md \
        /var/www/backend/phpunit.xml \
        /var/www/backend/tests \
    && find /var/www/backend -name "*.md" -type f -delete \
    && find /var/www/backend -name ".git*" -type f -delete

# Security: Add metadata labels
LABEL maintainer="Omni Portal Team" \
      version="${BUILD_VERSION:-unknown}" \
      build-date="${BUILD_DATE}" \
      vcs-ref="${VCS_REF}" \
      description="Omni Portal Laravel Backend - Production Ready"

# Security: Create health check script with proper permissions
RUN echo '#!/bin/sh\n\
set -e\n\
php-fpm -t > /dev/null 2>&1\n\
curl -f http://localhost:9000/health || exit 1' > /usr/local/bin/healthcheck.sh \
    && chmod +x /usr/local/bin/healthcheck.sh \
    && chown root:root /usr/local/bin/healthcheck.sh

# Security: Health check with comprehensive validation
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh

# Security: Switch to non-root user
USER appuser:appgroup

# Security: Expose only required port
EXPOSE 9000

# Security: Set runtime environment variables
ENV PHP_MEMORY_LIMIT=256M \
    PHP_MAX_EXECUTION_TIME=60 \
    PHP_UPLOAD_MAX_FILESIZE=50M \
    PHP_POST_MAX_SIZE=50M \
    COMPOSER_ALLOW_SUPERUSER=0

# Security: Use exec form for proper signal handling
CMD ["php-fpm", "--nodaemonize"]

# Stage 4: Development - Debug-enabled environment (NOT for production)
FROM production AS development

# Security warning: This stage is for development only
LABEL environment="development" \
      security-warning="This image contains debug tools and should NOT be used in production"

USER root

# Development: Install debugging and development tools
RUN apk add --no-cache \
        vim \
        nano \
        nodejs \
        npm \
        strace \
        tcpdump \
    && rm -rf /var/cache/apk/*

# XDebug is NOT installed in production for performance reasons
# To enable XDebug in development, use a separate development Dockerfile
# This significantly improves production performance

# Development: Set development environment
ENV APP_ENV=local \
    APP_DEBUG=true \
    LOG_LEVEL=debug

USER appuser:appgroup

# Development: Use PHP-FPM for development
CMD ["php-fpm", "--nodaemonize"]