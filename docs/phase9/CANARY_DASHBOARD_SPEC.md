# Canary Deployment Dashboard Specification

**Version:** 1.0.0
**Last Updated:** 2025-10-06
**Phase:** 9 - Canary Deployment

---

## Overview

This specification defines the monitoring dashboard requirements for Phase 8 canary deployments. The dashboard provides real-time visibility into rollout health, SLO compliance, and auto-rollback status.

---

## Dashboard Layout

### 1. Header Section

**Components:**
- Current canary percentage (large, prominent)
- Active stage indicator (5%, 25%, 50%, 100%)
- Time elapsed in current stage
- Auto-rollback status (enabled/disabled)

**Example:**
```
┌────────────────────────────────────────────────────────┐
│  CANARY ROLLOUT: 25% (Stage 2)                        │
│  Time in Stage: 45m / 120m                            │
│  Auto-Rollback: ✓ ENABLED (0/3 breaches)             │
└────────────────────────────────────────────────────────┘
```

---

## Metrics to Monitor

### 2.1 Performance Metrics

#### p95 Latency
**Description:** 95th percentile response time for analytics endpoints
**Target:** Varies by stage (see SLO table)
**Collection:** Real-time, 30-second aggregation
**Alert Threshold:** >10% above target for 2 consecutive intervals

**Query:**
```sql
SELECT
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_latency,
    COUNT(*) as request_count
FROM analytics_metrics
WHERE created_at > NOW() - INTERVAL '30 seconds'
  AND endpoint LIKE '/api/analytics/%';
```

**Display:**
```
p95 Latency: 385ms / 500ms target
█████████████████░░░░ 77% of target
```

#### p99 Latency
**Description:** 99th percentile response time
**Target:** 2x p95 target
**Collection:** Real-time, 30-second aggregation

**Query:**
```sql
SELECT
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms) as p99_latency
FROM analytics_metrics
WHERE created_at > NOW() - INTERVAL '30 seconds'
  AND endpoint LIKE '/api/analytics/%';
```

---

### 2.2 Error Rate Metrics

#### Overall Error Rate
**Description:** Percentage of failed requests
**Target:** <1% (stage dependent)
**Collection:** Real-time, 1-minute window
**Alert Threshold:** Exceeds target for 3 consecutive minutes

**Query:**
```sql
SELECT
    (COUNT(*) FILTER (WHERE status >= 400) * 100.0 / COUNT(*)) as error_rate
FROM api_requests
WHERE created_at > NOW() - INTERVAL '1 minute'
  AND canary_cohort = true;
```

**Display:**
```
Error Rate: 0.42% / 1.00% target
Success: 99.58% (1,243 / 1,248 requests)
```

#### Error Breakdown by Type
**Categories:**
- 4xx Client Errors
- 5xx Server Errors
- Timeout Errors
- Validation Errors

**Display:**
```
Error Distribution (last 15min):
  4xx: 8 requests (0.32%)
  5xx: 2 requests (0.08%)
  Timeouts: 0 requests (0.00%)
  Validation: 5 requests (0.20%)
```

---

### 2.3 Analytics Metrics

#### Analytics Ingestion Rate
**Description:** Percentage of events successfully persisted
**Target:** ≥99.5% (stage dependent)
**Collection:** Real-time, 1-minute aggregation

**Query:**
```sql
SELECT
    (COUNT(*) FILTER (WHERE persisted = true) * 100.0 / COUNT(*)) as ingestion_rate,
    COUNT(*) as total_events
FROM analytics_events
WHERE created_at > NOW() - INTERVAL '1 minute'
  AND feature_flag_cohort = 'canary';
```

#### Analytics Event Types
**Tracked Events:**
- User actions (clicks, views, interactions)
- Document uploads/processing
- Gamification events (points, badges)
- Authentication events

**Display:**
```
Event Ingestion (last 5min):
  User Actions: 523 (100% success)
  Documents: 87 (99.8% success)
  Gamification: 142 (100% success)
  Auth: 234 (100% success)
```

---

### 2.4 Security Metrics

#### PII Detection Violations
**Description:** Count of PII found in unencrypted fields
**Target:** 0 violations
**Collection:** Real-time scanning
**Alert Threshold:** Any detection triggers immediate alert

