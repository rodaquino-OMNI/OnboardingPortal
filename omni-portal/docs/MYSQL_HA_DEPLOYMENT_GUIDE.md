# MySQL High Availability Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying and managing a MySQL High Availability (HA) cluster with master-slave replication, automatic failover, and zero downtime operations.

## Architecture

### Components

1. **MySQL Master**: Primary database instance handling all write operations
2. **MySQL Slaves (2)**: Read replicas for scaling read operations
3. **ProxySQL**: Intelligent load balancer and connection router
4. **Orchestrator**: Automatic failover detection and management
5. **Monitoring Stack**: Prometheus, Grafana, and MySQL Exporter
6. **Redis**: Session management and caching

### Key Features

- **GTID-based Replication**: Ensures data consistency and simplified failover
- **Automatic Failover**: Zero downtime failover with Orchestrator
- **Read/Write Splitting**: Automatic query routing through ProxySQL
- **Health Monitoring**: Comprehensive health checks and alerting
- **Connection Pooling**: Efficient connection management
- **Backup & Recovery**: Automated backup and point-in-time recovery

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Minimum 4GB RAM and 20GB disk space
- Network ports 3306-3308, 6032-6033, 3000-3001, 9090 available

### 1. Initial Setup

```bash
# Clone the repository and navigate to the project
cd /path/to/omni-portal

# Copy environment configuration
cp .env.example .env

# Edit environment variables as needed
nano .env
```

### 2. Start the Cluster

```bash
# Start the MySQL HA cluster
./scripts/mysql-ha/manage-cluster.sh start

# Setup replication (wait 30 seconds after start)
./scripts/mysql-ha/manage-cluster.sh setup

# Verify cluster health
./scripts/mysql-ha/manage-cluster.sh health
```

### 3. Verify Installation

```bash
# Check cluster status
./scripts/mysql-ha/manage-cluster.sh status

# Run comprehensive health check
./scripts/mysql-ha/health-check.sh --report

# Test failover capability
./scripts/mysql-ha/manage-cluster.sh failover
```

## Configuration

### Environment Variables

```bash
# Core Database Configuration
DB_CONNECTION=mysql-ha
DB_DATABASE=omni_portal
DB_USERNAME=omni_user
DB_PASSWORD=omnipass123
MYSQL_ROOT_PASSWORD=masterrootpass123
MYSQL_REPLICATION_PASSWORD=replicatorpass123

# MySQL HA Configuration
DB_WRITE_HOST=127.0.0.1
DB_WRITE_PORT=3306
DB_WRITE_USERNAME=omni_user
DB_WRITE_PASSWORD=omnipass123
DB_READ_HOST_1=127.0.0.1:3307
DB_READ_HOST_2=127.0.0.1:3308
DB_READ_USERNAME=omni_reader
DB_READ_PASSWORD=omnireader123

# ProxySQL Configuration
PROXYSQL_HOST=127.0.0.1
PROXYSQL_PORT=6033
```

### Laravel Database Configuration

The system supports multiple connection strategies:

1. **mysql-ha**: Automatic read/write splitting (Recommended)
2. **proxysql**: All traffic through ProxySQL
3. **Direct connections**: mysql-master, mysql-slave-1, mysql-slave-2

```php
// config/database.php
'default' => env('DB_CONNECTION', 'mysql-ha'),

'connections' => [
    'mysql-ha' => [
        'driver' => 'mysql',
        'read' => [
            'host' => [
                env('DB_READ_HOST_1', '127.0.0.1:3307'),
                env('DB_READ_HOST_2', '127.0.0.1:3308'),
            ],
            // Read configuration...
        ],
        'write' => [
            'host' => env('DB_WRITE_HOST', '127.0.0.1'),
            // Write configuration...
        ],
        'sticky' => true,
    ],
    // Other connections...
],
```

## Operations

### Cluster Management

```bash
# Start/Stop Operations
./scripts/mysql-ha/manage-cluster.sh start
./scripts/mysql-ha/manage-cluster.sh stop
./scripts/mysql-ha/manage-cluster.sh restart

# Health and Monitoring
./scripts/mysql-ha/manage-cluster.sh status
./scripts/mysql-ha/manage-cluster.sh health --report
./scripts/mysql-ha/manage-cluster.sh monitor

# Backup and Recovery
./scripts/mysql-ha/manage-cluster.sh backup --compress
./scripts/mysql-ha/manage-cluster.sh restore /path/to/backup.sql.gz

# Scaling
./scripts/mysql-ha/manage-cluster.sh scale 3  # Scale to 3 slaves
```

