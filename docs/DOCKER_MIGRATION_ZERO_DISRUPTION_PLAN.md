# Docker Migration Zero-Disruption Plan
## AUSTA Onboarding Portal Containerization Strategy

### Executive Summary
This document provides a comprehensive, risk-mitigated approach to containerizing the AUSTA Onboarding Portal with **ZERO production disruption**. The plan follows a 6-phase progressive migration strategy with extensive validation, rollback capabilities, and parallel running systems.

**Migration Duration**: 16-20 weeks  
**Risk Mitigation**: 100% rollback capability at every phase  
**Downtime Target**: 0 minutes  
**Success Criteria**: 99.99% availability maintained throughout migration  

---

## Phase 0: Pre-Migration Foundation (Weeks 1-3)

### 0.1 Current State Documentation
```bash
# Audit current infrastructure
./scripts/audit-infrastructure.sh

# Document all dependencies
composer show --tree > docs/php-dependencies.txt
npm list --all > docs/node-dependencies.txt

# Map all file storage locations
find . -type f -name "*.sqlite" > docs/database-files.txt
find storage/ -type f > docs/storage-files.txt

# Export all environment configurations
php artisan config:cache
php artisan route:cache
```

### 0.2 Create Comprehensive Backup System
```yaml
# backup-strategy.yml
backups:
  database:
    frequency: hourly
    retention: 30 days
    locations:
      - local: /backups/database/
      - s3: s3://austa-backups/database/
    verification: checksum + test restore
  
  files:
    frequency: daily
    retention: 90 days
    paths:
      - storage/app/documents
      - storage/app/public
      - storage/framework/sessions
    
  configurations:
    git_tracked: true
    encrypted_backup: true
    vault_storage: AWS Secrets Manager
```

### 0.3 Setup Monitoring Infrastructure
```javascript
// monitoring-stack.js
const monitoring = {
  metrics: {
    application: ['response_time', 'error_rate', 'throughput'],
    infrastructure: ['cpu', 'memory', 'disk', 'network'],
    business: ['user_sessions', 'document_uploads', 'ocr_processing']
  },
  
  alerting: {
    channels: ['slack', 'pagerduty', 'email'],
    thresholds: {
      error_rate: 0.1, // Alert if >0.1% errors
      response_time: 200, // Alert if >200ms
      availability: 99.9 // Alert if <99.9%
    }
  },
  
  dashboards: [
    'migration-progress',
    'system-health',
    'rollback-readiness'
  ]
};
```

### 0.4 Create Testing Framework
```php
// tests/Docker/MigrationValidationTest.php
class MigrationValidationTest extends TestCase
{
    public function test_database_connectivity()
    {
        $this->assertDatabaseHas('users', ['id' => 1]);
        $this->assertDatabaseCount('users', $expected);
    }
    
    public function test_file_storage_accessibility()
    {
        Storage::assertExists('documents/test.pdf');
        $this->assertTrue(Storage::disk('local')->exists($path));
    }
    
    public function test_session_persistence()
    {
        $response = $this->withSession(['key' => 'value'])
                        ->get('/api/auth/user');
        $response->assertSessionHas('key', 'value');
    }
    
    public function test_ocr_service_functionality()
    {
        $result = $this->ocrService->process($testImage);
        $this->assertNotEmpty($result['text']);
    }
}
```

---

## Phase 1: Development Environment Containerization (Weeks 4-6)

### 1.1 Docker Configuration Files

#### Backend Dockerfile
```dockerfile
# omni-portal/backend/Dockerfile
FROM php:8.3-fpm-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    zip \
    unzip \
    tesseract-ocr \
    tesseract-ocr-data-por \
    imagemagick \
    ghostscript \
    supervisor \
    nginx

# Install PHP extensions
RUN docker-php-ext-configure gd \
    --with-freetype \
    --with-jpeg \
    && docker-php-ext-install \
    pdo_mysql \
    gd \
    opcache \
    bcmath \
    pcntl \
    exif

# Install Redis extension
RUN pecl install redis && docker-php-ext-enable redis

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www/html

# Copy application files
COPY . .

# Install dependencies
RUN composer install --no-dev --optimize-autoloader

# Set permissions
RUN chown -R www-data:www-data /var/www/html/storage \
    && chmod -R 775 /var/www/html/storage \
    && chmod -R 775 /var/www/html/bootstrap/cache

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/api/health || exit 1

# Production stage
FROM base AS production

# Enable opcache for production
RUN echo "opcache.enable=1" >> /usr/local/etc/php/conf.d/opcache.ini \
    && echo "opcache.memory_consumption=256" >> /usr/local/etc/php/conf.d/opcache.ini \
    && echo "opcache.max_accelerated_files=20000" >> /usr/local/etc/php/conf.d/opcache.ini \
    && echo "opcache.validate_timestamps=0" >> /usr/local/etc/php/conf.d/opcache.ini

EXPOSE 9000
CMD ["php-fpm"]
```

