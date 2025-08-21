# 🔐 Docker Secrets Management - Omni Portal (Austa)

## Zero-Hardcoded-Credentials Solution

This project implements enterprise-grade Docker secrets management to eliminate ALL hardcoded passwords and sensitive data for the Omni Portal (Austa) application.

## ⚡ Quick Setup (3 steps)

### 1. Initialize Docker Swarm & Secrets
```bash
# Initialize Docker Swarm (required for secrets)
docker swarm init

# Create all required secrets with auto-generated passwords
./scripts/init-secrets.sh

# OR create secrets interactively (for API keys and custom values)
./scripts/init-secrets.sh --interactive
```

### 2. Configure Environment (Non-sensitive only)
```bash
# Copy secure environment template
cp .env.example.secure .env

# Edit with your non-sensitive settings
nano .env
```

### 3. Start with Secrets
```bash
# Development (fallback passwords - NOT for production)
docker-compose up -d

# Production (secure secrets)
docker-compose -f docker-compose.yml -f docker-compose.secrets.yml up -d
```

## 🛡️ Security Features

✅ **Zero hardcoded passwords** - All secrets externalized  
✅ **Auto-generated 32-char passwords** - Cryptographically secure  
✅ **Laravel APP_KEY format** - Proper base64: prefix  
✅ **Docker secrets encryption** - Encrypted at rest and in transit  
✅ **Secret validation** - Automated health checks  
✅ **Audit logging** - Full security event tracking  
✅ **Environment separation** - Dev/staging/prod isolation  
✅ **Multi-service support** - MySQL, Redis, Laravel, Grafana  

## 🔍 Validation & Health Checks

```bash
# Validate all secrets exist and are secure
./scripts/validate-secrets.sh

# Detailed security report with service status
./scripts/validate-secrets.sh --verbose

# Check application health
curl http://localhost:8000/health
```

## 🔄 Secret Rotation

```bash
# Rotate all secrets (90-day recommended cycle)
./scripts/init-secrets.sh --force

# Restart services to pick up new secrets
docker-compose restart
```

## 📋 Managed Secrets

| Secret | Description | Auto-Generated | Service |
|--------|-------------|----------------|---------|
| `austa_mysql_root_password` | MySQL root password | ✅ | MySQL, Exporter |
| `austa_mysql_password` | MySQL user password | ✅ | MySQL |
| `austa_db_password` | Database connection password | ✅ | Laravel Backend |
| `austa_redis_password` | Redis authentication | ✅ | Redis, Backend |
| `austa_app_key` | Laravel application key | ✅ | Laravel Backend |
| `austa_grafana_admin_password` | Grafana admin password | ✅ | Grafana |
| `austa_jwt_secret` | JWT token signing | ✅ | Backend API |
| `austa_session_secret` | Session encryption | ✅ | Backend |
| `austa_openai_api_key` | OpenAI API access | 🔧 Manual | Backend (optional) |
| `austa_encryption_key` | App-level encryption | ✅ | Backend |
| `austa_smtp_password` | Email authentication | 🔧 Manual | Backend (optional) |

## 🚨 Security Warnings Eliminated

**Before** (INSECURE):
```yaml
# .env file
DB_PASSWORD=secure_password          # ❌ Hardcoded
MYSQL_ROOT_PASSWORD=root_password    # ❌ Hardcoded  
APP_KEY=base64:abc123...             # ❌ Hardcoded
```

**After** (SECURE):
```yaml
# Docker secrets
mysql_root_password:                 # ✅ External secret
  external: true
  name: austa_mysql_root_password
db_password:                        # ✅ External secret
  external: true  
  name: austa_db_password
app_key:                           # ✅ External secret
  external: true
  name: austa_app_key
```

## 🔧 Development vs Production

### Development Mode
- Uses `docker-compose.yml` 
- Fallback to existing secrets if available
- **WARNING**: Not secure - development only