### Health Monitoring

#### Web Endpoints

```bash
# Laravel Health Endpoints
GET /api/health/database              # Overall database health
GET /api/health/database/connections  # All connection status
GET /api/health/database/replication  # Replication lag info
GET /api/health/database/statistics   # Connection statistics
POST /api/health/database/failover    # Test failover
```

#### Command Line

```bash
# Comprehensive health check
./scripts/mysql-ha/health-check.sh

# Generate detailed report
./scripts/mysql-ha/health-check.sh --report

# Monitor specific connection
docker exec mysql-master mysql -uroot -p -e "SHOW MASTER STATUS\\G"
docker exec mysql-slave-1 mysql -uroot -p -e "SHOW SLAVE STATUS\\G"
```

### Monitoring Dashboards

- **Grafana**: http://localhost:3000 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Orchestrator**: http://localhost:3001
- **ProxySQL Admin**: `mysql -h127.0.0.1 -P6032 -uadmin -padmin`

## Failover Scenarios

### Automatic Failover

Orchestrator continuously monitors the cluster and automatically handles:

1. **Master Failure**: Promotes the most up-to-date slave
2. **Slave Failure**: Removes failed slave from rotation
3. **Network Partitions**: Prevents split-brain scenarios
4. **Replication Lag**: Removes lagging slaves from read rotation

### Manual Failover

```bash
# Test failover capability
./scripts/mysql-ha/manage-cluster.sh failover

# Force failover (emergency)
docker exec orchestrator orchestrator-client -c relocate -i mysql-slave-1:3306 -d mysql-master:3306
```

### Recovery Procedures

1. **Slave Recovery**:
   ```bash
   # Restart failed slave
   docker-compose -f docker-compose.mysql-ha.yml restart mysql-slave-1
   
   # Reconfigure replication
   ./scripts/mysql-ha/setup-replication.sh
   ```

2. **Master Recovery**:
   ```bash
   # After master replacement, update configuration
   # Orchestrator handles automatic promotion
   # Verify new topology
   curl http://localhost:3001/api/clusters
   ```

## Performance Tuning

### MySQL Configuration

**Master Optimizations**:
- `innodb_buffer_pool_size = 1G`
- `sync_binlog = 1`
- `innodb_flush_log_at_trx_commit = 1`

**Slave Optimizations**:
- `innodb_buffer_pool_size = 512M`
- `sync_binlog = 0`
- `innodb_flush_log_at_trx_commit = 2`
- `slave_parallel_workers = 4`

### ProxySQL Configuration

**Query Routing Rules**:
- `SELECT` queries → Slaves
- `INSERT/UPDATE/DELETE` → Master
- `SELECT ... FOR UPDATE` → Master
- Transactions → Sticky to Master

**Connection Pool Settings**:
- `max_connections = 500` per backend
- `monitor_ping_interval = 10000ms`
- `monitor_read_only_interval = 1500ms`

### Application Optimization

```php
// Use specific connections for heavy read operations
$users = DB::connection('mysql-slave-1')
    ->table('users')
    ->where('active', true)
    ->get();

// Force write operations to master
$user = DB::connection('mysql-master')
    ->table('users')
    ->create($userData);

// Use health service for intelligent routing
$healthService = app(DatabaseHealthService::class);
$bestReadConnection = $healthService->getBestReadConnection();
$data = DB::connection($bestReadConnection)->table('reports')->get();
```

## Security

### Network Security

- All databases run on isolated Docker network
- ProxySQL acts as database firewall
- Connection encryption available via SSL

### Access Control

```sql
-- Application Users
omni_user:      Read/Write on omni_portal database
omni_reader:    Read-only on omni_portal database

-- Administrative Users  
root:           Full administrative access
replicator:     Replication-only access
orchestrator:   Monitoring and failover management
proxysql:       Connection monitoring
backup_user:    Backup operations
```

### Backup Security

```bash
# Encrypted backups
./scripts/mysql-ha/manage-cluster.sh backup --compress --encrypt

# Secure backup storage
# Store backups in encrypted volumes or cloud storage with encryption
```

## Troubleshooting

### Common Issues

1. **Replication Lag**:
   ```bash
   # Check lag on slaves
   docker exec mysql-slave-1 mysql -uroot -p -e "SHOW SLAVE STATUS\\G" | grep Seconds_Behind_Master
   
   # Identify slow queries
   docker exec mysql-master mysql -uroot -p -e "SHOW PROCESSLIST"
   ```