**Query:**
```sql
SELECT
    COUNT(*) as pii_violations,
    json_agg(field_name) as affected_fields
FROM pii_scan_results
WHERE detected_at > NOW() - INTERVAL '5 minutes'
  AND violation = true;
```

**Display:**
```
PII Detector Status: ✓ CLEAN
Last Scan: 2 seconds ago
Total Scans (1h): 12,847
Violations: 0
```

#### Encryption Coverage
**Description:** Percentage of sensitive fields encrypted
**Target:** 100%
**Collection:** Periodic validation

---

### 2.5 User Experience Metrics

#### Canary Cohort Size
**Description:** Number of users in canary group
**Calculation:** `total_users * canary_percentage`

**Display:**
```
Canary Cohort:
  Active Users: 127 (25% of 508 active)
  Total Users: 3,456 (25% of 13,824 registered)
```

#### User Session Health
**Description:** Session stability for canary users
**Metrics:**
- Average session duration
- Session abandonment rate
- Error encounters per session

---

## Alert Thresholds

### 3.1 Critical Alerts (Immediate Action)

| Metric | Threshold | Action |
|--------|-----------|--------|
| PII Violation | Any detection | Immediate rollback + incident |
| Error Rate | >5% sustained | Auto-rollback trigger |
| p95 Latency | >2x target | Auto-rollback trigger |
| Analytics Ingestion | <95% | Investigation required |

### 3.2 Warning Alerts (Monitoring)

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error Rate | >1.5x target | Enhanced monitoring |
| p95 Latency | >1.2x target | Performance review |
| Cache Hit Rate | <85% | Cache optimization |

---

## Rollback Triggers

### 4.1 Automatic Rollback Conditions

**Trigger Logic:**
```javascript
if (consecutive_breaches >= 3) {
  triggerAutoRollback({
    reason: 'SLO breach threshold exceeded',
    breaches: breach_details,
    timestamp: now()
  });
}
```

**Breach Definitions:**
1. **Performance Breach:** p95 latency exceeds target by >10%
2. **Error Breach:** Error rate exceeds target
3. **Security Breach:** Any PII violation detected
4. **Availability Breach:** Analytics ingestion <99%

**Consecutive Breach Window:** 90 seconds (3x 30-second intervals)

### 4.2 Manual Rollback

**Conditions:**
- Unexpected behavior reported
- Data inconsistency detected
- External dependency failure
- Business decision

**Execution:** `./scripts/canary-rollback.sh "<reason>"`

---

## SLO Tracking Formulas

### 5.1 Stage-Based SLO Definitions

| Stage | p95 Latency | p99 Latency | Error Rate | Ingestion | Duration |
|-------|-------------|-------------|------------|-----------|----------|
| 5%    | <500ms      | <1000ms     | <1.0%      | ≥99.5%    | 2-4h     |
| 25%   | <500ms      | <1000ms     | <1.0%      | ≥99.5%    | 2h       |
| 50%   | <450ms      | <900ms      | <0.8%      | ≥99.7%    | 4h       |
| 100%  | <400ms      | <800ms      | <0.5%      | ≥99.9%    | 24h      |

### 5.2 SLO Compliance Calculation

**Formula:**
```javascript
slo_compliance = (
  (p95_compliant ? 25 : 0) +
  (p99_compliant ? 25 : 0) +
  (error_rate_compliant ? 25 : 0) +
  (ingestion_compliant ? 25 : 0)
) / 100;

// Target: >95% compliance
```

**Display:**
```
SLO Compliance: 98.5%
  ✓ p95 Latency: 100% compliant (385ms < 500ms)
  ✓ p99 Latency: 100% compliant (847ms < 1000ms)
  ✓ Error Rate: 100% compliant (0.42% < 1.0%)
  ✓ Ingestion: 95% compliant (99.6% > 99.5%)
```

---

## API Endpoints

### 6.1 Metrics Endpoints

