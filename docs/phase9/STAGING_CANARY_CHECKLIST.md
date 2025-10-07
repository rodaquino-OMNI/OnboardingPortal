# Staging Canary Deployment Checklist

**Phase:** 9 - Canary Deployment
**Environment:** Staging
**Version:** 1.0.0
**Last Updated:** 2025-10-06

---

## Pre-Deployment Verification

### Environment Readiness
- [ ] Staging database migrations applied and verified
- [ ] Feature flag service functional (`FeatureFlagService::isEnabled()`)
- [ ] Monitoring endpoints accessible (`/api/admin/metrics`)
- [ ] Prometheus exporter running (if configured)
- [ ] Admin authentication working
- [ ] Test user accounts available
- [ ] Backup created (database snapshot)
- [ ] Rollback script tested in dry-run mode

### Scripts Prepared
- [ ] `scripts/canary-rollout.sh` executable
- [ ] `scripts/canary-rollback.sh` executable
- [ ] Logs directory created (`logs/` and `logs/incidents/`)
- [ ] Slack/notification webhooks configured (optional)

### Team Readiness
- [ ] On-call engineer identified
- [ ] Rollback authority designated
- [ ] Communication channel active (Slack, etc.)
- [ ] Monitoring dashboard accessible to team
- [ ] Incident response plan reviewed

---

## Stage 1: 5% Canary (Initial Rollout)

**Duration:** 2-4 hours
**Target Users:** ~5% of staging users
**Rollback Threshold:** 3 consecutive SLO breaches

### Pre-Stage Checks
- [ ] Verify current flag state: 0% (disabled)
- [ ] Database connection healthy
- [ ] Cache service operational
- [ ] No active incidents in staging

### Deployment
```bash
# Execute rollout
./scripts/canary-rollout.sh 5

# Expected output:
# ✓ Valid stage: 5%
# ✓ Database connection OK
# ✓ Feature flag updated successfully
# ✓ Verification passed: 5%
```

- [ ] Rollout script completed successfully
- [ ] Feature flag verified at 5%
- [ ] Cache cleared and repopulated
- [ ] No errors in application logs

### Monitoring (First 30 Minutes - Critical Window)

**Performance Metrics:**
- [ ] p95 latency: **<500ms** (check every 5 min)
- [ ] p99 latency: **<1000ms** (check every 5 min)
- [ ] Average latency trending stable