#### Frontend Dockerfile
```dockerfile
# omni-portal/frontend/Dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Setup Tesseract.js worker files
RUN node scripts/setup-tesseract-lazy.js

# Build application
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/tesseract.js ./node_modules/tesseract.js

USER nextjs

EXPOSE 3000

ENV PORT 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js

CMD ["node", "server.js"]
```

#### Docker Compose Configuration
```yaml
# docker-compose.yml
version: '3.8'

services:
  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - backend-static:/var/www/html/public:ro
    depends_on:
      - backend
      - frontend
    networks:
      - austa-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Laravel Backend
  backend:
    build:
      context: ./omni-portal/backend
      target: production
    environment:
      APP_ENV: ${APP_ENV:-production}
      APP_DEBUG: ${APP_DEBUG:-false}
      APP_KEY: ${APP_KEY}
      DB_CONNECTION: mysql
      DB_HOST: database
      DB_PORT: 3306
      DB_DATABASE: ${DB_DATABASE:-austa_portal}
      DB_USERNAME: ${DB_USERNAME:-austa_user}
      DB_PASSWORD: ${DB_PASSWORD}
      REDIS_HOST: redis
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
      AWS_DEFAULT_REGION: ${AWS_DEFAULT_REGION:-us-east-1}
      CACHE_DRIVER: redis
      SESSION_DRIVER: redis
      QUEUE_CONNECTION: redis
    volumes:
      - ./omni-portal/backend/storage:/var/www/html/storage
      - backend-static:/var/www/html/public
      - tesseract-data:/usr/share/tesseract-ocr/4.00/tessdata
    depends_on:
      database:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - austa-network
    restart: unless-stopped

  # Next.js Frontend
  frontend:
    build:
      context: ./omni-portal/frontend
      target: runner
    environment:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://nginx/api}
      NODE_ENV: production
    depends_on:
      - backend
    networks:
      - austa-network
    restart: unless-stopped

  # MySQL Database
  database:
    image: mysql:8.0
    command: --default-authentication-plugin=mysql_native_password
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_DATABASE:-austa_portal}
      MYSQL_USER: ${DB_USERNAME:-austa_user}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql-data:/var/lib/mysql
      - ./docker/mysql/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
      - ./docker/mysql/my.cnf:/etc/mysql/conf.d/my.cnf:ro
    ports:
      - "3306:3306"
    networks:
      - austa-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    networks:
      - austa-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Queue Worker
  queue-worker:
    build:
      context: ./omni-portal/backend
      target: production
    command: php artisan queue:work --sleep=3 --tries=3 --max-time=3600
    environment:
      <<: *backend-environment
    volumes:
      - ./omni-portal/backend/storage:/var/www/html/storage
    depends_on:
      - database
      - redis
    networks:
      - austa-network
    restart: unless-stopped

  # Scheduler
  scheduler:
    build:
      context: ./omni-portal/backend
      target: production
    command: /bin/sh -c "while true; do php artisan schedule:run --verbose --no-interaction & sleep 60; done"
    environment:
      <<: *backend-environment
    volumes:
      - ./omni-portal/backend/storage:/var/www/html/storage
    depends_on:
      - database
      - redis
    networks:
      - austa-network
    restart: unless-stopped

volumes:
  mysql-data:
    driver: local
  redis-data:
    driver: local
  backend-static:
    driver: local
  tesseract-data:
    driver: local

networks:
  austa-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.25.0.0/16
```

### 1.2 Migration Scripts

#### Database Migration Script
```bash
#!/bin/bash
# scripts/migrate-database.sh

set -e

echo "Starting database migration..."

# Backup current database
echo "Creating backup..."
mysqldump -h $OLD_DB_HOST -u $OLD_DB_USER -p$OLD_DB_PASS $OLD_DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql

# Test connection to new database
echo "Testing new database connection..."
docker-compose exec backend php artisan db:show

# Run migrations on new database
echo "Running migrations..."
docker-compose exec backend php artisan migrate --force

# Verify data integrity
echo "Verifying data integrity..."
docker-compose exec backend php artisan tinker --execute="
    echo 'Users: ' . \App\Models\User::count();
    echo 'Documents: ' . \App\Models\Document::count();
    echo 'Health Questionnaires: ' . \App\Models\HealthQuestionnaire::count();
"

echo "Database migration completed successfully!"
```

