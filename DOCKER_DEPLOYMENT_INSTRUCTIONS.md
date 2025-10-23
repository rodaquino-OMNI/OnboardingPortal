# Docker Deployment Instructions - OnboardingPortal

**Date:** 2025-10-23
**Environment:** Host Machine with Docker Desktop
**Status:** Ready for Deployment ✅

---

## 🎯 Quick Start (5 Minutes)

Since Docker is not available inside this container environment, you need to run the deployment from your **host machine** where Docker Desktop is running.

### Option 1: One-Command Deployment (Recommended)

```bash
# 1. Open terminal on your HOST MACHINE (not in this container)
cd /path/to/OnboardingPortal

# 2. Run the deployment script
./deploy.sh

# 3. Generate Laravel application key
docker-compose exec backend php artisan key:generate --force

# 4. Run migrations and seed database
make migrate seed

# 5. Access the platform
open http://localhost:3000
```

**That's it!** The entire platform will be running in 5 minutes.

---

## Option 2: Step-by-Step Deployment

### Step 1: Navigate to Project Directory

```bash
# On your HOST MACHINE
cd /path/to/OnboardingPortal
```

### Step 2: Verify Docker is Running

```bash
docker --version
# Expected: Docker version 20.10+ or higher

docker-compose --version
# Expected: Docker Compose version 2.0+ or higher

docker ps
# Should show Docker daemon is accessible
```

### Step 3: Pull Latest Changes (Optional)

```bash
git pull origin claude/init-claude-flow-011CULjRrm1xbjZoj2rxSrua
```

### Step 4: Configure Environment

```bash
# Verify .env exists (created automatically)
ls -la .env

# Optional: Edit configuration
nano .env  # or vim .env
```

### Step 5: Build and Start Services

```bash
# Build all Docker images
make build

# Start all services
make up

# Or use docker-compose directly
docker-compose up -d
```

### Step 6: Initialize Backend

```bash
# Generate application key
make key-generate

# Run database migrations
make migrate

# Seed test data
make seed

# Or all at once
make key-generate && make migrate && make seed
```

### Step 7: Verify Deployment

```bash
# Check service status
make status

# Check health
make health

# View logs
make logs
```

---

## 🔍 Verification Checklist

After deployment, verify all services are running:

### Service Status
```bash
docker-compose ps

# Expected output:
# onboarding-mysql     healthy
# onboarding-redis     healthy
# onboarding-backend   healthy
# onboarding-frontend  running
# onboarding-nginx     running
```

### Health Checks

**Frontend:**
```bash
curl http://localhost:3000/_sandbox
# Should return 200 OK
```

**Backend API:**
```bash
curl http://localhost:8000/api/health
# Should return: {"status":"healthy"}
```

**Nginx Proxy:**
```bash
curl http://localhost/health
# Should return nginx health status
```

**Database:**
```bash
docker-compose exec mysql mysql -uonboarding_user -psecret_pass -e "SHOW DATABASES;"
# Should show onboarding_portal database
```

---

## 📋 Available Services

| Service | URL | Credentials |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | - |
| **UI Sandbox** | http://localhost:3000/_sandbox | - |
| **Backend API** | http://localhost:8000/api | - |
| **Nginx Proxy** | http://localhost | - |
| **MySQL** | localhost:3306 | user: `onboarding_user`<br>pass: `secret_pass` |
| **Redis** | localhost:6379 | - |

---

## 🛠️ Management Commands

### Service Control

```bash
# Start all services
make up

# Stop all services
make down

# Restart all services
make restart

# View all services status
make status
```

### Backend Management

```bash
# Run migrations
make migrate

# Seed database
make seed

# Reset database (fresh migration + seed)
make db-reset

# Generate APP_KEY
make key-generate

# Clear caches
make cache-clear

# Run backend tests
make test
```

### Database Operations

```bash
# Access MySQL shell
make shell-mysql

# Backup database
make backup-db

# Restore database
make restore-db FILE=backup_20250123_120000.sql
```

### Development

```bash
# Shell access to backend container
make shell-backend

# Shell access to frontend container
make shell-frontend

# View logs (all services)
make logs

# View logs (specific service)
make logs SERVICE=backend
make logs SERVICE=frontend
make logs SERVICE=mysql
```

### Testing

