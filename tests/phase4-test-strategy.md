# Phase 4 Test Strategy - Comprehensive Testing Plan

**Version**: 1.0.0
**Created**: 2025-10-01
**Agent**: Tester (Hive Mind)
**Status**: Production-Ready Strategy

---

## Executive Summary

This comprehensive test strategy for Phase 4 covers:
1. Repository layer integration tests for PointsEngine and AuditLogService
2. OpenAPI contract testing using fixture-based validation
3. Accessibility (a11y) smoke tests for Sprint 2A sandbox
4. Analytics contract tests for Sprint 2B gamification events

**Test Coverage Targets**:
- Unit Tests: 90%+ coverage
- Integration Tests: 80%+ coverage
- Contract Tests: 100% endpoint coverage
- a11y Tests: WCAG 2.1 AA compliance
- Analytics Tests: 100% event tracking

---

## 1. Current Test Coverage Analysis

### 1.1 Existing Unit Tests

**PointsEngineTest.php** (14 tests, ~90% coverage):
- ✅ Points awarding with idempotency
- ✅ Duplicate prevention via SHA-256 keys
- ✅ Level progression (single and multiple jumps)
- ✅ Streak tracking (increment/reset)
- ✅ Event emission (PointsEarnedEvent, LevelUpEvent)
- ✅ Audit logging integration
- ✅ Point value validation per spec
- ⚠️ **Gaps**: Concurrency race conditions, repository failures

**AuditLogServiceTest.php** (10 tests, ~85% coverage):
- ✅ WHO-WHAT-WHEN-WHERE-HOW capture
- ✅ IP hashing for LGPD compliance
- ✅ PHI redaction from details
- ✅ Request correlation tracking
- ✅ System vs user actions
- ✅ Session tracking
- ⚠️ **Gaps**: Repository failures, bulk operations

### 1.2 Test Architecture

```
tests/
├── Unit/                          # Existing unit tests (Mockery)
│   ├── Gamification/
│   │   └── PointsEngineTest.php   # 14 tests, 90% coverage
│   └── Audit/
│       └── AuditLogServiceTest.php # 10 tests, 85% coverage
│
├── Integration/                   # NEW: Repository integration tests
│   ├── Gamification/
│   │   ├── PointsRepositoryTest.php
│   │   └── PointsEngineIntegrationTest.php
│   └── Audit/
│       └── AuditLogRepositoryTest.php
│
├── Contracts/                     # NEW: OpenAPI contract tests
│   ├── fixtures/                  # JSON response fixtures
│   │   ├── auth/
│   │   ├── gamification/
│   │   └── health/
│   ├── GamificationContractTest.php
│   ├── AuthContractTest.php
│   └── HealthContractTest.php
│
├── A11y/                          # NEW: Accessibility tests
│   ├── Sprint2ASandboxTest.php
│   └── helpers/
│       └── AxeCoreRunner.php
│
└── Analytics/                     # NEW: Analytics contract tests
    ├── GamificationEventsTest.php
    └── fixtures/
        └── expected-events.json
```

---

## 2. Integration Tests - Repository Layer

### 2.1 PointsRepository Integration Tests

**File**: `tests/Integration/Gamification/PointsRepositoryTest.php`

**Test Cases** (Target: 12 tests):

```php
/** @test */ it_records_transaction_with_unique_constraint()
/** @test */ it_prevents_duplicate_idempotency_keys()
/** @test */ it_calculates_balance_from_transactions()
/** @test */ it_increments_balance_with_row_locking()
/** @test */ it_handles_concurrent_increments_safely()
/** @test */ it_retrieves_transaction_history_paginated()
/** @test */ it_filters_transactions_by_action()
/** @test */ it_filters_transactions_by_date_range()
/** @test */ it_handles_database_connection_failure()
/** @test */ it_rolls_back_on_unique_constraint_violation()
/** @test */ it_indexes_queries_efficiently() // Query explain analysis
/** @test */ it_handles_high_volume_inserts() // 1000+ transactions
```

