# Redis High Availability Setup Guide

This guide provides comprehensive instructions for setting up and managing Redis High Availability with Sentinel for the Omni Portal application.

## Overview

The Redis HA setup includes:
- 1 Redis master instance
- 2 Redis slave instances  
- 3 Redis Sentinel instances (quorum = 2)
- Automatic failover capabilities
- Connection pooling and monitoring
- Laravel integration with phpredis

## Prerequisites

- Docker and Docker Compose installed
- Redis CLI tools (for monitoring)
- Laravel application with phpredis extension

## Quick Start

### 1. Setup Environment

Copy the example environment file:
```bash
cp .env.redis-ha.example .env.redis-ha
```

Edit the file to match your environment settings.

### 2. Start Redis HA Cluster

```bash
# Using the setup script (recommended)
./scripts/redis/redis-ha-setup.sh setup

# Or manually with docker-compose
docker-compose -f docker-compose.redis-ha.yml up -d
```

### 3. Verify Cluster Health

```bash
# Using the health check script
./scripts/redis/redis-ha-check.sh

# Or using Laravel command
php artisan redis:ha health
```

## Configuration Files

### Redis Master Configuration
- **File**: `redis/config/redis-master.conf`
- **Port**: 6379
- **Features**: AOF persistence, optimized memory settings, replication support

### Redis Slave Configuration  
- **File**: `redis/config/redis-slave.conf`
- **Ports**: 6380, 6381
- **Features**: Read-only mode, automatic master tracking

### Sentinel Configuration
- **File**: `redis/config/sentinel.conf`
- **Ports**: 26379, 26380, 26381
- **Quorum**: 2 (prevents split-brain)
- **Master Name**: mymaster

## Laravel Integration

### Database Configuration

The Redis HA configuration is integrated into Laravel's database config:

```php
// config/database.php - Redis section includes Sentinel support
'options' => [
    'sentinel' => [
        'enabled' => env('REDIS_SENTINEL_ENABLED', false),
        'master_name' => env('REDIS_SENTINEL_MASTER', 'mymaster'),
        'service' => [
            // Sentinel nodes configuration
        ],
    ],
],
```

### Environment Variables

Add these to your `.env` file:
```env
REDIS_CLIENT=phpredis
REDIS_SENTINEL_ENABLED=true
REDIS_SENTINEL_MASTER=mymaster
REDIS_SENTINEL_HOST_1=127.0.0.1
REDIS_SENTINEL_PORT_1=26379
# ... additional sentinel nodes
```

### Using Redis HA Service

```php
use App\Services\RedisHAService;

// Get service instance
$redisHA = app(RedisHAService::class);

// Execute commands with automatic failover
$result = $redisHA->executeWithFailover(function($redis) {
    return $redis->set('key', 'value');
});

// Read from slaves
$value = $redisHA->executeWithFailover(function($redis) {
    return $redis->get('key');
}, true); // true = read-only (uses slave)
```

## Management Scripts

### Setup Script (`scripts/redis/redis-ha-setup.sh`)

```bash
# Setup and start cluster
./scripts/redis/redis-ha-setup.sh setup

# Stop cluster
./scripts/redis/redis-ha-setup.sh stop

# Restart cluster  
./scripts/redis/redis-ha-setup.sh restart

# Check status
./scripts/redis/redis-ha-setup.sh status

# Scale slaves
./scripts/redis/redis-ha-setup.sh scale 3

# Backup data
./scripts/redis/redis-ha-setup.sh backup

# Force failover
./scripts/redis/redis-ha-setup.sh failover
```

### Health Check Script (`scripts/redis/redis-ha-check.sh`)

```bash
# Single health check
./scripts/redis/redis-ha-check.sh check

# Continuous monitoring
./scripts/redis/redis-ha-check.sh monitor

# Test failover capabilities
./scripts/redis/redis-ha-check.sh failover-test
```

## Laravel Commands

### Redis HA Monitor Command

```bash
# Show status
php artisan redis:ha status

# Health check
php artisan redis:ha health

# Show statistics
php artisan redis:ha stats

# Force failover
php artisan redis:ha failover

# Continuous monitoring
php artisan redis:ha monitor --interval=10 --duration=30
```

## Monitoring and Alerting

### Health Checks

The system provides multiple levels of health checking:

1. **Container Health**: Docker health checks for each service
2. **Sentinel Health**: Monitors sentinel consensus
3. **Replication Health**: Checks master-slave synchronization
4. **Application Health**: Laravel service health checks

### Metrics Collection

- **Redis Exporter**: Prometheus metrics on port 9121
- **Application Metrics**: Via RedisHAService
- **Log Monitoring**: Structured logs for all events

### Key Metrics to Monitor

