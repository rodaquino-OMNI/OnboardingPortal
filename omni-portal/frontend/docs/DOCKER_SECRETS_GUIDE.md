# Docker Secrets Management Guide

This guide explains how to use the Docker secrets management system implemented for the Omni Portal application.

## Overview

The application uses Docker's built-in secrets management to securely handle sensitive data like passwords, API keys, and encryption keys. This approach eliminates hardcoded credentials and provides enterprise-grade security.

## Architecture

### Files Structure
```
├── docker-compose.yml              # Main compose file (development)
├── docker-compose.secrets.yml      # Production secrets configuration
├── .env.example                   # Environment variables template
├── scripts/
│   ├── init-secrets.sh           # Initialize Docker secrets
│   └── validate-secrets.sh       # Validate secrets configuration
└── docs/
    └── DOCKER_SECRETS_GUIDE.md   # This guide
```

### Secret Categories

#### Required Secrets
- `omni_portal_db_root_password` - Database root password
- `omni_portal_db_password` - Database user password  
- `omni_portal_redis_password` - Redis password
- `omni_portal_jwt_secret` - JWT signing secret
- `omni_portal_session_secret` - Session encryption secret

#### Optional Secrets
- `omni_portal_openai_api_key` - OpenAI API key
- `omni_portal_encryption_key` - Application encryption key
- `omni_portal_smtp_password` - SMTP password

## Quick Start

### 1. Initialize Docker Swarm
```bash
docker swarm init
```

### 2. Create Secrets
```bash
# Auto-generate all secrets
./scripts/init-secrets.sh

# Interactive mode (for API keys)
./scripts/init-secrets.sh --interactive

# Force recreate all secrets
./scripts/init-secrets.sh --force
```

### 3. Configure Environment
```bash
# Copy and edit environment file
cp .env.example .env
# Edit .env with your non-sensitive configuration
```

### 4. Start Application
```bash
# Development (with fallback passwords)
docker-compose up -d

# Production (with secrets)
docker-compose -f docker-compose.yml -f docker-compose.secrets.yml up -d
```

### 5. Validate Setup
```bash
# Check secrets status
./scripts/validate-secrets.sh

# Detailed validation
./scripts/validate-secrets.sh --verbose
```

## Detailed Usage

### Secret Initialization

The `init-secrets.sh` script provides several modes:

```bash
# Basic usage - auto-generate secure passwords
./scripts/init-secrets.sh

# Interactive mode - manually enter secrets
./scripts/init-secrets.sh --interactive

# Force mode - recreate existing secrets
./scripts/init-secrets.sh --force

# Combined - recreate and manually enter
./scripts/init-secrets.sh --force --interactive
```

#### Generated Secret Properties
- **Length**: 32 characters
- **Character set**: Base64 (alphanumeric + +/)
- **Entropy**: ~192 bits
- **Uniqueness**: Each secret is generated independently

### Secret Validation

The `validate-secrets.sh` script checks:

```bash
# Basic validation
./scripts/validate-secrets.sh

# Detailed output
./scripts/validate-secrets.sh --verbose

# Attempt to fix issues
./scripts/validate-secrets.sh --fix
```

#### Validation Checks
- Docker Swarm status
- Required secrets existence
- Optional secrets status
- Environment file security
- Compose file validation
- File permissions

### Environment Configuration

The `.env.example` file contains all configurable environment variables. Copy it to `.env` and configure:

```bash
cp .env.example .env
```

#### Key Environment Variables
```bash
# Application
NODE_ENV=production
PORT=3000

# Database
DB_HOST=mysql
DB_NAME=omni_portal
DB_USER=austa

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Security (non-sensitive)
JWT_EXPIRES_IN=24h
COOKIE_SECURE=true
```

**Important**: Never put passwords or secrets in `.env` files!

## Production Deployment

### 1. Prepare Secrets
```bash
# Use interactive mode for production secrets
./scripts/init-secrets.sh --interactive

# Validate everything is correct
./scripts/validate-secrets.sh --verbose
```

### 2. Configure Environment
```bash
# Set production environment variables
cat > .env << EOF
NODE_ENV=production
PORT=3000
DB_HOST=mysql
DB_NAME=omni_portal
DB_USER=austa
REDIS_HOST=redis
REDIS_PORT=6379
EOF
```

### 3. Deploy with Secrets
```bash
# Start with secrets configuration
docker-compose -f docker-compose.yml -f docker-compose.secrets.yml up -d

# Check status
docker-compose ps
docker-compose logs -f
```