#### File Storage Migration Script
```bash
#!/bin/bash
# scripts/migrate-storage.sh

set -e

echo "Starting storage migration..."

# Create volume directories
docker volume create austa_storage_documents
docker volume create austa_storage_public

# Copy files to volumes
echo "Copying documents..."
docker run --rm \
    -v $(pwd)/omni-portal/backend/storage:/source:ro \
    -v austa_storage_documents:/destination \
    alpine cp -R /source/app/documents /destination/

echo "Copying public files..."
docker run --rm \
    -v $(pwd)/omni-portal/backend/public:/source:ro \
    -v austa_storage_public:/destination \
    alpine cp -R /source/storage /destination/

# Verify file integrity
echo "Verifying file integrity..."
original_count=$(find ./omni-portal/backend/storage -type f | wc -l)
migrated_count=$(docker run --rm -v austa_storage_documents:/data alpine find /data -type f | wc -l)

if [ "$original_count" -eq "$migrated_count" ]; then
    echo "File migration successful: $migrated_count files migrated"
else
    echo "ERROR: File count mismatch! Original: $original_count, Migrated: $migrated_count"
    exit 1
fi

echo "Storage migration completed successfully!"
```

---

## Phase 2: Testing Environment Validation (Weeks 7-9)

### 2.1 Parallel Testing Infrastructure

#### Testing Environment Setup
```yaml
# docker-compose.test.yml
version: '3.8'

services:
  test-backend:
    extends:
      file: docker-compose.yml
      service: backend
    environment:
      APP_ENV: testing
      APP_URL: http://test.austa.local
    ports:
      - "8001:80"
    networks:
      - test-network

  test-frontend:
    extends:
      file: docker-compose.yml
      service: frontend
    environment:
      NEXT_PUBLIC_API_URL: http://test-backend:80/api
    ports:
      - "3001:3000"
    networks:
      - test-network

  test-database:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: austa_test
      MYSQL_ROOT_PASSWORD: test_password
    networks:
      - test-network

networks:
  test-network:
    driver: bridge
```

### 2.2 Automated Testing Suite

#### Integration Test Suite
```php
// tests/Docker/IntegrationTest.php
class DockerIntegrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->artisan('migrate:fresh --seed');
    }

    public function test_api_endpoints_accessible()
    {
        $endpoints = [
            '/api/health',
            '/api/auth/login',
            '/api/documents',
            '/api/gamification/progress'
        ];

        foreach ($endpoints as $endpoint) {
            $response = $this->get($endpoint);
            $this->assertNotEquals(500, $response->status(),
                "Endpoint $endpoint returned 500 error");
        }
    }

    public function test_file_upload_in_container()
    {
        Storage::fake('documents');
        
        $file = UploadedFile::fake()->create('test.pdf', 1024);
        
        $response = $this->post('/api/documents/upload', [
            'document' => $file,
            'type' => 'identity_document'
        ]);

        $response->assertStatus(201);
        Storage::disk('documents')->assertExists($file->hashName());
    }

    public function test_ocr_processing_in_container()
    {
        $testImage = base_path('tests/fixtures/sample-document.jpg');
        
        $response = $this->post('/api/v3/documents/upload', [
            'document' => new UploadedFile($testImage, 'test.jpg'),
            'enable_ocr' => true
        ]);

        $response->assertStatus(201);
        $this->assertNotEmpty($response->json('ocr_results.text'));
    }

    public function test_session_persistence_across_containers()
    {
        $response = $this->post('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password'
        ]);

        $token = $response->json('token');

        // Make request to different container
        $response = $this->withHeader('Authorization', "Bearer $token")
                        ->get('/api/auth/user');

        $response->assertStatus(200);
    }

    public function test_database_transactions_in_container()
    {
        DB::beginTransaction();
        
        $user = User::create([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => bcrypt('password')
        ]);

        $this->assertDatabaseHas('users', ['email' => 'test@example.com']);
        
        DB::rollBack();
        
        $this->assertDatabaseMissing('users', ['email' => 'test@example.com']);
    }
}
```

#### Performance Testing
```javascript
// tests/performance/docker-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
    stages: [
        { duration: '2m', target: 100 }, // Ramp up
        { duration: '5m', target: 100 }, // Stay at 100 users
        { duration: '2m', target: 200 }, // Ramp up more
        { duration: '5m', target: 200 }, // Stay at 200 users
        { duration: '2m', target: 0 },   // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
        http_req_failed: ['rate<0.1'],    // Error rate under 10%
    },
};

export default function() {
    // Test API endpoint
    let response = http.get('http://localhost/api/health');
    check(response, {
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500,
    });

    // Test document upload
    let formData = {
        document: http.file(open('./test-document.pdf'), 'document.pdf'),
        type: 'identity_document'
    };
    
    response = http.post('http://localhost/api/documents/upload', formData);
    check(response, {
        'upload successful': (r) => r.status === 201,
    });

    sleep(1);
}
```

