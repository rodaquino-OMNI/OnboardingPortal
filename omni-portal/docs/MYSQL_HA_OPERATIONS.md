# MySQL High Availability Operations Manual

## Daily Operations

### Health Check Routine

Execute these commands daily to ensure cluster health:

```bash
# Quick health status
./scripts/mysql-ha/manage-cluster.sh status

# Comprehensive health check
./scripts/mysql-ha/health-check.sh

# Check replication lag
curl -s http://localhost/api/health/database/replication | jq '.'

# Monitor active connections
curl -s http://localhost/api/health/database/statistics | jq '.'
```

### Performance Monitoring

```bash
# Check slow queries
docker exec mysql-master mysql -uroot -p -e "
SELECT query_time, sql_text 
FROM mysql.slow_log 
WHERE start_time > NOW() - INTERVAL 1 DAY 
ORDER BY query_time DESC 
LIMIT 10;"

# Monitor replication lag
docker exec mysql-slave-1 mysql -uroot -p -e "SHOW SLAVE STATUS\G" | grep Seconds_Behind_Master
docker exec mysql-slave-2 mysql -uroot -p -e "SHOW SLAVE STATUS\G" | grep Seconds_Behind_Master

# Check ProxySQL connection pool
docker exec proxysql mysql -h127.0.0.1 -P6032 -uadmin -padmin -e "
SELECT srv_host, srv_port, status, ConnUsed, ConnFree, ConnOK, ConnERR 
FROM stats_mysql_connection_pool;"
```

## Weekly Operations

### Backup Procedures

```bash
# Create weekly full backup
./scripts/mysql-ha/manage-cluster.sh backup --compress

# Verify backup integrity
backup_file=$(ls -t ./backups/mysql-ha/*.sql.gz | head -1)
gunzip -t "$backup_file" && echo "Backup integrity verified"

# Test backup restoration (on test environment)
./scripts/mysql-ha/manage-cluster.sh restore "$backup_file"
```

### Performance Review

```bash
# Generate performance report
./scripts/mysql-ha/health-check.sh --report

# Review top queries by execution time
docker exec mysql-master mysql -uroot -p -e "
SELECT DIGEST_TEXT, COUNT_STAR, AVG_TIMER_WAIT/1000000000 as avg_time_sec
FROM performance_schema.events_statements_summary_by_digest 
ORDER BY AVG_TIMER_WAIT DESC 
LIMIT 20;"

# Check index usage
docker exec mysql-master mysql -uroot -p -e "
SELECT OBJECT_SCHEMA, OBJECT_NAME, INDEX_NAME, COUNT_READ, COUNT_WRITE 
FROM performance_schema.table_io_waits_summary_by_index_usage 
WHERE OBJECT_SCHEMA = 'omni_portal' 
ORDER BY COUNT_READ DESC 
LIMIT 20;"
```

## Monthly Operations

### Failover Testing

```bash
# Test automatic failover (in maintenance window)
./scripts/mysql-ha/manage-cluster.sh failover

# Manual failover test
# 1. Stop master gracefully
docker-compose -f docker-compose.mysql-ha.yml stop mysql-master

# 2. Verify Orchestrator promotes slave
curl http://localhost:3001/api/clusters

# 3. Test application connectivity
curl http://localhost/api/health/database

# 4. Restart original master (now slave)
docker-compose -f docker-compose.mysql-ha.yml start mysql-master

# 5. Verify replication setup
./scripts/mysql-ha/health-check.sh
```

### Security Maintenance

```bash
# Rotate database passwords
# 1. Generate new passwords
NEW_ROOT_PASS=$(openssl rand -base64 32)
NEW_REPL_PASS=$(openssl rand -base64 32)

# 2. Update passwords on all instances
docker exec mysql-master mysql -uroot -p -e "ALTER USER 'root'@'%' IDENTIFIED BY '$NEW_ROOT_PASS';"
docker exec mysql-master mysql -uroot -p -e "ALTER USER 'replicator'@'%' IDENTIFIED BY '$NEW_REPL_PASS';"

# 3. Update environment variables
# Update .env file with new passwords

# 4. Restart services to use new credentials
./scripts/mysql-ha/manage-cluster.sh restart
```

## Emergency Procedures

### Master Database Failure

```bash
# 1. Verify master is down
docker exec mysql-master mysql -uroot -p -e "SELECT 1" 2>/dev/null || echo "Master is down"

# 2. Check Orchestrator status
curl http://localhost:3001/api/status

# 3. Verify automatic failover occurred
curl http://localhost:3001/api/clusters | jq '.[] | select(.ClusterName=="omni-portal-cluster")'

# 4. Test application connectivity
curl http://localhost/api/health/database

# 5. If manual intervention needed:
# Get best slave candidate
curl http://localhost:3001/api/cluster/omni-portal-cluster

# Promote specific slave
curl -X POST http://localhost:3001/api/master-failover/mysql-slave-1/3306
```

### Slave Database Failure