### 4. Health Checks
```bash
# Validate deployment
./scripts/validate-secrets.sh

# Check application health
curl http://localhost:3000/health

# Monitor logs
docker-compose logs -f frontend
```

## Security Best Practices

### Secret Management
1. **Rotate Regularly**: Rotate secrets every 90 days
2. **Strong Passwords**: Use generated 32+ character passwords
3. **Unique Secrets**: Never reuse secrets across environments
4. **Limited Access**: Restrict access to secret management scripts
5. **Audit Trail**: Monitor secret access and changes

### Operational Security
1. **Secure Scripts**: Keep secret management scripts secure
2. **Log Monitoring**: Monitor application and Docker logs
3. **Backup Strategy**: Maintain secure backups of secrets
4. **Access Control**: Limit Docker daemon access
5. **Network Security**: Use secure networks for production

### Development Workflow
1. **Never Commit Secrets**: Use `.gitignore` for sensitive files
2. **Local Development**: Use docker-compose.yml for development
3. **Testing**: Use separate secrets for test environments
4. **CI/CD**: Integrate secret validation in pipelines
5. **Documentation**: Keep security documentation updated

## Troubleshooting

### Common Issues

#### Secret Creation Fails
```bash
# Check Docker Swarm status
docker info | grep Swarm

# Initialize if needed
docker swarm init

# Retry secret creation
./scripts/init-secrets.sh --force
```

#### Application Won't Start
```bash
# Validate secrets
./scripts/validate-secrets.sh --verbose

# Check service logs
docker-compose logs mysql
docker-compose logs redis
docker-compose logs frontend
```

#### Permission Denied
```bash
# Fix script permissions
chmod +x scripts/*.sh

# Check Docker permissions
docker ps
```

### Emergency Recovery

#### Lost Secrets
```bash
# Recreate all secrets
./scripts/init-secrets.sh --force --interactive

# Restart services
docker-compose restart
```

#### Corrupted Environment
```bash
# Stop all services
docker-compose down

# Remove secrets
docker secret ls | grep omni_portal | awk '{print $1}' | xargs -r docker secret rm

# Reinitialize
./scripts/init-secrets.sh
docker-compose -f docker-compose.yml -f docker-compose.secrets.yml up -d
```

## Advanced Configuration

### Custom Secret Names
Edit `docker-compose.secrets.yml` to use custom secret names:

```yaml
secrets:
  custom_db_password:
    external: true
    name: my_custom_db_secret
```

### Multiple Environments
Create environment-specific secret configurations:

```bash
# Production
./scripts/init-secrets.sh --interactive

# Staging  
docker secret create staging_db_password staging_password.txt
```

### Secret Rotation
```bash
# Automated rotation script
#!/bin/bash
./scripts/init-secrets.sh --force
docker-compose restart
./scripts/validate-secrets.sh
```

## Monitoring and Alerting

### Secret Health Monitoring
```bash
# Add to crontab for regular validation
0 6 * * * /path/to/validate-secrets.sh --verbose >> /var/log/secrets-health.log
```

### Application Integration
The application reads secrets from mounted files:

```javascript
// Read secret from file
const dbPassword = fs.readFileSync('/run/secrets/db_password', 'utf8').trim();
```

### Logging and Auditing
- Secret access is logged by Docker
- Application logs should never contain secret values
- Use structured logging for security events

## Migration from Hardcoded Secrets

### Step 1: Backup Current Setup
```bash
# Backup current configuration
cp docker-compose.yml docker-compose.yml.backup
cp .env .env.backup
```

### Step 2: Initialize Secrets
```bash
# Create secrets with current passwords
./scripts/init-secrets.sh --interactive
# Enter your current passwords when prompted
```

### Step 3: Update Configuration
```bash
# Switch to secrets-based configuration
docker-compose -f docker-compose.yml -f docker-compose.secrets.yml up -d
```

### Step 4: Validate Migration
```bash
# Verify everything works
./scripts/validate-secrets.sh
curl http://localhost:3000/health
```

## References

- [Docker Secrets Documentation](https://docs.docker.com/engine/swarm/secrets/)
- [Docker Compose Secrets](https://docs.docker.com/compose/compose-file/compose-file-v3/#secrets)
- [Security Best Practices](https://docs.docker.com/engine/security/)

---

**Security Notice**: This guide contains best practices for managing secrets. Always follow your organization's security policies and compliance requirements.