### 2.3 Validation Checkpoints

#### Health Check Validation
```bash
#!/bin/bash
# scripts/validate-health.sh

set -e

echo "Validating container health..."

# Check all containers are running
services=("nginx" "backend" "frontend" "database" "redis")
for service in "${services[@]}"; do
    status=$(docker-compose ps -q $service | xargs docker inspect -f '{{.State.Status}}')
    if [ "$status" != "running" ]; then
        echo "ERROR: Service $service is not running (status: $status)"
        exit 1
    fi
    echo "✓ $service is running"
done

# Check health endpoints
endpoints=(
    "http://localhost/api/health"
    "http://localhost:3000/_next/health"
)

for endpoint in "${endpoints[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" $endpoint)
    if [ "$response" != "200" ]; then
        echo "ERROR: Health check failed for $endpoint (HTTP $response)"
        exit 1
    fi
    echo "✓ Health check passed for $endpoint"
done

echo "All health checks passed!"
```

---

## Phase 3: Staging Environment Deployment (Weeks 10-12)

### 3.1 Blue-Green Deployment Setup

#### Infrastructure Configuration
```yaml
# docker-compose.staging.yml
version: '3.8'

services:
  # Blue Environment (Current)
  blue-backend:
    extends:
      file: docker-compose.yml
      service: backend
    environment:
      APP_ENV: staging
      DEPLOYMENT_COLOR: blue
    networks:
      - staging-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.blue-backend.rule=Host(`staging-blue.austa.com`)"

  # Green Environment (New)
  green-backend:
    extends:
      file: docker-compose.yml
      service: backend
    environment:
      APP_ENV: staging
      DEPLOYMENT_COLOR: green
    networks:
      - staging-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.green-backend.rule=Host(`staging-green.austa.com`)"

  # Load Balancer
  traefik:
    image: traefik:v2.9
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/traefik.yml:/etc/traefik/traefik.yml:ro
      - ./traefik/dynamic.yml:/etc/traefik/dynamic.yml:ro
    networks:
      - staging-network

networks:
  staging-network:
    driver: overlay
    attachable: true
```

### 3.2 Data Synchronization

#### Real-time Data Sync
```python
# scripts/sync-data.py
import mysql.connector
import redis
import json
from datetime import datetime

class DataSynchronizer:
    def __init__(self, source_config, target_config):
        self.source_db = mysql.connector.connect(**source_config)
        self.target_db = mysql.connector.connect(**target_config)
        self.redis_client = redis.Redis(host='redis', port=6379)
        
    def sync_database(self):
        """Synchronize database with zero downtime"""
        
        # Enable binary logging
        self.enable_binlog()
        
        # Initial data copy
        self.initial_copy()
        
        # Start CDC (Change Data Capture)
        self.start_cdc()
        
        # Validate data consistency
        return self.validate_consistency()
    
    def enable_binlog(self):
        cursor = self.source_db.cursor()
        cursor.execute("SET GLOBAL binlog_format = 'ROW'")
        cursor.execute("SET GLOBAL binlog_row_image = 'FULL'")
        
    def initial_copy(self):
        """Copy all data from source to target"""
        tables = self.get_tables()
        
        for table in tables:
            print(f"Copying table: {table}")
            self.copy_table(table)
            
    def copy_table(self, table):
        # Get source data
        source_cursor = self.source_db.cursor(dictionary=True)
        source_cursor.execute(f"SELECT * FROM {table}")
        rows = source_cursor.fetchall()
        
        # Insert into target
        if rows:
            target_cursor = self.target_db.cursor()
            columns = list(rows[0].keys())
            placeholders = ', '.join(['%s'] * len(columns))
            insert_query = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})"
            
            for row in rows:
                values = [row[col] for col in columns]
                target_cursor.execute(insert_query, values)
                
            self.target_db.commit()
            
    def start_cdc(self):
        """Start Change Data Capture for real-time sync"""
        from mysql_replication import BinLogStreamReader
        from mysql_replication.row_event import WriteRowsEvent, UpdateRowsEvent, DeleteRowsEvent
        
        stream = BinLogStreamReader(
            connection_settings=self.source_config,
            server_id=100,
            only_events=[WriteRowsEvent, UpdateRowsEvent, DeleteRowsEvent],
            resume_stream=True
        )
        
        for binlog_event in stream:
            self.process_binlog_event(binlog_event)
            
    def validate_consistency(self):
        """Validate data consistency between source and target"""
        tables = self.get_tables()
        
        for table in tables:
            source_count = self.get_row_count(self.source_db, table)
            target_count = self.get_row_count(self.target_db, table)
            
            if source_count != target_count:
                print(f"WARNING: Row count mismatch in {table}: {source_count} vs {target_count}")
                return False
                
        return True
```

