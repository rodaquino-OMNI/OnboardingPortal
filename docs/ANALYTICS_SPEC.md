# Analytics Specification - Onboarding Portal

**Version**: 1.0.0
**Last Updated**: 2025-09-30
**Status**: Production Analytics Design

---

## Table of Contents

1. [Event Taxonomy](#event-taxonomy)
2. [Funnel Metrics](#funnel-metrics)
3. [PII Handling Strategy](#pii-handling-strategy)
4. [A/B Testing Framework](#ab-testing-framework)
5. [Alert Thresholds](#alert-thresholds)
6. [Dashboard Specifications](#dashboard-specifications)
7. [Data Pipeline Architecture](#data-pipeline-architecture)

---

## Event Taxonomy

### Naming Convention

**Format**: `<namespace>.<action>_<object>`

**Namespaces**:
- `auth` - Authentication and session events
- `onboarding` - Multi-step onboarding flow
- `health` - Health questionnaire events
- `documents` - Document upload and OCR
- `interviews` - Interview scheduling
- `gamification` - Points, badges, levels
- `admin` - Admin actions
- `system` - System-level events

**Examples**:
- `auth.login_succeeded`
- `gamification.points_earned`
- `health.questionnaire_completed`
- `documents.upload_failed`

### Standard Event Schema

```json
{
  "schema_version": "1.0.0",
  "event": "<namespace>.<action>_<object>",
  "timestamp": "2025-09-30T10:00:00.000Z",
  "user_id": "hash_abc123",
  "session_id": "sess_xyz789",
  "platform": "web",
  "properties": {
    // Event-specific properties
  },
  "context": {
    "user_agent": "Mozilla/5.0...",
    "ip_address_hash": "hash_192.168.1.1",
    "screen_resolution": "1920x1080",
    "timezone": "America/Sao_Paulo",
    "referrer": "https://google.com"
  }
}
```

### Authentication Events

#### `auth.registration_started`
```json
{
  "event": "auth.registration_started",
  "timestamp": "2025-09-30T10:00:00Z",
  "properties": {
    "source": "landing_page_cta",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "onboarding_q4_2025"
  }
}
```

#### `auth.registration_completed`
```json
{
  "event": "auth.registration_completed",
  "timestamp": "2025-09-30T10:02:30Z",
  "user_id": "hash_abc123",
  "properties": {
    "time_to_complete_seconds": 150,
    "cpf_validation_passed": true,
    "email_domain": "gmail.com",
    "phone_validated": true,
    "lgpd_consent": true
  }
}
```

#### `auth.email_verified`
```json
{
  "event": "auth.email_verified",
  "timestamp": "2025-09-30T10:05:00Z",
  "user_id": "hash_abc123",
  "properties": {
    "verification_method": "email_link",
    "time_since_registration_seconds": 150
  }
}
```

#### `auth.login_succeeded`
```json
{
  "event": "auth.login_succeeded",
  "timestamp": "2025-09-30T11:00:00Z",
  "user_id": "hash_abc123",
  "session_id": "sess_new123",
  "properties": {
    "login_method": "email_password",
    "mfa_enabled": false,
    "session_fingerprint_match": true,
    "time_since_last_login_hours": 24
  }
}
```

#### `auth.login_failed`
```json
{
  "event": "auth.login_failed",
  "timestamp": "2025-09-30T11:00:00Z",
  "properties": {
    "failure_reason": "invalid_credentials",
    "attempt_number": 2,
    "account_locked": false
  }
}
```

### Gamification Events

#### `gamification.points_earned`
```json
{
  "event": "gamification.points_earned",
  "timestamp": "2025-09-30T10:03:00Z",
  "user_id": "hash_abc123",
  "session_id": "sess_xyz789",
  "properties": {
    "action_type": "document_uploaded",
    "points_amount": 75,
    "points_total_after": 825,
    "bonus_type": null,
    "related_entity_type": "document",
    "related_entity_id": 12345
  }
}
```

#### `gamification.level_up`
```json
{
  "event": "gamification.level_up",
  "timestamp": "2025-09-30T10:35:00Z",
  "user_id": "hash_abc123",
  "properties": {
    "old_level": "bronze",
    "new_level": "prata",
    "points_at_levelup": 700,
    "time_to_levelup_seconds": 2100,
    "benefits_unlocked": ["express_processing", "priority_support"]
  }
}
```

#### `gamification.badge_unlocked`
```json
{
  "event": "gamification.badge_unlocked",
  "timestamp": "2025-09-30T10:28:00Z",
  "user_id": "hash_abc123",
  "properties": {
    "badge_id": "health_champion",
    "badge_name": "Campeão da Saúde",
    "badge_category": "health_thoroughness",
    "badge_rarity": "uncommon",
    "points_awarded": 150
  }
}
```

#### `gamification.streak_updated`
```json
{
  "event": "gamification.streak_updated",
  "timestamp": "2025-09-30T10:40:00Z",
  "user_id": "hash_abc123",
  "properties": {
    "streak_days": 5,
    "longest_streak": 7,
    "streak_status": "active",
    "last_activity_date": "2025-09-30"
  }
}
```

### Health Events

#### `health.questionnaire_started`
```json
{
  "event": "health.questionnaire_started",
  "timestamp": "2025-09-30T10:10:00Z",
  "user_id": "hash_abc123",
  "properties": {
    "template_id": "default_v2",
    "total_questions": 25,
    "required_questions": 15,
    "optional_questions": 10
  }
}
```

#### `health.question_answered`
```json
{
  "event": "health.question_answered",
  "timestamp": "2025-09-30T10:11:30Z",
  "user_id": "hash_abc123",
  "properties": {
    "question_id": 5,
    "question_type": "required",
    "answer_type": "multiple_choice",
    "time_to_answer_seconds": 15,
    "validation_passed": true
  }
}
```

#### `health.questionnaire_completed`
```json
{
  "event": "health.questionnaire_completed",
  "timestamp": "2025-09-30T10:20:00Z",
  "user_id": "hash_abc123",
  "properties": {
    "template_id": "default_v2",
    "total_time_seconds": 600,
    "questions_answered": 25,
    "optional_questions_answered": 10,
    "completion_rate": 100.0,
    "validation_errors": 0
  }
}
```

#### `health.risk_score_calculated`
```json
{
  "event": "health.risk_score_calculated",
  "timestamp": "2025-09-30T10:20:05Z",
  "user_id": "hash_abc123",
  "properties": {
    "risk_score": 25.5,
    "risk_category": "low",
    "clinical_alerts_generated": 0,
    "processing_time_ms": 1200,
    "algorithm_version": "v2.1"
  }
}
```

### Document Events

#### `documents.upload_started`
```json
{
  "event": "documents.upload_started",
  "timestamp": "2025-09-30T10:25:00Z",
  "user_id": "hash_abc123",
  "properties": {
    "document_type": "rg_front",
    "file_size_bytes": 3670016,
    "file_format": "image/jpeg",
    "upload_method": "camera"
  }
}
```

#### `documents.upload_completed`
```json
{
  "event": "documents.upload_completed",
  "timestamp": "2025-09-30T10:25:30Z",
  "user_id": "hash_abc123",
  "properties": {
    "document_id": 12345,
    "document_type": "rg_front",
    "upload_duration_ms": 30000,
    "file_size_bytes": 3670016
  }
}
```

#### `documents.ocr_completed`
```json
{
  "event": "documents.ocr_completed",
  "timestamp": "2025-09-30T10:25:45Z",
  "user_id": "hash_abc123",
  "properties": {
    "document_id": 12345,
    "ocr_engine": "tesseract",
    "confidence_score": 0.95,
    "processing_time_ms": 8500,
    "text_extracted_length": 256,
    "fallback_used": false
  }
}
```

#### `documents.approved`
```json
{
  "event": "documents.approved",
  "timestamp": "2025-10-01T09:00:00Z",
  "user_id": "hash_abc123",
  "properties": {
    "document_id": 12345,
    "document_type": "rg_front",
    "approved_by": "admin_789",
    "time_to_approval_hours": 22.5,
    "manual_review_required": false
  }
}
```

### Interview Events

#### `interview.slot_viewed`
```json
{
  "event": "interview.slot_viewed",
  "timestamp": "2025-09-30T10:30:00Z",
  "user_id": "hash_abc123",
  "properties": {
    "selected_date": "2025-10-01",
    "available_slots": 12,
    "user_level": "prata"
  }
}
```

#### `interview.slot_booked`
```json
{
  "event": "interview.slot_booked",
  "timestamp": "2025-09-30T10:30:30Z",
  "user_id": "hash_abc123",
  "properties": {
    "interview_id": 456,
    "scheduled_date": "2025-10-01T09:00:00Z",
    "slot_type": "morning",
    "days_until_interview": 1,
    "booking_attempts": 1
  }
}
```

#### `interview.reminder_sent`
```json
{
  "event": "interview.reminder_sent",
  "timestamp": "2025-10-01T08:00:00Z",
  "user_id": "hash_abc123",
  "properties": {
    "interview_id": 456,
    "reminder_type": "1h_before",
    "channel": "sms",
    "hours_before_interview": 1
  }
}
```

#### `interview.attended`
```json
{
  "event": "interview.attended",
  "timestamp": "2025-10-01T09:01:30Z",
  "user_id": "hash_abc123",
  "properties": {
    "interview_id": 456,
    "joined_at": "2025-10-01T09:01:30Z",
    "punctuality_seconds": 90,
    "punctuality_bonus_earned": true
  }
}
```

### Onboarding Events

#### `onboarding.step_completed`
```json
{
  "event": "onboarding.step_completed",
  "timestamp": "2025-09-30T10:05:00Z",
  "user_id": "hash_abc123",
  "properties": {
    "step_name": "profile",
    "step_number": 2,
    "total_steps": 5,
    "time_spent_seconds": 120,
    "completion_percentage": 40.0
  }
}
```

#### `onboarding.completed`
```json
{
  "event": "onboarding.completed",
  "timestamp": "2025-10-01T09:30:00Z",
  "user_id": "hash_abc123",
  "properties": {
    "total_time_seconds": 3600,
    "total_points_earned": 2835,
    "final_level": "platina",
    "badges_unlocked": 12,
    "completion_rate": 100.0,
    "steps_completed": 5
  }
}
```

---

## Funnel Metrics

### Onboarding Funnel

```
Landing Page → Registration → Email Verify → Profile → Health → Documents → Interview → Complete
     100%          80%            90%          95%      90%       85%         90%        98%
```

#### Step 1: Landing Page → Registration
- **Target**: >80% conversion
- **Measurement**: `auth.registration_started / page.landing_viewed`
- **Alert Threshold**: <75%

#### Step 2: Registration → Email Verify
- **Target**: >90% conversion
- **Measurement**: `auth.email_verified / auth.registration_completed`
- **Alert Threshold**: <85%

#### Step 3: Email Verify → Profile Complete
- **Target**: >95% conversion
- **Measurement**: `onboarding.step_completed(profile) / auth.email_verified`
- **Alert Threshold**: <90%

#### Step 4: Profile → Health Questionnaire
- **Target**: >90% conversion
- **Measurement**: `health.questionnaire_completed / onboarding.step_completed(profile)`
- **Alert Threshold**: <85%

#### Step 5: Health → All Documents Uploaded
- **Target**: >85% conversion
- **Measurement**: `documents.all_uploaded / health.questionnaire_completed`
- **Alert Threshold**: <80%

#### Step 6: Documents → Interview Scheduled
- **Target**: >90% conversion
- **Measurement**: `interview.slot_booked / documents.all_uploaded`
- **Alert Threshold**: <85%

#### Step 7: Interview Scheduled → Interview Attended
- **Target**: >85% conversion
- **Measurement**: `interview.attended / interview.slot_booked`
- **Alert Threshold**: <80%

#### Step 8: Interview → Onboarding Complete
- **Target**: >98% conversion
- **Measurement**: `onboarding.completed / interview.attended`
- **Alert Threshold**: <95%

### Funnel Metrics SLAs

| Metric | Target | Measurement Frequency | Alert Window |
|--------|--------|----------------------|--------------|
| Overall Completion Rate | >95% | Daily | 24h rolling |
| Average Time to Complete | <10 minutes | Hourly | 1h rolling |
| Step Abandonment Rate | <5% per step | Daily | 24h rolling |
| Same-Session Completion | >75% | Daily | 24h rolling |

### Gamification Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Feature Adoption | >60% | % users who earn at least 1 point |
| Daily Active Users (DAU) | >85% | % users active daily during onboarding |
| Return Rate (7-day) | >70% | % users who return within 7 days |
| Badge Unlock Rate | >50% | % users who unlock at least 3 badges |
| Level Distribution | 80% Bronze+, 50% Silver+ | % users at each level tier |

---

## PII Handling Strategy

### Hashing Strategy

**User IDs**: SHA-256 hash with salt
```javascript
const hashUserId = (userId: number): string => {
  const salt = process.env.ANALYTICS_SALT;
  return crypto.createHash('sha256').update(`${userId}-${salt}`).digest('hex');
};
```

**IP Addresses**: One-way hash
```javascript
const hashIpAddress = (ip: string): string => {
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
};
```

**Email Domains** (only): Extract domain, discard local part
```javascript
const extractEmailDomain = (email: string): string => {
  const [, domain] = email.split('@');
  return domain; // e.g., 'gmail.com'
};
```

### PII Exclusion List

**Never Send to Analytics**:
- Full email addresses
- Phone numbers
- CPF/RG numbers
- Full names
- Addresses
- Health condition details
- Document images or OCR text

**Allowed Aggregates**:
- Email domain (e.g., `gmail.com`)
- State/city (aggregated location)
- Age ranges (e.g., `25-34`)
- Risk category (low/medium/high) - not specific conditions

### LGPD/HIPAA Compliance

**Data Retention**:
- Raw event logs: 90 days
- Aggregated metrics: 2 years
- User consent logs: 7 years (legal requirement)

**User Rights**:
- Right to access: Export all events for user via admin panel
- Right to deletion: Purge all analytics data on account deletion
- Right to portability: CSV export of user's analytics data

**Consent Management**:
```json
{
  "event": "consent.granted",
  "timestamp": "2025-09-30T10:00:00Z",
  "user_id": "hash_abc123",
  "properties": {
    "consent_type": "analytics_tracking",
    "consent_version": "1.0.0",
    "ip_address_hash": "hash_192.168.1.1"
  }
}
```

---

## A/B Testing Framework

### Feature Flag Structure

```json
{
  "feature_flag_id": "gamification_double_points_v2",
  "name": "Double Points for Document Uploads",
  "description": "Test if 2x points increases document upload rate",
  "enabled": true,
  "variants": {
    "control": {
      "enabled": true,
      "traffic_allocation": 0.5,
      "config": {
        "document_upload_points": 75
      }
    },
    "treatment": {
      "enabled": true,
      "traffic_allocation": 0.5,
      "config": {
        "document_upload_points": 150
      }
    }
  },
  "targeting": {
    "user_levels": ["iniciante", "bronze"],
    "new_users_only": false,
    "exclude_admins": true
  },
  "success_metrics": [
    "document_upload_rate",
    "document_upload_time",
    "onboarding_completion_rate"
  ],
  "guardrail_metrics": [
    "fraud_flags",
    "time_to_complete",
    "user_satisfaction"
  ],
  "start_date": "2025-10-01T00:00:00Z",
  "end_date": "2025-10-15T23:59:59Z",
  "required_sample_size": 1000,
  "statistical_significance_threshold": 0.05
}
```

### A/B Test Event

```json
{
  "event": "ab_test.variant_assigned",
  "timestamp": "2025-10-01T10:00:00Z",
  "user_id": "hash_abc123",
  "properties": {
    "experiment_id": "gamification_double_points_v2",
    "variant": "treatment",
    "assignment_method": "random",
    "assignment_timestamp": "2025-10-01T10:00:00Z"
  }
}
```

### Test Ideas Backlog

| Test Name | Hypothesis | Variants | Success Metric | Priority |
|-----------|-----------|----------|----------------|----------|
| Double Document Points | Higher points → higher upload rate | 75 pts vs 150 pts | Document upload rate | High |
| Early Celebration | Celebrate at 50% → higher completion | None vs confetti at 50% | Completion rate | Medium |
| Badge Showcase Size | Larger badges → higher engagement | Small vs large icons | Badge clicks | Low |
| Challenge Auto-Enroll | Auto-enroll vs manual opt-in | Auto vs manual | Challenge participation | Medium |
| Premium Slots Visibility | Show locked slots → upsell pressure | Show vs hide | Level upgrade rate | High |

---

## Alert Thresholds

### Critical Alerts (Immediate Response)

| Alert | Condition | Action | Escalation |
|-------|-----------|--------|------------|
| **Completion Rate Drop** | <90% for 2h | Notify product team on Slack | Escalate to CTO if <85% for 4h |
| **Authentication Failure Spike** | >10% failure rate for 1h | Check auth service health | Escalate to security if sustained |
| **OCR Failure Spike** | >20% failure rate for 30min | Check Textract/Tesseract status | Escalate to DevOps |
| **Payment System Down** | 0 successful transactions for 15min | Alert finance team | Escalate immediately |

### Warning Alerts (Monitor)

| Alert | Condition | Action |
|-------|-----------|--------|
| **Time to Complete Increase** | >12 min average for 24h | Analyze funnel bottlenecks |
| **Document Approval Delay** | >48h average approval time | Alert admin team |
| **Satisfaction Score Drop** | <4.5/5.0 for 7 days | Review recent changes |
| **Fraud Flag Spike** | >5% users flagged for 24h | Enable manual review queue |

### Gamification Alerts

| Alert | Condition | Action |
|-------|-----------|--------|
| **Point Inflation** | Average points/user >3,500 | Review point awards logic |
| **Badge Unlock Rate Drop** | <40% badge unlock rate | Review badge criteria |
| **Streak Abandonment** | >30% streaks broken | Analyze engagement patterns |

---

## Dashboard Specifications

### Executive Dashboard

**Metrics Displayed**:
1. **Daily Active Users (DAU)**: Last 30 days trend
2. **Onboarding Completion Rate**: Current vs target (95%)
3. **Average Time to Complete**: Current vs target (<10 min)
4. **User Satisfaction (NPS)**: Current vs target (>50)
5. **Revenue Impact**: Cost savings from automation

**Refresh Rate**: Real-time (1min intervals)

### Product Dashboard

**Metrics Displayed**:
1. **Funnel Conversion**: All 8 steps with drop-off rates
2. **Feature Adoption**: Gamification, MFA, social login
3. **A/B Test Results**: Active experiments with significance
4. **User Feedback**: Recent NPS comments and ratings

**Refresh Rate**: Hourly

### Engineering Dashboard

**Metrics Displayed**:
1. **API Response Times**: p50, p95, p99 by endpoint
2. **Error Rates**: 4xx and 5xx by endpoint
3. **OCR Performance**: Success rate, avg processing time
4. **Database Performance**: Query times, connection pool

**Refresh Rate**: Real-time (30s intervals)

### Gamification Dashboard

**Metrics Displayed**:
1. **Points Distribution**: Histogram of total points by user
2. **Level Distribution**: % users at each level tier
3. **Badge Unlock Rates**: % unlocked for each badge
4. **Streak Health**: Active streaks, broken streaks

**Refresh Rate**: Daily

---

## Data Pipeline Architecture

### Event Collection

**Client-Side** (Browser/Mobile):
```javascript
// analytics.ts
export const trackEvent = (event: AnalyticsEvent) => {
  // Validate event schema
  validateEventSchema(event);

  // Hash PII
  const sanitizedEvent = {
    ...event,
    user_id: hashUserId(event.user_id),
    context: {
      ...event.context,
      ip_address_hash: hashIpAddress(event.context.ip_address),
    },
  };

  // Send to analytics endpoint
  fetch('/api/analytics/track', {
    method: 'POST',
    body: JSON.stringify(sanitizedEvent),
    headers: { 'Content-Type': 'application/json' },
  });

  // Also send to Google Analytics
  gtag('event', event.event, event.properties);
};
```

**Server-Side** (Laravel):
```php
// AnalyticsService.php
public function track(array $event): void
{
    // Validate schema
    $this->validateEventSchema($event);

    // Enrich with server-side context
    $event['server_timestamp'] = now();
    $event['environment'] = config('app.env');

    // Send to event bus (RabbitMQ)
    $this->eventBus->publish('analytics.events', $event);

    // Also log to database for short-term retention
    DB::table('analytics_events')->insert($event);
}
```

### Event Processing

**Stream Processing** (Apache Flink or similar):
1. **Validation**: Reject malformed events
2. **Enrichment**: Add user metadata (level, cohort)
3. **Aggregation**: Compute real-time metrics
4. **Routing**: Send to appropriate data stores

**Data Stores**:
- **Real-time metrics**: Redis (1h TTL)
- **Short-term events**: PostgreSQL (90 days)
- **Long-term aggregates**: BigQuery/Redshift (2 years)

### Data Export

**Scheduled Jobs**:
- **Daily**: Export funnel metrics to Google Sheets (for stakeholders)
- **Weekly**: Generate executive summary report (PDF)
- **Monthly**: Aggregate metrics for long-term storage

---

**End of Analytics Specification v1.0.0**