**Query to verify:**
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/api/admin/metrics/canary" | jq '.performance'
```

**Expected Response:**
```json
{
  "p95_latency_ms": 385,
  "p99_latency_ms": 847,
  "target_p95_ms": 500,
  "target_p99_ms": 1000,
  "compliant": true
}
```

**Error Rate:**
- [ ] Overall error rate: **<1%** (check every 5 min)
- [ ] 5xx errors: <0.1% (critical)
- [ ] 4xx errors: <0.9%
- [ ] No timeout errors

**Analytics Ingestion:**
- [ ] Ingestion rate: **≥99.5%** (check every 5 min)
- [ ] Event volume normal (compare to baseline)
- [ ] No data loss detected
- [ ] All event types processing successfully

**Security Checks:**
- [ ] PII detector violations: **0** (continuous monitoring)
- [ ] Encryption coverage: **100%**
- [ ] No unauthorized access attempts
- [ ] Audit logs capturing all events

### Monitoring (Extended - Hours 1-4)

**Hourly Checks:**
- [ ] Hour 1: All metrics within target
  - [ ] p95 latency: ___ms / 500ms
  - [ ] Error rate: __% / 1.0%
  - [ ] Ingestion: __% / 99.5%
  - [ ] PII violations: 0

- [ ] Hour 2: All metrics within target
  - [ ] p95 latency: ___ms / 500ms
  - [ ] Error rate: __% / 1.0%
  - [ ] Ingestion: __% / 99.5%
  - [ ] PII violations: 0

- [ ] Hour 3: All metrics within target (if 4h duration)
  - [ ] p95 latency: ___ms / 500ms
  - [ ] Error rate: __% / 1.0%
  - [ ] Ingestion: __% / 99.5%
  - [ ] PII violations: 0

- [ ] Hour 4: All metrics within target (if 4h duration)
  - [ ] p95 latency: ___ms / 500ms
  - [ ] Error rate: __% / 1.0%
  - [ ] Ingestion: __% / 99.5%
  - [ ] PII violations: 0

### Accessibility Verification (Stage 1 Only)
- [ ] Run automated a11y smoke test on canary endpoints
- [ ] Verify WCAG 2.1 AA compliance maintained
- [ ] Check screen reader compatibility (if applicable)
- [ ] Validate keyboard navigation working

**Test Command:**
```bash
# Example with axe-core or pa11y
npm run test:a11y -- --url="http://localhost:3000/documents"
```

### User Feedback Collection
- [ ] No critical bugs reported by canary users
- [ ] No usability issues logged
- [ ] Analytics events showing normal user behavior
- [ ] No increase in support tickets

### Stage 1 Decision Point

**Go-Criteria (Proceed to Stage 2):**
- ✅ All SLOs met for minimum 2 hours
- ✅ Zero PII violations detected
- ✅ No critical bugs or incidents
- ✅ Team consensus to proceed

**No-Go Criteria (Rollback):**
- ❌ Any SLO breach sustained >90 seconds
- ❌ Any PII violation detected
- ❌ Critical bug affecting functionality
- ❌ Auto-rollback triggered (3 breaches)

**Decision:** [ ] PROCEED TO STAGE 2 / [ ] ROLLBACK

**Recorded By:** ________________
**Timestamp:** ________________

---

## Stage 2: 25% Canary (Expanded Rollout)

**Duration:** 2 hours
**Target Users:** ~25% of staging users
**Rollback Threshold:** 3 consecutive SLO breaches

### Pre-Stage Checks
- [ ] Stage 1 completed successfully
- [ ] Verify current flag state: 5%
- [ ] No open incidents from Stage 1
- [ ] All monitoring systems operational

### Deployment
```bash
./scripts/canary-rollout.sh 25
```

- [ ] Rollout script completed successfully
- [ ] Feature flag verified at 25%
- [ ] Increased cohort size reflected in metrics
- [ ] No errors during transition

### Monitoring (Hours 1-2)

**Performance Metrics:**
- [ ] p95 latency: **<500ms** (check every 10 min)
- [ ] p99 latency: **<1000ms** (check every 10 min)
- [ ] Latency stable with increased load

**Error Rate:**
- [ ] Overall error rate: **<1%** (check every 10 min)
- [ ] Error rate not increasing with scale
- [ ] No new error types appearing

**Analytics Ingestion:**
- [ ] Ingestion rate: **≥99.5%** (check every 10 min)
- [ ] Event volume scales proportionally (5x increase expected)
- [ ] No bottlenecks detected

**Security Checks:**
- [ ] PII detector violations: **0**
- [ ] Encryption coverage: **100%**
- [ ] No security alerts triggered

### Load Validation
- [ ] System handling 5x increased canary load
- [ ] Database query performance stable
- [ ] Cache hit rate maintained (>85%)
- [ ] Memory usage within normal range
- [ ] CPU utilization acceptable (<70%)

### Hourly Checks
- [ ] Hour 1: All metrics within target
  - [ ] p95 latency: ___ms / 500ms
  - [ ] Error rate: __% / 1.0%
  - [ ] Ingestion: __% / 99.5%
  - [ ] Cohort size: ___ users (25%)

- [ ] Hour 2: All metrics within target
  - [ ] p95 latency: ___ms / 500ms
  - [ ] Error rate: __% / 1.0%
  - [ ] Ingestion: __% / 99.5%
  - [ ] No performance degradation observed

### Stage 2 Decision Point

**Go-Criteria (Proceed to Stage 3):**
- ✅ All SLOs met for 2 hours
- ✅ Zero PII violations detected
- ✅ System scales well with increased load
- ✅ No critical issues

**No-Go Criteria (Rollback):**
- ❌ Any SLO breach sustained >90 seconds
- ❌ Any PII violation detected
- ❌ Performance degradation detected
- ❌ Auto-rollback triggered

**Decision:** [ ] PROCEED TO STAGE 3 / [ ] ROLLBACK

**Recorded By:** ________________
**Timestamp:** ________________

---

## Stage 3: 50% Canary (Half Traffic)

**Duration:** 4 hours
**Target Users:** ~50% of staging users
**Rollback Threshold:** 3 consecutive SLO breaches

### Pre-Stage Checks
- [ ] Stage 2 completed successfully
- [ ] Verify current flag state: 25%
- [ ] System resources adequate for 2x load increase
- [ ] No active performance warnings

### Deployment
```bash
./scripts/canary-rollout.sh 50
```

- [ ] Rollout script completed successfully
- [ ] Feature flag verified at 50%
- [ ] Half of users now in canary cohort
- [ ] Smooth transition observed

### Monitoring (Hours 1-4)

**Performance Metrics (Stricter SLOs):**
- [ ] p95 latency: **<450ms** (check every 15 min)
- [ ] p99 latency: **<900ms** (check every 15 min)
- [ ] Latency improving with scale (more cache hits)

**Error Rate (Stricter SLOs):**
- [ ] Overall error rate: **<0.8%** (check every 15 min)
- [ ] Error rate stable or decreasing
- [ ] No cascading failures

**Analytics Ingestion (Stricter SLOs):**
- [ ] Ingestion rate: **≥99.7%** (check every 15 min)
- [ ] Event volume at 10x baseline (50% of traffic)
- [ ] Processing latency acceptable
- [ ] Queue depths normal

**Security Checks:**
- [ ] PII detector violations: **0**
- [ ] Encryption coverage: **100%**
- [ ] Audit trail complete

### Production-Like Load Testing
- [ ] System stable under 50% production-equivalent load
- [ ] Database connections pooled efficiently
- [ ] No memory leaks detected
- [ ] Worker queues processing efficiently

### Hourly Checks
- [ ] Hour 1: All metrics within target
  - [ ] p95 latency: ___ms / 450ms
  - [ ] Error rate: __% / 0.8%
  - [ ] Ingestion: __% / 99.7%

- [ ] Hour 2: All metrics within target
  - [ ] p95 latency: ___ms / 450ms
  - [ ] Error rate: __% / 0.8%
  - [ ] Ingestion: __% / 99.7%

- [ ] Hour 3: All metrics within target
  - [ ] p95 latency: ___ms / 450ms
  - [ ] Error rate: __% / 0.8%
  - [ ] Ingestion: __% / 99.7%

- [ ] Hour 4: All metrics within target
  - [ ] p95 latency: ___ms / 450ms
  - [ ] Error rate: __% / 0.8%
  - [ ] Ingestion: __% / 99.7%

### Stage 3 Decision Point

**Go-Criteria (Proceed to Stage 4):**
- ✅ All SLOs met for 4 hours
- ✅ Zero PII violations detected
- ✅ System performs better at scale
- ✅ Ready for full production rollout

**No-Go Criteria (Rollback):**
- ❌ Any SLO breach sustained >90 seconds
- ❌ Any PII violation detected
- ❌ Resource exhaustion detected
- ❌ Auto-rollback triggered

**Decision:** [ ] PROCEED TO STAGE 4 / [ ] ROLLBACK

**Recorded By:** ________________
**Timestamp:** ________________

---

## Stage 4: 100% Rollout (Full Deployment)

**Duration:** 24 hours (then monitor indefinitely)
**Target Users:** 100% of staging users
**Rollback Threshold:** 3 consecutive SLO breaches

### Pre-Stage Checks
- [ ] Stage 3 completed successfully
- [ ] Verify current flag state: 50%
- [ ] All team members briefed on full rollout
- [ ] Incident response team available for 24h

### Deployment
```bash
./scripts/canary-rollout.sh 100
```

- [ ] Rollout script completed successfully
- [ ] Feature flag verified at 100%
- [ ] All users now on Phase 8 enhancements
- [ ] Baseline traffic restored

### Monitoring (First 4 Hours - Critical Period)

**Performance Metrics (Production-Grade SLOs):**
- [ ] p95 latency: **<400ms** (check every 15 min)
- [ ] p99 latency: **<800ms** (check every 15 min)
- [ ] Optimal performance achieved

**Error Rate (Production-Grade SLOs):**
- [ ] Overall error rate: **<0.5%** (check every 15 min)
- [ ] Minimal errors expected
- [ ] All error types known and acceptable

**Analytics Ingestion (Production-Grade SLOs):**
- [ ] Ingestion rate: **≥99.9%** (check every 15 min)
- [ ] Full event volume processing smoothly
- [ ] No data loss or delays

**Security Checks:**
- [ ] PII detector violations: **0**
- [ ] Encryption coverage: **100%**
- [ ] Complete audit trail maintained

### Extended Monitoring (24 Hours)

**4-Hour Intervals:**
- [ ] Hours 0-4: All metrics within target
  - [ ] p95 latency: ___ms / 400ms
  - [ ] Error rate: __% / 0.5%
  - [ ] Ingestion: __% / 99.9%

- [ ] Hours 4-8: All metrics within target
  - [ ] p95 latency: ___ms / 400ms
  - [ ] Error rate: __% / 0.5%
  - [ ] Ingestion: __% / 99.9%

- [ ] Hours 8-12: All metrics within target
  - [ ] p95 latency: ___ms / 400ms
  - [ ] Error rate: __% / 0.5%
  - [ ] Ingestion: __% / 99.9%

- [ ] Hours 12-16: All metrics within target
  - [ ] p95 latency: ___ms / 400ms
  - [ ] Error rate: __% / 0.5%
  - [ ] Ingestion: __% / 99.9%

- [ ] Hours 16-20: All metrics within target
  - [ ] p95 latency: ___ms / 400ms
  - [ ] Error rate: __% / 0.5%
  - [ ] Ingestion: __% / 99.9%

- [ ] Hours 20-24: All metrics within target
  - [ ] p95 latency: ___ms / 400ms
  - [ ] Error rate: __% / 0.5%
  - [ ] Ingestion: __% / 99.9%

### Full System Validation
- [ ] All features functioning correctly at 100%
- [ ] No user complaints or critical bugs
- [ ] Database performance stable
- [ ] Caching optimized and efficient
- [ ] Worker queues processing smoothly
- [ ] Memory usage stable over 24h
- [ ] No resource leaks detected

### Stage 4 Completion

**Success Criteria:**
- ✅ All SLOs met for 24 hours
- ✅ Zero PII violations in entire 24h period
- ✅ No critical incidents
- ✅ System stable and performant
- ✅ User feedback positive or neutral

**Rollback (if needed):**
- ❌ Any sustained SLO breach
- ❌ Any PII violation detected
- ❌ Critical bug affecting users
- ❌ Data integrity issue discovered

**Final Decision:** [ ] STAGING ROLLOUT SUCCESSFUL / [ ] ROLLBACK REQUIRED

**Recorded By:** ________________
**Timestamp:** ________________

---

## Post-Rollout Activities

### Documentation
- [ ] Update feature flag documentation
- [ ] Document any issues encountered and resolutions
- [ ] Capture final performance metrics for baseline
- [ ] Update runbook with lessons learned

### Production Planning
- [ ] Review staging rollout results with team
- [ ] Adjust production rollout plan if needed
- [ ] Schedule production canary deployment
- [ ] Brief production on-call team

### Cleanup
- [ ] Archive rollout logs
- [ ] Export metrics for historical analysis
- [ ] Create rollout summary report
- [ ] Update monitoring dashboard for production

---

## Emergency Contacts

**On-Call Engineer:** ________________
**Rollback Authority:** ________________
**Team Lead:** ________________

## Emergency Rollback

**If any critical issue occurs:**

```bash
# Execute emergency rollback
./scripts/canary-rollback.sh "Brief reason for rollback"

# Verify rollback completed
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/api/admin/feature-flags/status"

# Expected: All flags at 0%, disabled
```

**Rollback SLA:** <20 seconds execution time

---

## Notes and Observations

**Stage 1 Notes:**
```
[Record any observations, anomalies, or decisions made during Stage 1]
```

**Stage 2 Notes:**
```
[Record any observations, anomalies, or decisions made during Stage 2]
```

**Stage 3 Notes:**
```
[Record any observations, anomalies, or decisions made during Stage 3]
```

**Stage 4 Notes:**
```
[Record any observations, anomalies, or decisions made during Stage 4]
```

---

**Checklist Completed By:** ________________
**Final Sign-Off Date:** ________________
**Status:** [ ] SUCCESS / [ ] ROLLBACK / [ ] IN PROGRESS