### 3.3 Traffic Migration Strategy

#### Gradual Traffic Shifting
```javascript
// scripts/traffic-shift.js
const axios = require('axios');

class TrafficShifter {
    constructor(loadBalancerUrl) {
        this.lbUrl = loadBalancerUrl;
        this.currentDistribution = { blue: 100, green: 0 };
    }
    
    async shiftTraffic(targetDistribution, stepSize = 10, intervalMs = 60000) {
        console.log(`Starting traffic shift to: Blue ${targetDistribution.blue}%, Green ${targetDistribution.green}%`);
        
        while (this.currentDistribution.green < targetDistribution.green) {
            // Increment green traffic
            this.currentDistribution.green += stepSize;
            this.currentDistribution.blue = 100 - this.currentDistribution.green;
            
            // Update load balancer
            await this.updateLoadBalancer(this.currentDistribution);
            
            // Monitor metrics
            const metrics = await this.getMetrics();
            if (!this.validateMetrics(metrics)) {
                console.error('Metrics validation failed! Rolling back...');
                await this.rollback();
                return false;
            }
            
            console.log(`Traffic distribution: Blue ${this.currentDistribution.blue}%, Green ${this.currentDistribution.green}%`);
            
            // Wait before next shift
            await this.sleep(intervalMs);
        }
        
        console.log('Traffic shift completed successfully!');
        return true;
    }
    
    async updateLoadBalancer(distribution) {
        const config = {
            services: {
                backend: {
                    blue: { weight: distribution.blue },
                    green: { weight: distribution.green }
                }
            }
        };
        
        await axios.put(`${this.lbUrl}/api/config`, config);
    }
    
    async getMetrics() {
        const response = await axios.get(`${this.lbUrl}/api/metrics`);
        return response.data;
    }
    
    validateMetrics(metrics) {
        // Check error rates
        if (metrics.errorRate > 0.001) return false;
        
        // Check response times
        if (metrics.p95ResponseTime > 500) return false;
        
        // Check availability
        if (metrics.availability < 99.9) return false;
        
        return true;
    }
    
    async rollback() {
        this.currentDistribution = { blue: 100, green: 0 };
        await this.updateLoadBalancer(this.currentDistribution);
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Execute traffic shift
const shifter = new TrafficShifter('http://loadbalancer:8080');
shifter.shiftTraffic({ blue: 0, green: 100 }, 10, 300000); // 10% every 5 minutes
```

---

## Phase 4: Production Preparation (Weeks 13-14)

### 4.1 Security Hardening

#### Container Security Configuration
```dockerfile
# security/Dockerfile.secure
FROM php:8.3-fpm-alpine AS secure-base

# Run as non-root user
RUN addgroup -g 1000 -S appgroup && \
    adduser -u 1000 -S appuser -G appgroup

# Security updates
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
        ca-certificates \
        openssl

# Remove unnecessary packages
RUN apk del --purge \
    apk-tools \
    curl \
    wget

# Disable dangerous PHP functions
RUN echo "disable_functions = exec,passthru,shell_exec,system,proc_open,popen,curl_exec,curl_multi_exec,parse_ini_file,show_source" >> /usr/local/etc/php/conf.d/security.ini

# Set secure file permissions
RUN find /var/www/html -type d -exec chmod 755 {} \; && \
    find /var/www/html -type f -exec chmod 644 {} \;

# Copy only necessary files
COPY --chown=appuser:appgroup . /var/www/html

USER appuser
```

#### Secrets Management
```yaml
# kubernetes/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: austa-secrets
type: Opaque
stringData:
  database-url: mysql://user:pass@mysql:3306/austa
  redis-password: ${REDIS_PASSWORD}
  aws-access-key: ${AWS_ACCESS_KEY_ID}
  aws-secret-key: ${AWS_SECRET_ACCESS_KEY}
  app-key: ${APP_KEY}
---
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
spec:
  provider:
    vault:
      server: "https://vault.austa.com:8200"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "austa-portal"
```

### 4.2 Disaster Recovery Setup