**Coverage Target**: 95%+
**Database**: SQLite in-memory for speed, MySQL for production parity
**Fixtures**: Seed 100 sample transactions for pagination tests

### 2.2 AuditLogRepository Integration Tests

**File**: `tests/Integration/Audit/AuditLogRepositoryTest.php`

**Test Cases** (Target: 10 tests):

```php
/** @test */ it_appends_immutable_audit_entries()
/** @test */ it_queries_by_user_id_with_pagination()
/** @test */ it_queries_by_action_with_date_filter()
/** @test */ it_queries_by_time_range_efficiently()
/** @test */ it_correlates_logs_by_request_id()
/** @test */ it_searches_with_multiple_filters()
/** @test */ it_counts_logs_matching_filters()
/** @test */ it_purges_old_logs_in_chunks() // 10k+ logs
/** @test */ it_creates_meta_audit_log_on_purge()
/** @test */ it_handles_bulk_inserts_efficiently() // 1000+ logs/sec
```

**Coverage Target**: 90%+
**Performance**: Benchmark queries <50ms for 10k+ records
**Fixtures**: Generate 10k sample audit logs for purge tests

### 2.3 PointsEngine Integration Tests

**File**: `tests/Integration/Gamification/PointsEngineIntegrationTest.php`

**Test Cases** (Target: 8 tests):

```php
/** @test */ it_awards_points_end_to_end_with_real_db()
/** @test */ it_handles_concurrent_awards_without_race_conditions()
/** @test */ it_recovers_from_repository_failures_gracefully()
/** @test */ it_maintains_transactional_integrity_on_rollback()
/** @test */ it_emits_analytics_events_after_commit()
/** @test */ it_handles_level_up_with_repository_updates()
/** @test */ it_logs_audit_trail_atomically_with_points()
/** @test */ it_processes_1000_awards_under_10_seconds() // Load test
```

**Coverage Target**: 85%+
**Focus**: Database transactions, event timing, error recovery

---

## 3. OpenAPI Contract Tests

### 3.1 Contract Testing Approach

**Strategy**: Fixture-based response validation against OpenAPI spec

**Tools**:
- `league/openapi-psr7-validator` - PHP OpenAPI validator
- `pestphp/pest` - Modern testing framework
- `guzzlehttp/guzzle` - HTTP client for API calls

### 3.2 Gamification Contract Tests

**File**: `tests/Contracts/GamificationContractTest.php`

**Test Cases** (Target: 8 endpoints × 3 scenarios = 24 tests):

```php
// POST /gamification/points/earn
/** @test */ it_matches_openapi_spec_for_points_earn_success()
/** @test */ it_matches_openapi_spec_for_points_earn_duplicate()
/** @test */ it_matches_openapi_spec_for_points_earn_validation_error()

// GET /gamification/levels/current
/** @test */ it_matches_openapi_spec_for_current_level_response()
/** @test */ it_includes_all_required_fields_per_spec()
/** @test */ it_validates_level_name_enum_values()

// GET /gamification/badges
/** @test */ it_matches_openapi_spec_for_badges_list()
/** @test */ it_validates_badge_schema_structure()

// GET /gamification/progress
/** @test */ it_matches_openapi_spec_for_progress_response()
```

**Fixture Structure**:
```
tests/Contracts/fixtures/gamification/
├── points-earn-success.json
├── points-earn-duplicate.json
├── points-earn-validation-error.json
├── current-level.json
├── badges-unlocked.json
└── progress.json
```

**Validation Rules**:
- HTTP status codes match spec (200, 201, 422, 401)
- Response schema matches OpenAPI definitions
- Required fields present and correct type
- Enum values within allowed range
- Date formats comply (ISO 8601)

### 3.3 Contract Test Implementation Pattern

