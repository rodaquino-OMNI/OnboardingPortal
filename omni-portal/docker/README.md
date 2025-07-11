# Omni Onboarding Portal - Docker Setup

This Docker configuration provides a complete development and production environment for the Omni Onboarding Portal.

## Services

- **Nginx** (1.24): Web server and reverse proxy
- **PHP-FPM** (8.2): Laravel backend runtime
- **Node.js** (18+): Next.js frontend server
- **MySQL** (8.0): Primary database
- **Redis** (7.0): Cache and session storage
- **Queue Worker**: Laravel queue processing
- **Scheduler**: Laravel task scheduling

## Development Tools

- **PHPMyAdmin**: Database management UI (http://localhost:8080)
- **MailHog**: Email testing server (http://localhost:8025)
- **Redis Commander**: Redis management UI (http://localhost:8081)
- **Xdebug**: PHP debugging support

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd omni-portal
   ```

2. **Copy environment file**
   ```bash
   cp .env.example .env
   ```

3. **Start the application**
   ```bash
   make start
   # or
   ./docker/scripts/start.sh
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - API: http://localhost/api
   - PHPMyAdmin: http://localhost:8080
   - MailHog: http://localhost:8025
   - Redis Commander: http://localhost:8081

## Common Commands

### Using Make
```bash
make start      # Start all containers
make stop       # Stop all containers
make restart    # Restart all containers
make build      # Rebuild containers
make logs       # View container logs
make shell-php  # Access PHP container
make migrate    # Run database migrations
make test       # Run all tests
```

### Using Docker Compose
```bash
docker-compose up -d        # Start in background
docker-compose down         # Stop containers
docker-compose logs -f      # View logs
docker-compose exec php sh  # PHP shell access
```

## Environment Configuration

### Development
The default configuration is optimized for development:
- Hot-reload enabled for Next.js
- Xdebug configured for PHP debugging
- All logs visible
- Development tools included

### Production
For production deployment:
```bash
# Use production compose file
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Or use make command
make prod-up
```

Production optimizations:
- Multi-stage builds for smaller images
- Production PHP and Node configurations
- Log rotation enabled
- Health checks configured
- Automatic restart policies

## Troubleshooting

### Port Conflicts
If you encounter port conflicts:
1. Check which service is using the port: `lsof -i :PORT`
2. Either stop the conflicting service or change the port in docker-compose.yml

### Permission Issues
```bash
# Fix Laravel storage permissions
chmod -R 775 backend/storage backend/bootstrap/cache
```

### Database Connection Issues
1. Ensure MySQL container is running: `docker-compose ps`
2. Check MySQL logs: `docker-compose logs mysql`
3. Verify credentials in .env match docker-compose.yml

### Memory Issues
If containers are running out of memory:
1. Increase Docker Desktop memory allocation
2. Adjust service memory limits in docker-compose.yml

## SSL Configuration

For local SSL development:
1. Generate self-signed certificates:
   ```bash
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout docker/nginx/ssl/key.pem \
     -out docker/nginx/ssl/cert.pem
   ```

2. Update your hosts file:
   ```
   127.0.0.1 omni-portal.local
   ```

3. Access via https://omni-portal.local

## Backup and Restore

### Backup Database
```bash
docker-compose exec mysql mysqldump -u root -p omni_portal > backup.sql
```

### Restore Database
```bash
docker-compose exec -T mysql mysql -u root -p omni_portal < backup.sql
```

## Performance Optimization

### Development
- Use `.dockerignore` to exclude unnecessary files
- Mount only necessary directories
- Use Docker's build cache effectively

### Production
- Enable OPcache in PHP
- Use Redis for session storage
- Configure proper memory limits
- Use CDN for static assets

## Security Considerations

1. **Change default passwords** in production
2. **Use environment-specific .env files**
3. **Enable HTTPS** in production
4. **Restrict database access** to application containers only
5. **Regular security updates** for base images

## Monitoring

### Container Health
```bash
docker-compose ps
docker stats
```

### Application Logs
```bash
# All logs
docker-compose logs -f

# Specific service
docker-compose logs -f php
docker-compose logs -f frontend
```

### Performance Metrics
- Use Docker stats: `docker stats`
- Monitor with Prometheus/Grafana (optional setup)

## Support

For issues or questions:
1. Check container logs first
2. Verify environment configuration
3. Consult the troubleshooting section
4. Open an issue in the repository