#### Backup and Recovery Strategy
```bash
#!/bin/bash
# scripts/disaster-recovery.sh

set -e

# Configuration
BACKUP_DIR="/backups"
S3_BUCKET="s3://austa-disaster-recovery"
RETENTION_DAYS=30

# Backup function
backup_system() {
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_name="backup_${timestamp}"
    
    echo "Starting backup: $backup_name"
    
    # 1. Database backup
    docker-compose exec -T database mysqldump \
        --single-transaction \
        --routines \
        --triggers \
        --events \
        --all-databases > "${BACKUP_DIR}/${backup_name}_database.sql"
    
    # 2. File storage backup
    docker run --rm \
        -v austa_storage_documents:/data:ro \
        -v ${BACKUP_DIR}:/backup \
        alpine tar czf "/backup/${backup_name}_storage.tar.gz" /data
    
    # 3. Configuration backup
    tar czf "${BACKUP_DIR}/${backup_name}_config.tar.gz" \
        docker-compose.yml \
        .env \
        nginx/
    
    # 4. Upload to S3
    aws s3 cp "${BACKUP_DIR}/${backup_name}_database.sql" "${S3_BUCKET}/"
    aws s3 cp "${BACKUP_DIR}/${backup_name}_storage.tar.gz" "${S3_BUCKET}/"
    aws s3 cp "${BACKUP_DIR}/${backup_name}_config.tar.gz" "${S3_BUCKET}/"
    
    # 5. Cleanup old backups
    find ${BACKUP_DIR} -type f -mtime +${RETENTION_DAYS} -delete
    
    echo "Backup completed: $backup_name"
}

# Recovery function
recover_system() {
    backup_name=$1
    
    echo "Starting recovery from: $backup_name"
    
    # 1. Download from S3
    aws s3 cp "${S3_BUCKET}/${backup_name}_database.sql" "${BACKUP_DIR}/"
    aws s3 cp "${S3_BUCKET}/${backup_name}_storage.tar.gz" "${BACKUP_DIR}/"
    aws s3 cp "${S3_BUCKET}/${backup_name}_config.tar.gz" "${BACKUP_DIR}/"
    
    # 2. Stop services
    docker-compose stop backend frontend queue-worker
    
    # 3. Restore database
    docker-compose exec -T database mysql < "${BACKUP_DIR}/${backup_name}_database.sql"
    
    # 4. Restore file storage
    docker run --rm \
        -v austa_storage_documents:/data \
        -v ${BACKUP_DIR}:/backup:ro \
        alpine tar xzf "/backup/${backup_name}_storage.tar.gz" -C /
    
    # 5. Restore configuration
    tar xzf "${BACKUP_DIR}/${backup_name}_config.tar.gz" -C .
    
    # 6. Restart services
    docker-compose up -d
    
    echo "Recovery completed from: $backup_name"
}

# Execute based on argument
case "$1" in
    backup)
        backup_system
        ;;
    recover)
        recover_system $2
        ;;
    *)
        echo "Usage: $0 {backup|recover <backup_name>}"
        exit 1
        ;;
esac
```

### 4.3 Performance Optimization

#### Container Resource Limits
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
    sysctls:
      - net.core.somaxconn=1024
      - net.ipv4.tcp_tw_reuse=1
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
      nproc:
        soft: 32768
        hard: 32768

  frontend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  database:
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 4G
        reservations:
          cpus: '2.0'
          memory: 2G
    command: >
      --max_connections=500
      --innodb_buffer_pool_size=2G
      --innodb_log_file_size=256M
      --innodb_flush_method=O_DIRECT
      --innodb_file_per_table=1
      --query_cache_size=256M
      --query_cache_type=1
```

---

## Phase 5: Production Migration (Weeks 15-16)

### 5.1 Pre-Migration Checklist

```markdown
## Production Migration Checklist

### Infrastructure
- [ ] All containers built and pushed to registry
- [ ] Container registry security scanning completed
- [ ] Load balancer configured for blue-green deployment
- [ ] SSL certificates installed and validated
- [ ] DNS entries prepared for cutover
- [ ] CDN configuration updated

### Data
- [ ] Full database backup completed
- [ ] File storage backup completed
- [ ] Data synchronization tested
- [ ] Rollback procedure validated
- [ ] Recovery time objective (RTO) confirmed < 15 minutes

### Monitoring
- [ ] All monitoring dashboards active
- [ ] Alert thresholds configured
- [ ] On-call team notified
- [ ] Communication channels established
- [ ] Status page prepared

### Testing
- [ ] Load testing completed at 2x expected traffic
- [ ] Security scanning completed
- [ ] Penetration testing passed
- [ ] Compliance validation completed
- [ ] User acceptance testing signed off