```php
use Pest\Laravel;
use OpenAPIValidation\PSR7\ValidatorBuilder;

beforeEach(function () {
    $this->validator = (new ValidatorBuilder)
        ->fromYamlFile(__DIR__ . '/../../docs/API_SPEC.yaml')
        ->getResponseValidator();
});

it('validates POST /gamification/points/earn response against OpenAPI spec', function () {
    $user = User::factory()->create(['points_balance' => 0]);

    $response = $this->actingAs($user)
        ->postJson('/api/gamification/points/earn', [
            'action_type' => 'registration_complete',
            'points' => 100,
        ]);

    // Assert response matches OpenAPI spec
    $this->validator->validate(
        new \GuzzleHttp\Psr7\Request('POST', '/gamification/points/earn'),
        $response->toPsrResponse()
    );

    // Assert business logic
    expect($response->status())->toBe(200);
    expect($response->json('points_earned'))->toBe(100);
});
```

---

## 4. Accessibility (a11y) Smoke Tests - Sprint 2A

### 4.1 Test Scope

**Target**: Sprint 2A sandbox deployment
**Compliance Level**: WCAG 2.1 Level AA
**Pages to Test**:
- Login page
- Registration flow (Steps 1-3)
- Dashboard with gamification widgets
- Profile page
- Health questionnaire

### 4.2 A11y Test Implementation

**File**: `tests/A11y/Sprint2ASandboxTest.php`

**Test Cases** (Target: 15 tests):

```php
/** @test */ it_has_no_critical_axe_violations_on_login_page()
/** @test */ it_has_proper_heading_hierarchy()
/** @test */ it_has_accessible_form_labels()
/** @test */ it_has_keyboard_navigation_support()
/** @test */ it_has_sufficient_color_contrast() // 4.5:1 ratio
/** @test */ it_has_alt_text_on_all_images()
/** @test */ it_has_aria_labels_on_interactive_elements()
/** @test */ it_supports_screen_reader_navigation()
/** @test */ it_has_focus_indicators_on_all_focusable_elements()
/** @test */ it_has_no_duplicate_ids()
/** @test */ it_validates_landmark_regions()
/** @test */ it_has_responsive_design_without_horizontal_scroll()
/** @test */ it_allows_text_zoom_to_200_percent()
/** @test */ it_has_skip_navigation_link()
/** @test */ it_passes_lighthouse_accessibility_score_90_plus()
```

**Tools**:
- `axe-core` - Accessibility rule engine
- `pa11y` - CLI accessibility testing
- `lighthouse-ci` - Automated audits

**Implementation**:
```php
use Facebook\WebDriver\Remote\RemoteWebDriver;
use Lullabot\AMP\Validate\Validator;

it('validates WCAG 2.1 AA compliance on dashboard', function () {
    $driver = RemoteWebDriver::create(/* ... */);
    $driver->get('http://localhost:3000/dashboard');

    // Inject axe-core
    $driver->executeScript(file_get_contents(__DIR__ . '/helpers/axe.min.js'));

    // Run accessibility scan
    $results = $driver->executeAsyncScript('
        const callback = arguments[arguments.length - 1];
        axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] }, callback);
    ');

    // Assert no violations
    expect($results['violations'])->toBeEmpty();
});
```

### 4.3 a11y Stop Conditions

**Critical Violations** (Block deployment):
- Missing form labels
- Insufficient color contrast (<4.5:1)
- Images without alt text
- Keyboard traps
- Missing ARIA roles on custom widgets

**Major Violations** (Fix required before next sprint):
- Improper heading hierarchy
- Missing skip navigation
- Redundant ARIA labels

---

## 5. Analytics Contract Tests - Sprint 2B

### 5.1 Analytics Event Tracking

**Events to Validate**:
- `gamification.points.earned`
- `gamification.level.up`
- `gamification.badge.unlocked`
- `gamification.streak.milestone`

### 5.2 Analytics Contract Tests

**File**: `tests/Analytics/GamificationEventsTest.php`

**Test Cases** (Target: 12 tests):