```bash
# 1. Identify failed slave
./scripts/mysql-ha/manage-cluster.sh status

# 2. Remove from ProxySQL rotation
docker exec proxysql mysql -h127.0.0.1 -P6032 -uadmin -padmin -e "
UPDATE mysql_servers SET status='OFFLINE_SOFT' WHERE hostname='mysql-slave-1';
LOAD MYSQL SERVERS TO RUNTIME;"

# 3. Restart failed slave
docker-compose -f docker-compose.mysql-ha.yml restart mysql-slave-1

# 4. Verify replication recovery
docker exec mysql-slave-1 mysql -uroot -p -e "SHOW SLAVE STATUS\G"

# 5. Re-enable in ProxySQL
docker exec proxysql mysql -h127.0.0.1 -P6032 -uadmin -padmin -e "
UPDATE mysql_servers SET status='ONLINE' WHERE hostname='mysql-slave-1';
LOAD MYSQL SERVERS TO RUNTIME;"
```

### ProxySQL Failure

```bash
# 1. Verify ProxySQL status
docker exec proxysql mysql -h127.0.0.1 -P6032 -uadmin -padmin -e "SELECT 1" 2>/dev/null || echo "ProxySQL is down"

# 2. Switch application to direct master connection
# Update .env temporarily:
# DB_CONNECTION=mysql-master

# 3. Restart ProxySQL
docker-compose -f docker-compose.mysql-ha.yml restart proxysql

# 4. Verify ProxySQL recovery
./scripts/mysql-ha/health-check.sh

# 5. Switch back to HA configuration
# DB_CONNECTION=mysql-ha
```

### Orchestrator Failure

```bash
# 1. Check Orchestrator status
curl http://localhost:3001/api/status 2>/dev/null || echo "Orchestrator is down"

# 2. Restart Orchestrator
docker-compose -f docker-compose.mysql-ha.yml restart orchestrator

# 3. Verify cluster discovery
sleep 30
curl http://localhost:3001/api/clusters

# 4. If cluster not discovered, trigger discovery
curl -X POST http://localhost:3001/api/discover/mysql-master/3306
```

### Data Corruption Recovery

```bash
# 1. Identify corruption scope
docker exec mysql-master mysql -uroot -p -e "CHECK TABLE omni_portal.users;"

# 2. Stop affected slave(s)
docker-compose -f docker-compose.mysql-ha.yml stop mysql-slave-1

# 3. Restore from backup
backup_file=$(ls -t ./backups/mysql-ha/*.sql.gz | head -1)
./scripts/mysql-ha/manage-cluster.sh restore "$backup_file"

# 4. Rebuild replication
./scripts/mysql-ha/setup-replication.sh

# 5. Verify data consistency
./scripts/mysql-ha/health-check.sh
```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Replication Lag**: Should be < 5 seconds
2. **Connection Pool**: Usage should be < 80%
3. **Query Response Time**: 95th percentile < 100ms
4. **Disk Space**: Should have > 20% free
5. **CPU Usage**: Should be < 80% sustained

### Alert Thresholds

```bash
# Replication lag alert (> 10 seconds)
curl -s http://localhost/api/health/database/replication | \
jq -r '.replication_lag[] | select(.seconds_behind_master > 10) | .connection'

# Connection pool alert (> 80% usage)
curl -s http://localhost/api/health/database/statistics | \
jq -r '.statistics[] | select(.threads_connected / .max_used_connections > 0.8)'

# Disk space alert
docker exec mysql-master df -h /var/lib/mysql | awk 'NR==2 {if(substr($5,1,length($5)-1) > 80) print "ALERT: Disk usage " $5}'
```

### Log Monitoring

```bash
# Monitor error logs for critical issues
docker exec mysql-master tail -f /var/log/mysql/error.log | grep -i "error\|warning\|critical"

# Monitor slow query log
docker exec mysql-master tail -f /var/log/mysql/mysql-slow.log

# Monitor ProxySQL logs
docker logs proxysql --tail 100 -f | grep -i "error\|warning"
```

## Performance Optimization

### Query Optimization

```bash
# Identify slow queries
docker exec mysql-master mysql -uroot -p -e "
SELECT DIGEST_TEXT, COUNT_STAR, AVG_TIMER_WAIT/1000000000 as avg_time_sec,
       MAX_TIMER_WAIT/1000000000 as max_time_sec
FROM performance_schema.events_statements_summary_by_digest 
WHERE AVG_TIMER_WAIT > 1000000000  -- > 1 second
ORDER BY AVG_TIMER_WAIT DESC 
LIMIT 10;"

# Check for full table scans
docker exec mysql-master mysql -uroot -p -e "
SELECT OBJECT_SCHEMA, OBJECT_NAME, COUNT_READ, COUNT_WRITE,
       SUM_TIMER_READ/1000000000 as read_time_sec
FROM performance_schema.table_io_waits_summary_by_table 
WHERE OBJECT_SCHEMA = 'omni_portal' 
AND COUNT_READ > 1000
ORDER BY SUM_TIMER_READ DESC 
LIMIT 10;"
```

### Index Optimization