### Documentation
- [ ] Runbook updated
- [ ] Rollback procedure documented
- [ ] Team training completed
- [ ] Customer communication sent
```

### 5.2 Migration Execution Plan

#### Zero-Downtime Cutover Script
```bash
#!/bin/bash
# scripts/production-cutover.sh

set -e

# Configuration
MAINTENANCE_PAGE="https://maintenance.austa.com"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL}"
PAGERDUTY_KEY="${PAGERDUTY_API_KEY}"

# Functions
notify_team() {
    message=$1
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"${message}\"}" \
        ${SLACK_WEBHOOK}
}

enable_maintenance_mode() {
    echo "Enabling maintenance mode..."
    # Update load balancer to show maintenance page
    kubectl apply -f kubernetes/maintenance-ingress.yaml
    notify_team "⚠️ Maintenance mode enabled"
}

disable_maintenance_mode() {
    echo "Disabling maintenance mode..."
    kubectl delete -f kubernetes/maintenance-ingress.yaml
    notify_team "✅ Maintenance mode disabled"
}

validate_health() {
    environment=$1
    
    health_check_urls=(
        "https://${environment}.austa.com/api/health"
        "https://${environment}.austa.com/api/documents"
    )
    
    for url in "${health_check_urls[@]}"; do
        response=$(curl -s -o /dev/null -w "%{http_code}" $url)
        if [ "$response" != "200" ]; then
            notify_team "❌ Health check failed for $url"
            return 1
        fi
    done
    
    notify_team "✅ All health checks passed for ${environment}"
    return 0
}

# Main migration flow
main() {
    notify_team "🚀 Starting production migration to Docker"
    
    # Step 1: Deploy green environment
    echo "Deploying green environment..."
    docker-compose -f docker-compose.prod.yml up -d --scale backend=3 --scale frontend=2
    
    # Step 2: Wait for containers to be healthy
    echo "Waiting for containers to be healthy..."
    sleep 30
    
    # Step 3: Validate green environment
    if ! validate_health "green"; then
        echo "Green environment validation failed!"
        docker-compose -f docker-compose.prod.yml down
        notify_team "❌ Migration aborted - green environment unhealthy"
        exit 1
    fi
    
    # Step 4: Start data synchronization
    echo "Starting data synchronization..."
    python scripts/sync-data.py --source=production --target=green
    
    # Step 5: Begin traffic shifting
    echo "Starting traffic shift..."
    node scripts/traffic-shift.js \
        --target-blue=50 \
        --target-green=50 \
        --step=10 \
        --interval=300000
    
    # Step 6: Monitor metrics
    echo "Monitoring metrics during transition..."
    timeout 1800 scripts/monitor-migration.sh
    
    # Step 7: Complete cutover
    echo "Completing cutover to green..."
    node scripts/traffic-shift.js \
        --target-blue=0 \
        --target-green=100 \
        --step=25 \
        --interval=60000
    
    # Step 8: Final validation
    if validate_health "green"; then
        notify_team "✅ Migration completed successfully!"
        
        # Step 9: Decommission blue environment
        echo "Keeping blue environment for 24h rollback window..."
        at now + 24 hours <<< "docker-compose -f docker-compose.blue.yml down"
    else
        echo "Final validation failed! Rolling back..."
        node scripts/traffic-shift.js --target-blue=100 --target-green=0 --step=100
        notify_team "❌ Migration failed - rolled back to blue"
        exit 1
    fi
}

# Execute with monitoring
{
    main
} 2>&1 | tee -a /var/log/migration_$(date +%Y%m%d_%H%M%S).log
```

### 5.3 Rollback Procedure

#### Instant Rollback Script
```bash
#!/bin/bash
# scripts/instant-rollback.sh

set -e

REASON=${1:-"Unspecified reason"}

echo "INITIATING EMERGENCY ROLLBACK"
echo "Reason: $REASON"

# Step 1: Immediate traffic switch
echo "Switching all traffic back to non-containerized environment..."
kubectl patch ingress main-ingress --type='json' \
    -p='[{"op": "replace", "path": "/spec/rules/0/http/paths/0/backend/service/name", "value": "legacy-backend"}]'

# Step 2: Stop container synchronization
echo "Stopping data synchronization..."
pkill -f sync-data.py || true

# Step 3: Restore database to last known good state
echo "Restoring database..."
mysql -h ${PROD_DB_HOST} < /backups/last_known_good.sql

# Step 4: Clear Redis cache
echo "Clearing cache..."
redis-cli -h ${REDIS_HOST} FLUSHALL