```php
/** @test */ it_emits_points_earned_event_with_correct_schema()
/** @test */ it_includes_all_required_properties_in_points_event()
/** @test */ it_validates_points_event_timestamp_format()
/** @test */ it_includes_user_id_in_all_events()
/** @test */ it_emits_level_up_event_on_threshold_cross()
/** @test */ it_includes_old_and_new_level_in_level_up_event()
/** @test */ it_validates_event_payload_against_json_schema()
/** @test */ it_sends_events_to_analytics_endpoint()
/** @test */ it_batches_events_under_100ms_window()
/** @test */ it_retries_failed_event_sends_with_exponential_backoff()
/** @test */ it_drops_events_older_than_24_hours()
/** @test */ it_samples_events_at_10_percent_for_high_volume_users()
```

**Expected Event Schema**:
```json
{
  "event": "gamification.points.earned",
  "version": "1.0.0",
  "timestamp": "2025-10-01T12:00:00.000Z",
  "user_id": "user-123",
  "properties": {
    "action": "registration_complete",
    "points": 100,
    "new_balance": 100,
    "level": 1,
    "source": "system"
  },
  "metadata": {
    "request_id": "req-abc-123",
    "session_id": "sess-xyz-456",
    "device_type": "web"
  }
}
```

**Validation**:
```php
use Opis\JsonSchema\Validator;

it('validates points earned event against JSON schema', function () {
    Event::fake([PointsEarnedEvent::class]);

    $user = User::factory()->create();
    $this->pointsEngine->awardPoints($user, 'registration');

    Event::assertDispatched(PointsEarnedEvent::class, function ($event) {
        $schema = json_decode(file_get_contents(__DIR__ . '/fixtures/points-earned-schema.json'));
        $validator = new Validator();

        $result = $validator->validate(
            json_decode(json_encode($event->toArray())),
            $schema
        );

        return $result->isValid();
    });
});
```

---

## 6. CI/CD Integration

### 6.1 GitHub Actions Workflow

**File**: `.github/workflows/phase4-tests.yml`

```yaml
name: Phase 4 Test Suite

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Unit Tests
        run: php artisan test --testsuite=Unit --coverage --min=90

  integration-tests:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_DATABASE: test
    steps:
      - name: Run Integration Tests
        run: php artisan test --testsuite=Integration

  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - name: Validate OpenAPI Contracts
        run: php artisan test --testsuite=Contracts

  a11y-tests:
    runs-on: ubuntu-latest
    steps:
      - name: Run Accessibility Tests
        run: npm run test:a11y

  analytics-tests:
    runs-on: ubuntu-latest
    steps:
      - name: Validate Analytics Events
        run: php artisan test --testsuite=Analytics
```

### 6.2 Stop Conditions

**Pre-commit hooks** (Block commit):
- PHP CS Fixer violations
- PHPStan level 8 errors

**CI Checks** (Block PR merge):
- Unit test coverage <90%
- Any failing integration test
- Contract validation errors
- Critical a11y violations (WCAG AA)
- Analytics event schema mismatches

**Deployment Gates**:
- All tests passing
- Performance benchmarks met (<10s for 1000 operations)
- Security scan clean (no high/critical vulnerabilities)

---

## 7. Test Data Fixtures

### 7.1 Fixture Organization

```
tests/fixtures/
├── users/
│   ├── demo-user.json
│   ├── admin-user.json
│   └── points-history.json
├── gamification/
│   ├── points-transactions.json
│   ├── level-thresholds.json
│   └── badges.json
├── contracts/
│   ├── auth/
│   ├── gamification/
│   └── health/
└── analytics/
    ├── points-earned-schema.json
    └── level-up-schema.json
```

### 7.2 Factory Patterns

```php
// UserFactory with gamification state
User::factory()->withPoints(500)->create();
User::factory()->atLevel(3)->create();
User::factory()->withStreak(7)->create();

// PointsTransaction factory
PointsTransaction::factory()->forUser($user)->registration()->create();
PointsTransaction::factory()->count(100)->create();
```

---

## 8. Performance Benchmarks

### 8.1 Benchmark Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Single points award | <50ms | p95 latency |
| 1000 concurrent awards | <10s | Total time |
| Audit log append | <20ms | p95 latency |
| 10k audit log purge | <5s | Chunked deletion |
| Contract validation | <100ms | Per endpoint |
| a11y scan | <5s | Per page |