#### GET /api/admin/metrics/canary
**Description:** Real-time canary metrics
**Auth:** Admin token required
**Response:**
```json
{
  "stage": {
    "current": 2,
    "percentage": 25,
    "elapsed_minutes": 45,
    "total_minutes": 120
  },
  "performance": {
    "p95_latency_ms": 385,
    "p99_latency_ms": 847,
    "target_p95_ms": 500,
    "target_p99_ms": 1000,
    "compliant": true
  },
  "errors": {
    "rate_percent": 0.42,
    "target_percent": 1.0,
    "compliant": true,
    "breakdown": {
      "4xx": 8,
      "5xx": 2,
      "timeouts": 0
    }
  },
  "analytics": {
    "ingestion_rate_percent": 99.6,
    "target_percent": 99.5,
    "compliant": true,
    "events_last_minute": 1847
  },
  "security": {
    "pii_violations": 0,
    "last_scan_seconds_ago": 2,
    "encryption_coverage_percent": 100
  },
  "cohort": {
    "active_users": 127,
    "total_users": 3456,
    "percentage": 25
  },
  "slo": {
    "overall_compliance_percent": 98.5,
    "auto_rollback_enabled": true,
    "breach_count": 0,
    "breach_threshold": 3
  }
}
```

#### GET /api/admin/analytics/performance
**Description:** Historical performance data
**Query Params:** `window=1h|6h|24h`

#### GET /api/admin/analytics/timeseries
**Description:** Time-series metrics for graphing
**Query Params:** `metric=latency|errors|ingestion&window=1h`

---

## Visualization Requirements

### 7.1 Real-Time Graphs

**Latency Graph:**
- X-axis: Time (last 1 hour, 5-minute intervals)
- Y-axis: Latency (ms)
- Lines: p50, p95, p99, target threshold
- Update interval: 30 seconds

**Error Rate Graph:**
- X-axis: Time (last 1 hour)
- Y-axis: Error rate (%)
- Bars: Error count
- Line: Error rate percentage
- Threshold line: Target error rate

**Analytics Ingestion:**
- X-axis: Time (last 1 hour)
- Y-axis: Events/minute
- Stacked bars: Event types
- Line: Ingestion success rate

### 7.2 Status Indicators

**Color Coding:**
- 🟢 Green: Within target
- 🟡 Yellow: Within 10% of target (warning)
- 🔴 Red: Exceeds target (breach)

---

## Prometheus Integration

### 8.1 Exposed Metrics

```promql
# Latency metrics
canary_latency_p95{stage="2",endpoint="/api/analytics/events"}
canary_latency_p99{stage="2",endpoint="/api/analytics/events"}

# Error rate
canary_error_rate{stage="2",type="4xx"}
canary_error_rate{stage="2",type="5xx"}

# Analytics ingestion
canary_analytics_ingestion_rate{stage="2"}
canary_analytics_events_total{stage="2",type="user_action"}

# Security
canary_pii_violations_total{stage="2"}
canary_encryption_coverage{stage="2"}

# SLO compliance
canary_slo_compliance{stage="2"}
canary_rollback_breaches{stage="2"}
```

### 8.2 Alert Rules

```yaml
groups:
  - name: canary_alerts
    interval: 30s
    rules:
      - alert: CanaryLatencyHigh
        expr: canary_latency_p95 > (canary_latency_target * 1.1)
        for: 90s
        labels:
          severity: warning
        annotations:
          summary: "Canary p95 latency exceeds target"

      - alert: CanaryErrorRateHigh
        expr: canary_error_rate > canary_error_rate_target
        for: 90s
        labels:
          severity: critical
        annotations:
          summary: "Canary error rate exceeds target"

      - alert: CanaryPIIViolation
        expr: canary_pii_violations_total > 0
        for: 0s
        labels:
          severity: critical
        annotations:
          summary: "PII violation detected - immediate rollback required"
```

---

## Dashboard Access

**URL:** `/admin/canary-dashboard`
**Auth:** Requires admin role
**Refresh Rate:** 5 seconds (configurable)

**Mobile Support:** Responsive design required for on-call monitoring

---

## References

- Feature Flag Config: `/config/feature-flags.php`
- Rollout Script: `/scripts/canary-rollout.sh`
- Rollback Script: `/scripts/canary-rollback.sh`
- Phase 9 Documentation: `/docs/phase9/`