# Step 5: Restart legacy services
echo "Restarting legacy services..."
systemctl restart php-fpm
systemctl restart nginx

# Step 6: Validate rollback
if curl -f http://localhost/api/health; then
    echo "✅ Rollback successful"
    
    # Notify team
    curl -X POST ${SLACK_WEBHOOK} \
        -d "{\"text\":\"⚠️ EMERGENCY ROLLBACK COMPLETED\\nReason: ${REASON}\"}"
else
    echo "❌ CRITICAL: Rollback validation failed!"
    # Trigger emergency escalation
    curl -X POST https://api.pagerduty.com/incidents \
        -H "Authorization: Token token=${PAGERDUTY_KEY}" \
        -d '{"incident":{"type":"incident","title":"CRITICAL: Rollback failed","urgency":"high"}}'
fi

# Step 7: Preserve containers for investigation
docker-compose -f docker-compose.prod.yml stop
docker-compose -f docker-compose.prod.yml logs > /var/log/failed_migration_$(date +%Y%m%d_%H%M%S).log
```

---

## Phase 6: Post-Migration Optimization (Weeks 17-20)

### 6.1 Performance Tuning

#### Container Optimization
```dockerfile
# Optimized Dockerfile with multi-stage caching
FROM php:8.3-fpm-alpine AS composer-cache
WORKDIR /tmp/
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader

FROM php:8.3-fpm-alpine AS production
COPY --from=composer-cache /tmp/vendor /var/www/html/vendor
COPY . /var/www/html
RUN composer dump-autoload --optimize --no-dev --classmap-authoritative
```

### 6.2 Monitoring and Alerting

#### Comprehensive Monitoring Stack
```yaml
# monitoring/docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
    networks:
      - monitoring

  alertmanager:
    image: prom/alertmanager:latest
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
    networks:
      - monitoring

  node-exporter:
    image: prom/node-exporter:latest
    pid: host
    networks:
      - monitoring

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    networks:
      - monitoring

volumes:
  prometheus-data:
  grafana-data:

networks:
  monitoring:
    driver: overlay
```

---

## Success Criteria and Validation

### Key Performance Indicators
```yaml
Migration Success Metrics:
  Availability:
    target: 99.99%
    measurement: Uptime during migration
    
  Performance:
    api_response_time: < 200ms (p95)
    page_load_time: < 2s
    ocr_processing: < 30s
    
  Data Integrity:
    database_consistency: 100%
    file_storage_integrity: 100%
    session_persistence: 100%
    
  Business Continuity:
    user_sessions_maintained: 100%
    document_processing_success: > 99%
    authentication_success: 100%
    
  Security:
    vulnerabilities: 0 critical, 0 high
    compliance: LGPD maintained
    encryption: All data encrypted
```

### Final Validation Checklist
```markdown
## Docker Migration Completion Checklist

### Technical Validation
- [ ] All services running in containers
- [ ] Zero data loss confirmed
- [ ] Performance metrics meeting SLAs
- [ ] Security scanning passed
- [ ] Backup/recovery tested
- [ ] Monitoring fully operational

### Business Validation
- [ ] User acceptance testing passed
- [ ] No increase in support tickets
- [ ] All features functional
- [ ] Compliance requirements met
- [ ] Documentation updated
- [ ] Team trained on new infrastructure

### Decommissioning
- [ ] Legacy infrastructure identified
- [ ] Data migration verified
- [ ] Rollback window expired
- [ ] Legacy systems decommissioned
- [ ] Cost optimization achieved
```

---

## Risk Mitigation Summary

### Critical Risk Mitigations
1. **Data Loss**: Triple backup strategy, real-time replication, point-in-time recovery
2. **Downtime**: Blue-green deployment, gradual traffic shifting, instant rollback
3. **Performance**: Extensive load testing, resource optimization, caching strategy
4. **Security**: Container scanning, secrets management, security hardening
5. **Integration**: Parallel running, comprehensive testing, API compatibility layer

### Rollback Triggers
- Error rate > 1%
- Response time > 500ms (p95)
- Availability < 99.9%
- Data inconsistency detected
- Security vulnerability discovered
- Business KPI degradation

---

## Conclusion

This zero-disruption Docker migration plan provides a methodical, risk-mitigated approach to containerizing the AUSTA Onboarding Portal. By following this 16-20 week phased approach with extensive validation, parallel running, and instant rollback capabilities, the migration can be completed with minimal business risk while maintaining 99.99% availability throughout the process.

The key to success is the gradual, validated progression through each phase with comprehensive testing and the ability to instantly revert at any sign of issues. The investment in automation, monitoring, and validation tooling ensures long-term operational excellence beyond the migration.