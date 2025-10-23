# OnboardingPortal - Quick Reference Card

## 🚀 One-Command Deploy
```bash
./deploy.sh && make migrate seed
```

## 📦 Essential Commands

### Service Control
```bash
make up              # Start all services
make down            # Stop all services
make restart         # Restart all services
make status          # Show service status
make health          # Health check
make logs            # View all logs
make logs SERVICE=backend  # View specific logs
```

### Database
```bash
make migrate         # Run migrations
make seed            # Seed test data
make db-reset        # Fresh migration + seed
make backup-db       # Backup database
```

### Laravel
```bash
make key-generate              # Generate APP_KEY
make cache-clear              # Clear all caches
make optimize                 # Optimize for production
make artisan CMD="route:list"  # Run artisan command
```

### Development
```bash
make shell-backend    # Backend shell
make shell-frontend   # Frontend shell
make shell-mysql      # MySQL CLI
make test            # Run tests
```

## 🔗 URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| UI Sandbox | http://localhost:3000/_sandbox |
| Backend API | http://localhost:8000/api |
| Health Questionnaire | http://localhost:3000/health/questionnaire |
| Nginx Proxy | http://localhost |

## 🗄️ Database Access
```bash
Host: localhost:3306
Database: onboarding_portal
Username: onboarding_user
Password: secret_pass
```

## 🐛 Quick Troubleshooting

```bash
# Port in use
lsof -i :3000

# Service not starting
docker-compose logs SERVICE_NAME

# Clear everything and restart
make clean
make quick-start

# Fix permissions
docker-compose exec backend sh -c "chmod -R 775 storage bootstrap/cache"
```

## 📋 Testing Checklist

- [ ] UI Sandbox: http://localhost:3000/_sandbox
- [ ] Registration: http://localhost:3000/register
- [ ] Health Quiz: http://localhost:3000/health/questionnaire
- [ ] API Health: http://localhost:8000/api/health
- [ ] Run Tests: `make test-all`

## 🔐 Production Checklist

- [ ] Set `APP_ENV=production` in .env
- [ ] Set `APP_DEBUG=false` in .env
- [ ] Change DB_PASSWORD
- [ ] Change DB_ROOT_PASSWORD
- [ ] Generate PHI_ENCRYPTION_KEY
- [ ] Configure SSL certificates
- [ ] Update CORS settings
- [ ] Configure email (SMTP)
- [ ] Set up monitoring
- [ ] Configure backups

## 📞 Get Help
```bash
make help            # Show all commands
docker-compose ps    # Service status
make status          # Detailed status
```

---

**Full Documentation:** DEPLOYMENT_GUIDE.md
