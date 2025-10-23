# OnboardingPortal - Complete Deployment Guide

**Version:** 2.0
**Last Updated:** 2025-10-23
**Production Ready:** Yes ✅

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Installation Methods](#installation-methods)
4. [Configuration](#configuration)
5. [Deployment](#deployment)
6. [Verification](#verification)
7. [Management](#management)
8. [Troubleshooting](#troubleshooting)
9. [Production Deployment](#production-deployment)

---

## 🚀 Quick Start

### One-Command Deployment (Recommended)

```bash
# 1. Clone repository
git clone https://github.com/rodaquino-OMNI/OnboardingPortal.git
cd OnboardingPortal

# 2. Run deployment script
./deploy.sh

# 3. Generate application key
docker-compose exec backend php artisan key:generate

# 4. Run migrations and seed database
make migrate seed

# 5. Access the platform
open http://localhost:3000
```

**That's it!** The platform is now running:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Nginx Proxy: http://localhost

---

## 📦 Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| **Docker** | 20.10+ | Container runtime |
| **Docker Compose** | 2.0+ | Multi-container orchestration |
| **Git** | 2.0+ | Version control |

### System Requirements

- **OS:** Linux, macOS, or Windows with WSL2
- **RAM:** Minimum 4GB, Recommended 8GB+
- **Disk:** 10GB free space
- **CPU:** 2+ cores recommended

---

## 🔧 Installation Methods

### Method 1: Automated Installation (Linux/macOS)

```bash
# Install Docker and Docker Compose
./scripts/install-docker.sh

# Verify installation
docker --version
docker-compose --version
```

### Method 2: Manual Installation

#### Ubuntu/Debian
```bash
# Install Docker
sudo apt-get update
sudo apt-get install -y docker.io docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

#### macOS
```bash
# Install Docker Desktop
brew install --cask docker

# Start Docker Desktop from Applications
```

#### Windows
1. Install [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
2. Enable WSL2 integration
3. Clone repository in WSL2 terminal

---

## ⚙️ Configuration

### 1. Environment Setup

```bash
# Copy environment template
cp .env.docker .env

# Edit configuration
nano .env  # or vim .env
```

### 2. Key Configuration Options

```env
# Application
APP_NAME="OnboardingPortal"
APP_ENV=local                    # local, staging, production
APP_DEBUG=true                   # false for production

# Database
DB_DATABASE=onboarding_portal
DB_USERNAME=onboarding_user
DB_PASSWORD=secret_pass          # Change in production!

# Ports
FRONTEND_PORT=3000
BACKEND_PORT=8000
NGINX_HTTP_PORT=80

# Feature Flags
NEXT_PUBLIC_HEALTH_MODULE_ENABLED=true
NEXT_PUBLIC_REGISTRATION_ENABLED=true
```

### 3. Security Configuration (Production)

```bash
# Generate strong passwords
openssl rand -base64 32  # For DB_PASSWORD
openssl rand -base64 32  # For DB_ROOT_PASSWORD
openssl rand -base64 32  # For PHI_ENCRYPTION_KEY
```

---

## 🚀 Deployment

### Development Deployment

```bash
# Full deployment with one command
make quick-start

# Or step-by-step
make deploy        # Deploy all services
make migrate       # Run database migrations
make seed          # Seed test data
```

### Production Deployment

```bash
# Set production environment
export APP_ENV=production
export APP_DEBUG=false

# Deploy with optimizations
make prod-deploy

# Verify deployment
make health
```

---

## ✅ Verification

### Check Service Status

```bash
# View all services
make status

# Check health
make health

# View logs
make logs                # All services
make logs SERVICE=backend  # Specific service
```

### Test Endpoints

```bash
# Frontend
curl http://localhost:3000/_sandbox

# Backend API
curl http://localhost:8000/api/health

# Nginx Proxy
curl http://localhost/health
```

### Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | - |
| **Backend API** | http://localhost:8000/api | - |
| **Nginx** | http://localhost | - |
| **MySQL** | localhost:3306 | onboarding_user / secret_pass |
| **Redis** | localhost:6379 | - |

---

## 🛠️ Management

### Common Commands (Makefile)

```bash
# Service Management
make up              # Start all services
make down            # Stop all services
make restart         # Restart all services
make logs            # View logs

# Database
make migrate         # Run migrations
make seed            # Seed database
make db-reset        # Fresh migration + seed

# Laravel
make artisan CMD="route:list"  # Run artisan command
make key-generate              # Generate APP_KEY
make cache-clear              # Clear caches
make optimize                 # Optimize for production

# Development
make shell-backend    # Shell access to backend
make shell-frontend   # Shell access to frontend
make shell-mysql      # MySQL CLI
make shell-redis      # Redis CLI

# Testing
make test            # Run backend tests
make test-frontend   # Run frontend tests
make test-all        # Run all tests

# Backup
make backup-db                # Backup database
make restore-db FILE=backup.sql  # Restore database
```

### Docker Compose Commands

```bash
# Start specific service
docker-compose up -d backend

# View logs
docker-compose logs -f backend

# Execute command in container
docker-compose exec backend php artisan migrate

# Rebuild single service
docker-compose build backend

# Scale service
docker-compose up -d --scale backend=3
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Error:** `Bind for 0.0.0.0:3000 failed: port is already allocated`

**Solution:**
```bash
# Find process using port
lsof -i :3000  # Linux/macOS
netstat -ano | findstr :3000  # Windows

# Kill process or change port in .env
FRONTEND_PORT=3001
```

#### 2. Database Connection Failed

**Error:** `SQLSTATE[HY000] [2002] Connection refused`

**Solution:**
```bash
# Check database is running
docker-compose ps mysql

# Check database logs
docker-compose logs mysql

# Restart database
docker-compose restart mysql

# Wait for database to be ready
sleep 15
docker-compose exec backend php artisan migrate
```

#### 3. Permission Denied (Storage/Cache)

**Error:** `The stream or file could not be opened`

**Solution:**
```bash
# Fix permissions in backend container
docker-compose exec backend sh -c "
  chown -R www-data:www-data /var/www/html/storage
  chown -R www-data:www-data /var/www/html/bootstrap/cache
  chmod -R 775 /var/www/html/storage
  chmod -R 775 /var/www/html/bootstrap/cache
"
```

#### 4. Frontend Module Not Found

**Error:** `Module not found: Can't resolve '@/lib/...'`

**Solution:**
```bash
# Rebuild frontend
docker-compose exec frontend pnpm install
docker-compose restart frontend

# Or rebuild image
docker-compose build frontend
docker-compose up -d frontend
```

#### 5. APP_KEY Not Set

**Error:** `No application encryption key has been specified`

**Solution:**
```bash
# Generate key
make key-generate

# Or manually
docker-compose exec backend php artisan key:generate --force
```

### Debug Mode

```bash
# Enable debug mode
docker-compose exec backend php artisan config:clear
docker-compose exec backend php artisan config:cache

# View detailed errors
docker-compose logs --tail=100 -f backend
```

### Clean Reinstall

```bash
# Nuclear option: Remove everything and start fresh
make clean           # This removes all containers, volumes, and images
make deploy          # Fresh deployment
make migrate seed    # Reset database
```

---

## 🏭 Production Deployment

### Pre-Production Checklist

- [ ] Change all default passwords
- [ ] Set `APP_ENV=production` and `APP_DEBUG=false`
- [ ] Configure SSL/TLS certificates
- [ ] Set up proper CORS origins
- [ ] Configure email service (SMTP)
- [ ] Set up monitoring and alerts
- [ ] Configure automated backups
- [ ] Review and update SANCTUM_STATEFUL_DOMAINS
- [ ] Set secure session cookies
- [ ] Configure rate limiting
- [ ] Review firewall rules

### Production Environment Variables

```env
# Production Settings
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com

# Strong Passwords
DB_ROOT_PASSWORD=<strong-random-password>
DB_PASSWORD=<strong-random-password>
PHI_ENCRYPTION_KEY=<strong-random-password>

# SSL/TLS
NGINX_HTTPS_PORT=443

# Mail Configuration
MAIL_MAILER=smtp
MAIL_HOST=smtp.your-provider.com
MAIL_PORT=587
MAIL_USERNAME=your-email@domain.com
MAIL_PASSWORD=your-mail-password
MAIL_ENCRYPTION=tls

# Session Security
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=strict
```

### SSL/TLS Configuration

```bash
# 1. Obtain SSL certificates (Let's Encrypt recommended)
sudo certbot certonly --standalone -d your-domain.com

# 2. Copy certificates to nginx directory
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/nginx/ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/nginx/ssl/key.pem

# 3. Update nginx configuration (uncomment HTTPS server block)
nano docker/nginx/conf.d/onboarding-portal.conf

# 4. Restart nginx
docker-compose restart nginx
```

### Production Deployment Steps

```bash
# 1. Pull latest code
git pull origin main

# 2. Build production images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# 3. Stop services
docker-compose down

# 4. Start production services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 5. Run migrations
docker-compose exec backend php artisan migrate --force

# 6. Optimize application
docker-compose exec backend php artisan config:cache
docker-compose exec backend php artisan route:cache
docker-compose exec backend php artisan view:cache

# 7. Verify deployment
make health
```

### Monitoring

```bash
# View resource usage
docker stats

# Check logs
make logs

# Monitor specific service
docker-compose logs -f --tail=100 backend
```

### Backup Strategy

```bash
# Daily automated backup (add to crontab)
0 2 * * * cd /path/to/OnboardingPortal && make backup-db

# Manual backup
make backup-db

# Restore from backup
make restore-db FILE=backup_20250123_020000.sql
```

---

## 📞 Support

### Documentation
- **Deployment Report:** `DEPLOYMENT_REPORT.md`
- **GitHub Repository:** https://github.com/rodaquino-OMNI/OnboardingPortal
- **Docker Compose:** `docker-compose.yml`

### Getting Help

```bash
# View all available commands
make help

# Check service status
make status

# View recent logs
make logs

# Health check
make health
```

### Common Resources

- [Docker Documentation](https://docs.docker.com/)
- [Laravel Documentation](https://laravel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [MySQL Documentation](https://dev.mysql.com/doc/)

---

## 🎉 Success!

Your OnboardingPortal platform should now be fully deployed and operational!

**Quick Links:**
- Frontend: http://localhost:3000
- UI Sandbox: http://localhost:3000/_sandbox
- Backend API: http://localhost:8000/api
- Health Check: http://localhost/health

**Next Steps:**
1. Test the UI sandbox: http://localhost:3000/_sandbox
2. Try user registration: http://localhost:3000/register
3. Complete health questionnaire: http://localhost:3000/health/questionnaire
4. Review logs: `make logs`
5. Run tests: `make test-all`

---

**Generated with Technical Excellence**
Co-Authored-By: Claude <noreply@anthropic.com>