```bash
# Run backend tests
make test

# Run frontend tests
make test-frontend

# Run all tests
make test-all

# Health check
make health
```

---

## 🚨 Troubleshooting

### Issue: Port Already in Use

**Error:** `Bind for 0.0.0.0:3000 failed: port is already allocated`

**Solution:**
```bash
# Find process using port
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Stop the process or change port in .env
# Edit .env and change FRONTEND_PORT=3001
```

### Issue: Database Connection Failed

**Error:** `SQLSTATE[HY000] [2002] Connection refused`

**Solution:**
```bash
# Check database is running
docker-compose ps mysql

# Check database logs
docker-compose logs mysql

# Restart database with health check wait
docker-compose restart mysql
sleep 15
docker-compose exec backend php artisan migrate
```

### Issue: APP_KEY Not Set

**Error:** `No application encryption key has been specified`

**Solution:**
```bash
make key-generate
# Or manually:
docker-compose exec backend php artisan key:generate --force
```

### Issue: Permission Denied

**Error:** `The stream or file could not be opened`

**Solution:**
```bash
docker-compose exec backend sh -c "
  chown -R www-data:www-data /var/www/html/storage
  chown -R www-data:www-data /var/www/html/bootstrap/cache
  chmod -R 775 /var/www/html/storage
  chmod -R 775 /var/www/html/bootstrap/cache
"
```

### Clean Reinstall

If all else fails, perform a clean reinstall:

```bash
# Stop and remove everything
make clean

# Fresh deployment
make deploy

# Initialize
make key-generate
make migrate
make seed

# Verify
make health
```

---

## 📊 Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Host                          │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │              │  │              │  │              │ │
│  │  MySQL 8.0   │  │  Redis 7     │  │  Nginx       │ │
│  │  Port: 3306  │  │  Port: 6379  │  │  Port: 80    │ │
│  │              │  │              │  │              │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │         │
│         └────────┬────────┴─────────┬───────┘         │
│                  │                  │                 │
│         ┌────────▼────────┐  ┌─────▼────────┐        │
│         │                 │  │              │        │
│         │ Laravel Backend │  │  Next.js     │        │
│         │ Port: 8000      │  │  Frontend    │        │
│         │ PHP 8.3-FPM     │  │  Port: 3000  │        │
│         │                 │  │              │        │
│         └─────────────────┘  └──────────────┘        │
│                                                       │
│  Volumes:                                            │
│    - mysql-data (persistent database)                │
│    - redis-data (persistent cache)                   │
│                                                       │
│  Networks:                                           │
│    - onboarding-network (bridge)                     │
│                                                       │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 Next Steps After Deployment

1. **Test UI Sandbox**
   - Navigate to http://localhost:3000/_sandbox
   - Test all UI components

2. **Test User Registration**
   - Navigate to http://localhost:3000/register
   - Create test user account

3. **Test Health Questionnaire**
   - Navigate to http://localhost:3000/health/questionnaire
   - Complete PHQ-9 or GAD-7 assessment

4. **Run Tests**
   ```bash
   make test-all
   ```

5. **Review Logs**
   ```bash
   make logs
   ```

---

## 📚 Additional Resources

- **Deployment Guide:** `DEPLOYMENT_GUIDE.md` - Comprehensive 650-line guide
- **Quick Reference:** `QUICK_REFERENCE.md` - One-page cheat sheet
- **Session Summary:** `COMPLETE_SESSION_SUMMARY.md` - Full implementation details
- **Makefile:** `Makefile` - 40+ management commands
- **Docker Compose:** `docker-compose.yml` - Service orchestration

---

## 🆘 Need Help?

```bash
# View all available commands
make help

# Check service status
make status

# View recent logs
make logs

# Health check all services
make health
```

---

## ✅ Success Criteria

Your deployment is successful when:

- [ ] All 5 Docker containers are running
- [ ] `make status` shows all services as healthy
- [ ] Frontend accessible at http://localhost:3000
- [ ] Backend API responds at http://localhost:8000/api/health
- [ ] Database contains seeded data (PHQ-9, GAD-7 questionnaires)
- [ ] User registration works
- [ ] Health questionnaire renders properly
- [ ] `make test` passes all tests

---

**Generated with Technical Excellence**
🤖 Co-Authored-By: Claude <noreply@anthropic.com>