### Production Mode  
- Uses `docker-compose.secrets.yml`
- External Docker secrets only
- Enterprise-grade security
- Proper Laravel APP_KEY format

## 📁 File Structure

```
├── docker-compose.yml              # Development setup (with secrets integration)
├── docker-compose.secrets.yml      # Production secrets configuration
├── .env.example                   # Original environment template
├── .env.example.secure            # Secure environment template
├── scripts/
│   ├── init-secrets.sh           # Secret initialization for Austa
│   └── validate-secrets.sh       # Security validation for Austa
└── docs/
    └── README-DOCKER-SECRETS.md  # This guide
```

## 🚀 Production Deployment

```bash
# 1. Initialize secrets (interactive for API keys)
./scripts/init-secrets.sh --interactive

# 2. Validate setup  
./scripts/validate-secrets.sh --verbose

# 3. Configure environment
cp .env.example.secure .env
nano .env  # Edit non-sensitive settings

# 4. Deploy with secrets
docker-compose -f docker-compose.yml -f docker-compose.secrets.yml up -d

# 5. Verify services
docker-compose ps
./scripts/validate-secrets.sh
```

## 🌐 Service Access

Once running with secrets:

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | No auth required |
| Backend API | http://localhost:8000 | API-based auth |
| Grafana | http://localhost:3001 | admin / [generated password] |
| Prometheus | http://localhost:9090 | No auth required |
| MySQL Metrics | http://localhost:9104/metrics | Metrics endpoint |

## 🆘 Troubleshooting

### Secret Creation Failed
```bash
# Check Docker Swarm
docker info | grep Swarm

# Reinitialize if needed
docker swarm init
./scripts/init-secrets.sh --force
```

### Application Won't Start
```bash
# Validate secrets
./scripts/validate-secrets.sh --verbose

# Check service logs
docker-compose logs mysql redis backend grafana
```

### Laravel APP_KEY Issues
```bash
# Regenerate Laravel APP_KEY
./scripts/init-secrets.sh --force --interactive
# When prompted for austa_app_key, leave empty to auto-generate
```

### Database Connection Issues
```bash
# Check MySQL secret integration
docker secret inspect austa_mysql_password
docker secret inspect austa_db_password

# Verify backend can read secrets
docker-compose exec backend ls -la /run/secrets/
```

## 🔐 Laravel Integration

The Laravel backend reads secrets from files at runtime:

```php
// config/database.php
'password' => file_exists('/run/secrets/db_password') 
    ? trim(file_get_contents('/run/secrets/db_password'))
    : env('DB_PASSWORD'),

// config/app.php  
'key' => file_exists('/run/secrets/app_key')
    ? trim(file_get_contents('/run/secrets/app_key'))
    : env('APP_KEY'),
```

## 📚 Documentation

- **Quick Start**: This file
- **Secure Environment**: [.env.example.secure](.env.example.secure)
- **Original Example**: [.env.example](.env.example)
- **Compose Secrets**: [docker-compose.secrets.yml](docker-compose.secrets.yml)

## 🔄 Migration from Hardcoded

### Step 1: Backup Current Setup
```bash
cp .env .env.backup
cp docker-compose.yml docker-compose.yml.backup
```

### Step 2: Initialize Secrets
```bash
# Use existing passwords if desired
./scripts/init-secrets.sh --interactive
# Enter your current passwords when prompted
```

### Step 3: Update Configuration
```bash
# Copy secure environment template
cp .env.example.secure .env
# Edit with non-sensitive values only
```

### Step 4: Test Migration
```bash
# Start with secrets
docker-compose -f docker-compose.yml -f docker-compose.secrets.yml up -d

# Validate everything works
./scripts/validate-secrets.sh --verbose
curl http://localhost:8000/health
```

---

**🔒 Security Notice**: This implementation follows security best practices and eliminates all hardcoded credentials. The Omni Portal (Austa) application now uses enterprise-grade Docker secrets management for maximum security in production environments.