2. **Connection Issues**:
   ```bash
   # Check ProxySQL backend status
   docker exec proxysql mysql -h127.0.0.1 -P6032 -uadmin -padmin -e "SELECT * FROM mysql_servers"
   
   # Test direct connections
   docker exec mysql-master mysql -uroot -p -e "SELECT 1"
   ```

3. **Failover Issues**:
   ```bash
   # Check Orchestrator status
   curl http://localhost:3001/api/status
   
   # View cluster topology
   curl http://localhost:3001/api/clusters
   ```

### Log Analysis

```bash
# View service logs
docker-compose -f docker-compose.mysql-ha.yml logs mysql-master
docker-compose -f docker-compose.mysql-ha.yml logs orchestrator

# View MySQL error logs
docker exec mysql-master tail -f /var/log/mysql/error.log

# View slow query logs
docker exec mysql-master tail -f /var/log/mysql/mysql-slow.log
```

### Recovery Procedures

1. **Split-Brain Recovery**:
   ```bash
   # Identify the correct master
   # Stop incorrect master
   # Reconfigure replication
   # Update application configuration
   ```

2. **Data Corruption Recovery**:
   ```bash
   # Stop affected instance
   # Restore from backup
   # Rebuild replication
   # Verify data consistency
   ```

## Maintenance

### Regular Tasks

1. **Daily**:
   - Monitor cluster health
   - Check replication lag
   - Review slow query logs

2. **Weekly**:
   - Create backups
   - Review performance metrics
   - Update monitoring dashboards

3. **Monthly**:
   - Test failover procedures
   - Review and optimize queries
   - Update system documentation

### Upgrade Procedures

1. **Rolling Upgrade**:
   ```bash
   # Upgrade slaves first
   docker-compose -f docker-compose.mysql-ha.yml pull mysql-slave-1
   docker-compose -f docker-compose.mysql-ha.yml up -d mysql-slave-1
   
   # Test and verify
   ./scripts/mysql-ha/health-check.sh
   
   # Failover to upgraded slave
   # Upgrade former master
   # Failover back if needed
   ```

### Backup Strategy

```bash
# Daily incremental backups
0 2 * * * /path/to/scripts/mysql-ha/manage-cluster.sh backup --incremental

# Weekly full backups
0 1 * * 0 /path/to/scripts/mysql-ha/manage-cluster.sh backup --compress

# Monthly archive backups
0 0 1 * * /path/to/scripts/mysql-ha/manage-cluster.sh backup --archive
```

## Best Practices

### Development

1. **Use Connection Abstraction**:
   ```php
   // Good: Use Laravel's read/write splitting
   $data = DB::table('users')->get();  // Automatically routed to slave
   
   // Avoid: Hardcoding connections unless necessary
   $data = DB::connection('mysql-slave-1')->table('users')->get();
   ```

2. **Handle Failover Gracefully**:
   ```php
   try {
       $result = DB::transaction(function () {
           // Database operations
       });
   } catch (QueryException $e) {
       // Retry logic for connection failures
       Log::warning('Database operation failed, retrying...', ['error' => $e->getMessage()]);
       // Implement exponential backoff retry
   }
   ```

### Operations

1. **Monitor Continuously**: Set up alerts for replication lag, connection failures, and performance degradation
2. **Test Regularly**: Run failover tests monthly in non-production environments
3. **Document Changes**: Keep detailed logs of configuration changes and maintenance activities
4. **Automate Recovery**: Implement automated recovery procedures where possible

### Security

1. **Rotate Passwords**: Regularly rotate database passwords
2. **Monitor Access**: Log and monitor all database access
3. **Encrypt Communications**: Use SSL for all database connections
4. **Secure Backups**: Encrypt and securely store all database backups

## Support and Resources

### Documentation Files

- `docker-compose.mysql-ha.yml`: Complete cluster configuration
- `scripts/mysql-ha/setup-replication.sh`: Replication setup automation
- `scripts/mysql-ha/health-check.sh`: Health monitoring script
- `scripts/mysql-ha/manage-cluster.sh`: Cluster management utility
- `config/mysql-ha/`: Configuration files for all services

### Monitoring and Alerts

- Grafana dashboards for visual monitoring
- Prometheus metrics for alerting
- Health check endpoints for load balancer integration
- Automated backup verification

### Emergency Contacts

- **Database Issues**: Check Orchestrator dashboard first
- **Performance Issues**: Review Grafana dashboards
- **Failover Issues**: Consult Orchestrator logs and status

---

**Note**: This deployment is production-ready but should be thoroughly tested in your specific environment before production use. Adjust configurations based on your hardware, traffic patterns, and business requirements.