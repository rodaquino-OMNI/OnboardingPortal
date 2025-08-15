# Health Check Implementation Guide

## Overview

This document describes the comprehensive health check system implemented for the Omni Portal Docker environment. The system provides multi-layered health monitoring for all services.

## Health Check Endpoints

### Frontend (Next.js)

#### `/api/health` - Basic Health Check
- **Purpose**: Quick health status for Docker health checks
- **Checks**: Memory usage, backend connectivity, environment configuration
- **Response Time**: < 5 seconds
- **Usage**: Docker HEALTHCHECK directive

#### `/api/health/detailed` - Comprehensive Health Check
- **Purpose**: Detailed health analysis for monitoring and debugging
- **Checks**: All backend endpoints, memory, environment, Next.js status
- **Response Time**: < 15 seconds
- **Usage**: Manual monitoring, dashboards

### Backend (Laravel)

#### `/api/health` - Main Health Check
- **Purpose**: Comprehensive backend health assessment
- **Checks**: Database, Redis, storage, memory, application status
- **Response Time**: < 10 seconds
- **Usage**: Primary health monitoring

#### `/api/health/live` - Liveness Check
- **Purpose**: Verify application is running
- **Checks**: Basic Laravel functionality
- **Response Time**: < 2 seconds
- **Usage**: Kubernetes liveness probes, Docker health checks

#### `/api/health/ready` - Readiness Check
- **Purpose**: Verify all dependencies are available
- **Checks**: Database connectivity, Redis connectivity
- **Response Time**: < 5 seconds
- **Usage**: Kubernetes readiness probes, load balancer health checks

#### `/api/health/detailed` - Extended Health Check
- **Purpose**: Detailed health information via controller
- **Checks**: All health parameters with extended metrics
- **Response Time**: < 15 seconds
- **Usage**: Health monitoring dashboards

### Nginx

#### `/health` - Nginx Health Check
- **Purpose**: Verify Nginx is serving requests
- **Response**: JSON status with timestamp
- **Response Time**: < 1 second
- **Usage**: Docker health checks, load balancer checks

#### `/health/detailed` - Backend Proxy Health
- **Purpose**: Verify Nginx can proxy to backend
- **Checks**: Backend PHP-FPM connectivity
- **Fallback**: Returns 503 if backend unavailable
- **Usage**: End-to-end connectivity verification

## Docker Health Check Configuration

### Updated docker-compose.yml Features

1. **Service Dependencies**: All services now wait for their dependencies to be healthy
2. **Extended Timeouts**: Increased timeouts for more reliable health checks
3. **Better Start Periods**: Services get adequate time to start before health checks begin
4. **MySQL Exporter Fix**: Fixed credentials and added health check

### Health Check Commands

- **Frontend**: Uses custom Node.js health check script
- **Backend**: Uses Laravel Artisan health check command
- **Nginx**: Uses wget to check health endpoint
- **MySQL Exporter**: Checks metrics endpoint availability

## Console Command

### `php artisan health:check`

A comprehensive console command for backend health verification:

```bash
# Basic health check
php artisan health:check

# JSON output for scripts
php artisan health:check --format=json
```

**Checks Performed:**
- Database connectivity and response time
- Redis connectivity and response time
- Storage writability and free space
- Critical directory permissions
- Memory usage and limits
- PHP configuration

## Health Check Script

### `scripts/docker-health-check.sh`

A comprehensive shell script for manual health verification:

```bash
# Run health check
./scripts/docker-health-check.sh
```

**Features:**
- Container health status verification
- Database and Redis connectivity tests
- HTTP endpoint availability checks
- System resource monitoring
- Colored output for easy reading
- Exit codes for automation

## Monitoring Integration

### Prometheus Metrics

The MySQL exporter now properly connects and provides metrics:
- Database performance metrics
- Connection status
- Query performance data

### Health Check Responses

All health endpoints return standardized JSON responses:

```json
{
  "status": "healthy|unhealthy|degraded",
  "timestamp": "ISO8601 timestamp",
  "checks": {
    "service_name": {
      "status": "healthy|unhealthy|warning",
      "response_time": "Xms",
      "details": {...}
    }
  }
}
```

## Verification Commands

After implementing the health checks, verify with:

```bash
# Test all health endpoints
curl http://localhost:3000/api/health
curl http://localhost:8000/api/health
curl http://localhost:8000/health
curl http://localhost:8000/api/health/live
curl http://localhost:8000/api/health/ready

# Check Docker container health
docker-compose ps

# Run comprehensive health check
./scripts/docker-health-check.sh

# Check individual service logs
docker-compose logs frontend
docker-compose logs backend
docker-compose logs nginx
docker-compose logs mysql_exporter
```

## Troubleshooting

### Common Issues and Solutions

1. **Frontend health check timeout**
   - Check if backend is accessible from frontend container
   - Verify NEXT_PUBLIC_API_URL environment variable
   - Check network connectivity between containers

2. **Backend health check fails**
   - Verify database and Redis connections
   - Check storage permissions
   - Review Laravel logs for specific errors

3. **MySQL exporter connection issues**
   - Verify DATA_SOURCE_NAME format
   - Check MySQL user permissions
   - Ensure MySQL container is healthy first

4. **Nginx health check fails**
   - Check if Nginx configuration is valid
   - Verify upstream backend connectivity
   - Review Nginx error logs

### Health Check Status Codes

- **200**: Service is healthy
- **503**: Service is unhealthy
- **Timeout**: Service is not responding

## Implementation Benefits

1. **Improved Reliability**: Services wait for dependencies before starting
2. **Better Monitoring**: Comprehensive health metrics for all components
3. **Faster Debugging**: Clear health status and error messages
4. **Automated Recovery**: Docker will restart unhealthy containers
5. **Production Ready**: Proper health checks for load balancers and orchestration

## Next Steps

1. **Custom Metrics**: Add application-specific health metrics
2. **Alerting**: Integrate with monitoring systems for alerts
3. **Performance Thresholds**: Define performance-based health criteria
4. **Security Checks**: Add security-related health validations
5. **Multi-Environment**: Adapt health checks for different environments