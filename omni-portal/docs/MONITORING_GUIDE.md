# Omni Portal Monitoring Stack Guide

This comprehensive monitoring solution provides observability for the Omni Portal application using industry-standard tools: Prometheus, Grafana, Loki, and Jaeger.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │    │   Monitoring    │    │   Alerting      │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │  Next.js    │ │────┤ │ Prometheus  │ │────┤ │AlertManager │ │
│ │  Frontend   │ │    │ │   Metrics   │ │    │ │   Alerts    │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │  Laravel    │ │────┤ │   Grafana   │ │────┤ │    Slack    │ │
│ │  Backend    │ │    │ │ Dashboards  │ │    │ │    Email    │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ │   Webhook   │ │
│                 │    │                 │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    └─────────────────┘
│ │   MySQL     │ │────┤ │    Loki     │ │
│ │  Database   │ │    │ │    Logs     │ │
│ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │    Redis    │ │────┤ │   Jaeger    │ │
│ │    Cache    │ │    │ │   Traces    │ │
│ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### 1. Setup Monitoring Stack

```bash
# Make setup script executable
chmod +x scripts/monitoring-setup.sh

# Run full setup
./scripts/monitoring-setup.sh setup
```

### 2. Manual Setup (Alternative)

```bash
# Start monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# Check services are running
docker-compose -f docker-compose.monitoring.yml ps
```

## 📊 Service Overview

| Service | Port | Purpose | URL |
|---------|------|---------|-----|
| **Grafana** | 3001 | Dashboards & Visualization | http://localhost:3001 |
| **Prometheus** | 9090 | Metrics Collection | http://localhost:9090 |
| **Loki** | 3100 | Log Aggregation | http://localhost:3100 |
| **Jaeger** | 16686 | Distributed Tracing | http://localhost:16686 |
| **AlertManager** | 9093 | Alert Management | http://localhost:9093 |
| **Node Exporter** | 9100 | System Metrics | http://localhost:9100 |

### Default Credentials

- **Grafana**: `admin` / `admin123`

## 🔧 Configuration

### Prometheus Configuration

The Prometheus configuration includes:

- **Scrape Intervals**: 15s default, 5s for Prometheus self-monitoring
- **Retention**: 15 days, 5GB storage limit
- **Service Discovery**: Static configuration for all exporters
- **Recording Rules**: Pre-computed aggregations for common queries
- **Alert Rules**: Comprehensive alerting for system and application metrics

Key scrape targets:
- Laravel application (`backend:8000/metrics`)
- Next.js application (`frontend:3000/api/metrics`)
- MySQL exporter (`mysql-exporter:9104`)
- Redis exporter (`redis-exporter:9121`)
- Node exporter (`node-exporter:9100`)

### Grafana Dashboards

Pre-configured dashboards include:

1. **System Overview** (`/monitoring/grafana/dashboards/system/`)
   - CPU, Memory, Disk usage
   - Network I/O
   - System load

2. **Application Performance** (`/monitoring/grafana/dashboards/application/`)
   - Request rates and response times
   - Error rates
   - Service availability

3. **Database Performance** (`/monitoring/grafana/dashboards/database/`)
   - MySQL connections and query rates
   - Redis connections and command rates
   - Database response times

### Loki Configuration

Log aggregation setup:

- **Retention**: 31 days
- **Ingestion Limits**: 16MB/s rate, 32MB burst
- **Storage**: Local filesystem with BoltDB indexing
- **Log Sources**:
  - Docker container logs
  - Laravel application logs
  - Next.js application logs
  - System logs (syslog)
  - Nginx access logs
  - MySQL error logs
  - Redis logs

### Jaeger Configuration

Distributed tracing features:

- **Storage**: Badger (embedded database)
- **Sampling**: 10% default sampling rate
- **Ports**:
  - `16686`: Jaeger UI
  - `14268`: HTTP collector
  - `14250`: gRPC collector
  - `6831/6832`: UDP agent

## 📈 Metrics and Alerting

### Key Metrics

**System Metrics:**
- `node_cpu_seconds_total` - CPU usage
- `node_memory_MemTotal_bytes` - Memory usage
- `node_filesystem_size_bytes` - Disk usage
- `node_network_receive_bytes_total` - Network I/O

**Application Metrics:**
- `http_requests_total` - HTTP request count
- `http_request_duration_seconds` - Request duration
- `laravel_queue_jobs_total` - Queue job metrics
- `nextjs_page_views_total` - Page view metrics

**Database Metrics:**
- `mysql_global_status_queries` - MySQL queries
- `mysql_global_status_threads_connected` - MySQL connections
- `redis_connected_clients` - Redis connections
- `redis_commands_total` - Redis commands

### Alert Rules

Critical alerts include:

- **High CPU Usage** (>80% for 5 minutes)
- **High Memory Usage** (>90% for 5 minutes)
- **High Disk Usage** (>85% for 5 minutes)
- **Service Down** (service unavailable for 1 minute)
- **High Error Rate** (>5% for 5 minutes)
- **High Response Time** (P95 >2s for 5 minutes)
- **Database Connection Issues**
- **Queue Job Failures**

### Alert Notifications

Configure alert destinations in `/monitoring/alertmanager/alertmanager.yml`:

```yaml
# Slack notifications
slack_configs:
- api_url: 'YOUR_SLACK_WEBHOOK_URL'
  channel: '#alerts'

# Email notifications
email_configs:
- to: 'alerts@your-domain.com'
  subject: 'Alert: {{ .GroupLabels.alertname }}'
```

## 🔍 Distributed Tracing

### Laravel Instrumentation

The Laravel application includes automatic instrumentation for:

- HTTP requests and responses
- Database queries
- Cache operations
- Queue jobs
- Custom business logic

### Next.js Instrumentation

The Next.js application includes instrumentation for:

- Fetch API calls
- XMLHttpRequest
- User interactions
- Page load performance
- API route calls

### Custom Tracing

Add custom spans in your code:

**Laravel:**
```php
use OpenTelemetry\API\Globals;

$tracer = Globals::tracerProvider()->getTracer('my-service');
$span = $tracer->spanBuilder('custom-operation')->startSpan();

try {
    // Your code here
    $span->setAttributes(['user.id' => $userId]);
} finally {
    $span->end();
}
```

**Next.js:**
```typescript
import { withTracing } from '@/lib/tracing';

const result = await withTracing('api-call', async () => {
    return fetch('/api/data');
}, { 'user.id': userId });
```

## 📝 Log Aggregation

### Log Collection

Promtail collects logs from:

- Docker containers (`/var/lib/docker/containers`)
- Application log files
- System logs
- Web server logs

### Log Parsing

Automatic parsing for:

- JSON structured logs
- Laravel log format
- Nginx access logs
- MySQL error logs
- Redis logs

### Querying Logs

Example Loki queries:

```logql
# Laravel errors
{job="laravel"} |= "ERROR"

# HTTP 5xx errors
{job="nginx"} | json | status >= 500

# Database connection errors
{job="mysql"} |= "connection"

# Trace correlation
{job="laravel"} | json | traceID="abc123"
```

## 🛠️ Maintenance

### Backup and Restore

```bash
# Backup monitoring data
docker-compose -f docker-compose.monitoring.yml exec prometheus \
    tar czf /prometheus/backup-$(date +%Y%m%d).tar.gz /prometheus

# Backup Grafana dashboards
docker-compose -f docker-compose.monitoring.yml exec grafana \
    tar czf /var/lib/grafana/backup-$(date +%Y%m%d).tar.gz /var/lib/grafana
```

### Log Rotation

Loki automatically handles log retention based on configuration. For manual cleanup:

```bash
# Clean old logs
docker-compose -f docker-compose.monitoring.yml exec loki \
    rm -rf /loki/chunks/fake
```

### Performance Tuning

For high-volume environments:

1. **Increase resource limits** in docker-compose.monitoring.yml
2. **Adjust retention periods** in configuration files
3. **Optimize scrape intervals** based on requirements
4. **Configure remote storage** for long-term retention

## 🚨 Troubleshooting

### Common Issues

**Services not starting:**
```bash
# Check logs
docker-compose -f docker-compose.monitoring.yml logs [service]

# Check resource usage
docker stats
```

**High memory usage:**
```bash
# Reduce retention periods
# Increase scrape intervals
# Enable metric relabeling to drop unused metrics
```

**Missing metrics:**
```bash
# Verify service discovery
curl http://localhost:9090/api/v1/targets

# Check exporter endpoints
curl http://localhost:9104/metrics  # MySQL
curl http://localhost:9121/metrics  # Redis
```

### Service Commands

```bash
# Start services
./scripts/monitoring-setup.sh start

# Stop services
./scripts/monitoring-setup.sh stop

# Restart services
./scripts/monitoring-setup.sh restart

# Check status
./scripts/monitoring-setup.sh status

# View logs
./scripts/monitoring-setup.sh logs [service]

# Clean up (removes all data)
./scripts/monitoring-setup.sh clean
```

## 🔐 Security Considerations

1. **Change default passwords** in production
2. **Configure TLS/SSL** for external access
3. **Implement authentication** for Grafana and Prometheus
4. **Restrict network access** using firewalls
5. **Regularly update** monitoring stack images
6. **Encrypt sensitive data** in alert configurations

## 📚 Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)

## 🆘 Support

For issues with the monitoring stack:

1. Check service logs using the monitoring setup script
2. Verify configuration files in `/monitoring/` directories
3. Ensure all required ports are available
4. Check Docker resource limits
5. Review alert configurations for proper notification setup

The monitoring stack provides comprehensive observability for the Omni Portal application, enabling proactive monitoring, quick troubleshooting, and performance optimization.