### 8.2 Load Testing

**Tool**: `k6` or `Apache JMeter`

**Scenario**: Simulate 100 concurrent users earning points
```javascript
import http from 'k6/http';
import { check } from 'k6';

export default function () {
  const response = http.post('http://localhost:8000/api/gamification/points/earn', {
    action_type: 'registration_complete',
    points: 100,
  });

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
}
```

---

## 9. Acceptance Criteria

### 9.1 Test Suite Completion Checklist

- [ ] All 12 PointsRepository integration tests passing
- [ ] All 10 AuditLogRepository integration tests passing
- [ ] All 8 PointsEngine integration tests passing
- [ ] All 24 OpenAPI contract tests passing
- [ ] All 15 a11y smoke tests passing (WCAG AA)
- [ ] All 12 analytics contract tests passing
- [ ] CI pipeline green on all jobs
- [ ] Coverage reports: Unit 90%+, Integration 80%+
- [ ] Performance benchmarks met (all <p95 targets)
- [ ] Documentation updated with test examples

### 9.2 Deployment Readiness

**Phase 4 Sprint 2A** (Sandbox):
- ✅ Unit tests 90%+ coverage
- ✅ Integration tests all green
- ✅ Contract tests validate API spec
- ✅ a11y tests WCAG AA compliant
- ⏳ Load tests (deferred to Sprint 2B)

**Phase 4 Sprint 2B** (Production):
- ✅ All Sprint 2A criteria
- ✅ Analytics events validated
- ✅ Load tests passing (100 concurrent users)
- ✅ Security audit clean
- ✅ Monitoring dashboards operational

---

## 10. Coordination with Coder Agent

### 10.1 Memory Coordination Keys

```
swarm/tester/phase4-strategy          # This document
swarm/tester/test-results             # Test execution results
swarm/tester/coverage-report          # Coverage metrics
swarm/coder/implementation-status     # Track coder progress
swarm/shared/blocked-issues           # Cross-agent blockers
```

### 10.2 Handoff Protocol

**Tester → Coder**:
1. Tester writes integration test (RED phase)
2. Store test file path in `swarm/tester/pending-tests`
3. Notify coder via hooks: `npx claude-flow@alpha hooks notify --message "Integration test ready: PointsRepositoryTest.php"`

**Coder → Tester**:
1. Coder implements repository method (GREEN phase)
2. Store implementation path in `swarm/coder/completed-features`
3. Notify tester via hooks: `npx claude-flow@alpha hooks notify --message "Implementation ready for test: EloquentPointsRepository::incrementBalance"`

---

## 11. Risk Mitigation

### 11.1 Identified Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Flaky integration tests** | High | Medium | Use database transactions, reset state |
| **Contract drift** | High | Low | Auto-generate fixtures from OpenAPI spec |
| **a11y regressions** | Medium | Medium | Add a11y checks to CI pipeline |
| **Analytics event loss** | Medium | Low | Implement retry logic, dead letter queue |
| **Performance degradation** | High | Low | Continuous benchmarking in CI |

### 11.2 Rollback Plan

If Phase 4 tests fail in production:
1. Revert to Phase 3 stable branch (feature flag toggle)
2. Investigate failing tests in staging environment
3. Hotfix critical issues with fast-track CI
4. Re-deploy with full test suite green

---

## 12. Future Enhancements (Phase 5)

- **Mutation testing**: Use `infection/infection` to validate test quality
- **Visual regression tests**: Use `percy.io` for UI changes
- **Chaos engineering**: Test resilience under failure conditions
- **Contract-first development**: Generate API handlers from OpenAPI spec
- **Property-based testing**: Use `humbug/humbug` for edge case discovery

---

**End of Phase 4 Test Strategy**

**Approved by**: Tester Agent (Hive Mind)
**Next Review**: After Sprint 2A sandbox deployment
**Questions?**: Check `swarm/tester/qa-notes` in memory