- Master availability
- Slave lag time
- Sentinel consensus
- Connection count
- Memory usage
- Command latency

## Failover Process

### Automatic Failover

Sentinels automatically handle failover when:
- Master becomes unresponsive (5 seconds)
- Quorum (2) sentinels agree on master failure
- A suitable slave is promoted to master

### Manual Failover

```bash
# Using setup script
./scripts/redis/redis-ha-setup.sh failover

# Using Laravel command
php artisan redis:ha failover

# Direct sentinel command
redis-cli -p 26379 sentinel failover mymaster
```

### Failover Timeline

1. **Detection**: 5 seconds (down-after-milliseconds)
2. **Consensus**: 1-2 seconds (sentinel communication)
3. **Promotion**: 2-3 seconds (slave promotion)
4. **Reconfiguration**: 2-3 seconds (update clients)
5. **Total**: ~10-15 seconds typical failover time

## Backup and Recovery

### Automated Backups

```bash
# Enable in configuration
REDIS_BACKUP_ENABLED=true
REDIS_BACKUP_INTERVAL=3600  # Every hour
REDIS_BACKUP_RETENTION=168  # 7 days
```

### Manual Backups

```bash
# Backup using setup script
./scripts/redis/redis-ha-setup.sh backup /path/to/backup

# Restore from backup
./scripts/redis/redis-ha-setup.sh restore /path/to/backup/dump.rdb
```

### Backup Contents

- Redis RDB snapshots
- Redis AOF files
- Configuration files
- Sentinel state

## Troubleshooting

### Common Issues

#### Split-Brain Prevention
- **Problem**: Multiple masters after network partition
- **Solution**: Quorum of 2 prevents split-brain with 3 sentinels

#### High Memory Usage
- **Problem**: Memory limit exceeded
- **Solution**: Configure maxmemory and eviction policies

#### Slow Failover
- **Problem**: Failover takes too long
- **Solution**: Tune sentinel timeouts and parallel-syncs

#### Connection Failures
- **Problem**: Application can't connect
- **Solution**: Check sentinel configuration and network connectivity

### Diagnostic Commands

```bash
# Check sentinel status
redis-cli -p 26379 sentinel masters

# Check master info
redis-cli -h redis-master info replication

# Check slave status
redis-cli -h redis-slave-1 info replication

# Monitor commands
redis-cli -p 26379 monitor
```

### Log Locations

- **Container Logs**: `docker logs <container_name>`
- **Laravel Logs**: `storage/logs/laravel.log`
- **Redis Logs**: Inside containers at `/var/log/redis/`

## Performance Tuning

### Memory Optimization

```conf
# Redis configuration
maxmemory 256mb
maxmemory-policy allkeys-lru

# Optimize data structures
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
```

### Connection Pooling

```env
# Laravel configuration
REDIS_POOL_SIZE=10
REDIS_MAX_CONNECTIONS=50
REDIS_MIN_CONNECTIONS=5
```

### Network Optimization

```conf
# TCP settings
tcp-keepalive 60
timeout 300

# I/O threads
io-threads 4
io-threads-do-reads yes
```

## Security Considerations

### Network Security
- Internal Docker network isolation
- No external ports exposed (except monitoring)
- Sentinel communication encryption

### Access Control
- Redis AUTH (if enabled)
- Sentinel access restrictions
- Container-level security

### Data Protection
- AOF and RDB persistence
- Encrypted backups
- Secure configuration management

## Production Deployment

### Hardware Requirements

**Minimum Requirements:**
- 4 CPU cores
- 8GB RAM
- 100GB storage
- 1Gbps network

**Recommended:**
- 8 CPU cores
- 16GB RAM
- 500GB SSD storage
- 10Gbps network

### Scaling Considerations

- **Vertical Scaling**: Increase container resources
- **Horizontal Scaling**: Add more slave instances
- **Geographic Distribution**: Deploy across availability zones

### High Availability Checklist

- [ ] 3+ Sentinel instances deployed
- [ ] Quorum configured correctly
- [ ] Network partitioning tested
- [ ] Failover process verified
- [ ] Monitoring and alerting configured
- [ ] Backup and recovery tested
- [ ] Performance baselines established
- [ ] Documentation updated

## Support and Maintenance

### Regular Maintenance

- Monitor cluster health daily
- Review logs weekly
- Test failover monthly
- Update Redis versions quarterly
- Review configuration annually

### Getting Help

- Check application logs first
- Use health check scripts
- Review Redis documentation
- Contact system administrators

## Related Documentation

- [Redis Sentinel Documentation](https://redis.io/topics/sentinel)
- [Laravel Redis Documentation](https://laravel.com/docs/redis)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [phpredis Documentation](https://github.com/phpredis/phpredis)