```bash
# Find unused indexes
docker exec mysql-master mysql -uroot -p -e "
SELECT OBJECT_SCHEMA, OBJECT_NAME, INDEX_NAME 
FROM performance_schema.table_io_waits_summary_by_index_usage 
WHERE OBJECT_SCHEMA = 'omni_portal' 
AND INDEX_NAME IS NOT NULL 
AND COUNT_STAR = 0 
AND INDEX_NAME != 'PRIMARY';"

# Find duplicate indexes
docker exec mysql-master mysql -uroot -p -e "
SELECT TABLE_SCHEMA, TABLE_NAME, 
       GROUP_CONCAT(INDEX_NAME ORDER BY INDEX_NAME) as duplicate_indexes
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = 'omni_portal'
GROUP BY TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME 
HAVING COUNT(*) > 1;"
```

### Connection Pool Tuning

```bash
# Optimize ProxySQL connection pools
docker exec proxysql mysql -h127.0.0.1 -P6032 -uadmin -padmin -e "
UPDATE mysql_servers SET max_connections=200 WHERE hostgroup_id=0;
UPDATE mysql_servers SET max_connections=300 WHERE hostgroup_id=1;
LOAD MYSQL SERVERS TO RUNTIME;
SAVE MYSQL SERVERS TO DISK;"

# Monitor pool efficiency
docker exec proxysql mysql -h127.0.0.1 -P6032 -uadmin -padmin -e "
SELECT srv_host, srv_port, 
       ConnUsed, ConnFree, 
       ROUND(ConnUsed/(ConnUsed+ConnFree)*100,2) as usage_percent
FROM stats_mysql_connection_pool;"
```

## Maintenance Windows

### Pre-Maintenance Checklist

```bash
# 1. Create backup
./scripts/mysql-ha/manage-cluster.sh backup --compress

# 2. Verify cluster health
./scripts/mysql-ha/health-check.sh --report

# 3. Check replication lag
curl -s http://localhost/api/health/database/replication

# 4. Document current topology
curl http://localhost:3001/api/clusters > topology_before_maintenance.json

# 5. Notify applications (set maintenance mode)
# Update load balancer health checks if needed
```

### Post-Maintenance Checklist

```bash
# 1. Verify all services running
./scripts/mysql-ha/manage-cluster.sh status

# 2. Test replication
./scripts/mysql-ha/health-check.sh

# 3. Verify application connectivity
curl http://localhost/api/health/database

# 4. Check performance metrics
curl -s http://localhost/api/health/database/statistics

# 5. Compare topology
curl http://localhost:3001/api/clusters > topology_after_maintenance.json
diff topology_before_maintenance.json topology_after_maintenance.json

# 6. Clear maintenance mode
# Update load balancer health checks
```

## Troubleshooting Guide

### Connection Issues

```bash
# Test direct connections
mysql -h127.0.0.1 -P3306 -uomni_user -pomnipass123 omni_portal -e "SELECT 1"  # Master
mysql -h127.0.0.1 -P3307 -uomni_reader -pomnireader123 omni_portal -e "SELECT 1"  # Slave 1
mysql -h127.0.0.1 -P3308 -uomni_reader -pomnireader123 omni_portal -e "SELECT 1"  # Slave 2

# Test ProxySQL connection
mysql -h127.0.0.1 -P6033 -uomni_user -pomnipass123 omni_portal -e "SELECT 1"

# Check ProxySQL routing
docker exec proxysql mysql -h127.0.0.1 -P6032 -uadmin -padmin -e "
SELECT rule_id, match_pattern, destination_hostgroup, apply 
FROM mysql_query_rules 
WHERE active=1;"
```

### Replication Issues

```bash
# Check master status
docker exec mysql-master mysql -uroot -p -e "SHOW MASTER STATUS\G"

# Check slave status
docker exec mysql-slave-1 mysql -uroot -p -e "SHOW SLAVE STATUS\G"

# Fix common replication errors
docker exec mysql-slave-1 mysql -uroot -p -e "
STOP SLAVE;
SET GLOBAL sql_slave_skip_counter = 1;
START SLAVE;"

# Rebuild replication from scratch
./scripts/mysql-ha/setup-replication.sh
```

### Performance Issues

```bash
# Check current queries
docker exec mysql-master mysql -uroot -p -e "SHOW PROCESSLIST"

# Check locks
docker exec mysql-master mysql -uroot -p -e "
SELECT r.trx_id waiting_trx_id, r.trx_mysql_thread_id waiting_thread,
       r.trx_query waiting_query, b.trx_id blocking_trx_id,
       b.trx_mysql_thread_id blocking_thread, b.trx_query blocking_query
FROM information_schema.innodb_lock_waits w
INNER JOIN information_schema.innodb_trx b ON b.trx_id = w.blocking_trx_id
INNER JOIN information_schema.innodb_trx r ON r.trx_id = w.requesting_trx_id;"

# Check InnoDB status
docker exec mysql-master mysql -uroot -p -e "SHOW ENGINE INNODB STATUS\G"
```

This operations manual provides comprehensive procedures for managing the MySQL HA cluster in production. Always test procedures in a development environment first and ensure you have recent backups before performing any maintenance operations.