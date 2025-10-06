# Test Strategy

**Version**: 1.0.0
**Last Updated**: 2025-09-30
**Status**: Production-Ready

---

## Table of Contents

1. [Testing Philosophy](#1-testing-philosophy)
2. [Test Pyramid Structure](#2-test-pyramid-structure)
3. [Unit Testing](#3-unit-testing)
4. [Integration Testing](#4-integration-testing)
5. [Contract Testing](#5-contract-testing)
6. [E2E Testing](#6-e2e-testing)
7. [Security Testing](#7-security-testing)
8. [Performance Testing](#8-performance-testing)
9. [Accessibility Testing](#9-accessibility-testing)
10. [Coverage Targets](#10-coverage-targets)
11. [CI/CD Integration](#11-cicd-integration)

---

## 1. Testing Philosophy

### 1.1 Core Principles

**Test-Driven Development (TDD)**
- Write tests before implementation (Red → Green → Refactor)
- Tests define behavior, not implementation
- Refactor with confidence using comprehensive test coverage

**Testing Pyramid**
```
           /\
          /  \     E2E (5%)
         /____\
        /      \   Integration (25%)
       /________\
      /          \ Unit (70%)
     /____________\
```

**Key Tenets**:
1. **Fast Feedback**: Unit tests run in <2s, integration <10s
2. **Deterministic**: Same input = same output (no flaky tests)
3. **Isolated**: Tests don't depend on external services or state
4. **Readable**: Tests serve as living documentation
5. **Maintainable**: Tests cost less to maintain than code they protect

### 1.2 Dependencies on ADRs

**ADR-002: Unified Authentication**
- Test auth flows: cookie-based, JWT, social OAuth
- Verify session fingerprinting and CSRF protection
- Validate multi-role access control (beneficiary, admin, company)

**ADR-003: State Management**
- Test component state boundaries (local vs shared vs server)
- Verify optimistic updates and rollback mechanisms
- Validate data synchronization patterns

**ADR-004: Data Privacy**
- Test encryption at rest and in transit
- Verify data anonymization in logs/analytics
- Validate consent management workflows

**GAMIFICATION_SPEC.md**
- Test point earning, level progression, badge unlocking
- Verify fraud detection (rapid progression flags)
- Validate ethical constraints (no dark patterns)

---

## 2. Test Pyramid Structure

### 2.1 Distribution

| Test Level | Percentage | Execution Time | Purpose |
|------------|-----------|----------------|---------|
| **Unit** | 70% | <2s | Test individual functions/components |
| **Integration** | 25% | <10s | Test module interactions, API contracts |
| **E2E** | 5% | <60s | Test critical user journeys end-to-end |

### 2.2 Rationale

**Why 70% Unit?**
- Fast feedback loop (<2s)
- Pinpoint failures precisely
- Low maintenance cost
- Enable confident refactoring

**Why 25% Integration?**
- Verify module contracts (API, database, cache)
- Test state synchronization
- Validate business logic across boundaries

**Why 5% E2E?**
- Expensive to maintain (brittle with UI changes)
- Slow execution (60s per flow)
- Focus on critical paths only (onboarding, auth, gamification)

---

## 3. Unit Testing

### 3.1 Backend: Pest/PHPUnit (Laravel)

**Framework**: Pest 2.x (PHPUnit wrapper)

**Test Structure**:
```php
// tests/Unit/Services/GamificationServiceTest.php

use App\Services\GamificationService;
use App\Models\User;

it('awards points for document upload', function () {
    $user = User::factory()->create();
    $service = app(GamificationService::class);

    $result = $service->awardPoints($user->id, 'document_upload');

    expect($result)->toHaveKey('points_earned', 75)
        ->and($result)->toHaveKey('points_total', 75)
        ->and($user->fresh()->gamification_progress->total_points)->toBe(75);
});

it('detects rapid progression fraud', function () {
    $user = User::factory()->create();
    $service = app(GamificationService::class);

    // Earn 1500 points in 2 seconds
    $service->awardPoints($user->id, 'registration_complete');
    $service->awardPoints($user->id, 'profile_basic_complete');
    // ... (many rapid awards)

    $progress = $user->fresh()->gamification_progress;

    expect($progress->fraud_score)->toBeGreaterThan(80)
        ->and($progress->manual_review_required)->toBeTrue();
});
```

**Coverage Targets**:
- Service classes: 95% (business logic)
- Models: 85% (relationships, scopes, mutators)
- Helpers: 90% (pure functions)

**What to Test**:
- ✅ Business logic (point calculations, level progression)
- ✅ Validation rules (input sanitization, format checks)
- ✅ Edge cases (null inputs, boundary values)
- ✅ Error handling (exceptions, rollbacks)
- ❌ Database queries (use integration tests)
- ❌ External API calls (use mocks)

### 3.2 Frontend: RTL + Vitest (Next.js)

**Framework**: React Testing Library + Vitest

**Test Structure**:
```tsx
// app/components/GamificationProgress.test.tsx

import { render, screen, waitFor } from '@testing-library/react';
import { GamificationProgress } from './GamificationProgress';

describe('GamificationProgress', () => {
  it('displays current points and level', () => {
    const mockData = {
      points: 825,
      level: 'prata',
      nextLevel: 'ouro',
      progressToNext: 68.75
    };

    render(<GamificationProgress data={mockData} />);

    expect(screen.getByText('825 pontos')).toBeInTheDocument();
    expect(screen.getByText('Nível: Prata')).toBeInTheDocument();
    expect(screen.getByText(/Próximo nível: Ouro/)).toBeInTheDocument();
  });

  it('shows level-up celebration modal', async () => {
    const mockData = { points: 700, level: 'prata', justLeveledUp: true };

    render(<GamificationProgress data={mockData} />);

    await waitFor(() => {
      expect(screen.getByText(/Parabéns! Você subiu de nível!/)).toBeInTheDocument();
    });
  });

  it('respects reduced motion preference', () => {
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
    }));

    const mockData = { points: 700, level: 'prata', justLeveledUp: true };
    render(<GamificationProgress data={mockData} />);

    const modal = screen.getByRole('dialog');
    expect(modal).not.toHaveClass('confetti-animation');
  });
});
```

**Coverage Targets**:
- Components: 85% (UI logic, event handlers)
- Hooks: 90% (state management, side effects)
- Utilities: 95% (pure functions)

**What to Test**:
- ✅ User interactions (clicks, form submissions)
- ✅ Conditional rendering (loading, error, success states)
- ✅ Accessibility (ARIA labels, keyboard navigation)
- ✅ State management (React hooks, Zustand stores)
- ❌ CSS styling (use visual regression tests)
- ❌ Animation timing (use E2E tests)

---

## 4. Integration Testing

### 4.1 API Integration (Laravel)

**Framework**: Pest Feature Tests + MySQL Test Containers

**Test Structure**:
```php
// tests/Feature/Api/GamificationApiTest.php

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user, 'sanctum');
});

it('awards points via API endpoint', function () {
    $response = $this->postJson('/api/gamification/points/earn', [
        'action_type' => 'document_upload',
        'related_entity_type' => 'document',
        'related_entity_id' => 12345
    ]);

    $response->assertOk()
        ->assertJson([
            'points_earned' => 75,
            'points_total' => 75,
            'level' => 'iniciante'
        ]);

    $this->assertDatabaseHas('gamification_point_history', [
        'beneficiary_id' => $this->user->id,
        'action_type' => 'document_upload',
        'points_earned' => 75
    ]);
});

it('prevents duplicate point awards for same action', function () {
    // Award points first time
    $this->postJson('/api/gamification/points/earn', [
        'action_type' => 'registration_complete'
    ])->assertOk();

    // Try to award again (should fail)
    $response = $this->postJson('/api/gamification/points/earn', [
        'action_type' => 'registration_complete'
    ]);

    $response->assertStatus(422)
        ->assertJson(['error' => 'Points already awarded for this action']);
});

it('enforces rate limiting on gamification endpoints', function () {
    for ($i = 0; $i < 61; $i++) {
        $response = $this->getJson('/api/gamification/progress');
    }

    $response->assertStatus(429); // Too Many Requests
});
```

**What to Test**:
- ✅ HTTP request/response contracts
- ✅ Database transactions and rollbacks
- ✅ Authentication and authorization
- ✅ Rate limiting and throttling
- ✅ Error responses (400, 401, 403, 422, 500)

### 4.2 Database Integration

**Test Containers**: Testcontainers PHP with MySQL 8.0

**Setup**:
```php
// tests/Pest.php

use Illuminate\Support\Facades\DB;

beforeAll(function () {
    // Start MySQL container (reused across tests)
    DB::connection('mysql')->getPdo();
});

afterAll(function () {
    // Container auto-stops after tests
});
```

**What to Test**:
- ✅ Complex queries (joins, subqueries, aggregations)
- ✅ Transaction isolation
- ✅ Index performance (query plans)
- ✅ Foreign key constraints
- ❌ Simple CRUD (covered by model unit tests)

---

## 5. Contract Testing

### 5.1 OpenAPI Validation

**Framework**: Spectator (Laravel OpenAPI Validator)

**Setup**:
```yaml
# openapi.yaml

openapi: 3.0.0
info:
  title: Onboarding Portal API
  version: 1.0.0

paths:
  /api/gamification/points/earn:
    post:
      summary: Award points for user action
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [action_type]
              properties:
                action_type:
                  type: string
                  enum: [registration_complete, document_upload, ...]
                related_entity_type:
                  type: string
                related_entity_id:
                  type: integer
      responses:
        200:
          description: Points awarded successfully
          content:
            application/json:
              schema:
                type: object
                required: [points_earned, points_total, level]
                properties:
                  points_earned:
                    type: integer
                    minimum: 1
                    maximum: 500
                  points_total:
                    type: integer
                  level:
                    type: string
                    enum: [iniciante, bronze, prata, ouro, platina]
```

**Test Structure**:
```php
// tests/Feature/Api/GamificationContractTest.php

use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

it('conforms to OpenAPI spec for points award', function () {
    $this->postJson('/api/gamification/points/earn', [
        'action_type' => 'document_upload'
    ])->assertValidRequest()
      ->assertValidResponse(200);
});

it('rejects invalid action_type', function () {
    $this->postJson('/api/gamification/points/earn', [
        'action_type' => 'invalid_action'
    ])->assertInvalidRequest();
});
```

**Benefits**:
- Frontend/backend contract enforcement
- Auto-generated API documentation
- Early detection of breaking changes

---

## 6. E2E Testing

### 6.1 Critical Paths (Playwright)

**Framework**: Playwright (headless Chrome, Firefox, Safari)

**Test Scenarios**:

**1. Complete Onboarding Flow**
```typescript
// e2e/onboarding-flow.spec.ts

import { test, expect } from '@playwright/test';

test('complete onboarding with gamification', async ({ page }) => {
  // Step 1: Registration
  await page.goto('/register');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'SecurePass123!');
  await page.click('button[type="submit"]');

  // Verify points awarded
  await expect(page.locator('[data-testid="points-display"]')).toContainText('100 pontos');

  // Step 2: Profile completion
  await page.fill('[name="full_name"]', 'João Silva');
  await page.fill('[name="cpf"]', '12345678901');
  await page.click('button:text("Continuar")');

  // Verify level-up (100 + 50 = 150 pts, still iniciante)
  await expect(page.locator('[data-testid="level-badge"]')).toContainText('Iniciante');

  // Step 3: Health questionnaire
  await page.check('[name="health_question_1"][value="yes"]');
  // ... (answer all 25 questions)

  // Verify badge unlocked
  await expect(page.locator('[data-testid="badge-notification"]')).toBeVisible();
  await expect(page.locator('[data-testid="badge-notification"]')).toContainText('Campeão da Saúde');

  // Step 4: Document upload
  await page.setInputFiles('[data-testid="file-upload-rg"]', './fixtures/rg.jpg');
  await page.click('button:text("Enviar")');

  // Step 5: Interview scheduling
  await page.click('[data-testid="interview-slot-9am"]');
  await page.click('button:text("Confirmar")');

  // Verify completion celebration
  await expect(page.locator('[data-testid="completion-modal"]')).toBeVisible();
  await expect(page.locator('[data-testid="total-points"]')).toContainText(/2,5\d{2} pontos/);
});
```

**2. Authentication Flow (ADR-002)**
```typescript
// e2e/auth-flow.spec.ts

test('cookie-based authentication with CSRF protection', async ({ page }) => {
  // Get CSRF token
  await page.goto('/sanctum/csrf-cookie');

  // Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'admin@example.com');
  await page.fill('[name="password"]', 'AdminPass123!');
  await page.click('button[type="submit"]');

  // Verify session fingerprint
  const cookies = await page.context().cookies();
  expect(cookies.some(c => c.name === 'laravel_session')).toBeTruthy();

  // Access protected route
  await page.goto('/dashboard');
  await expect(page.locator('h1')).toContainText('Dashboard');

  // Verify CSRF token in forms
  const csrfToken = await page.locator('[name="_token"]').getAttribute('value');
  expect(csrfToken).toBeTruthy();
});
```

**3. Gamification Fraud Detection**
```typescript
// e2e/fraud-detection.spec.ts

test('flags rapid progression as suspicious', async ({ page }) => {
  await page.goto('/register');

  // Complete registration at suspicious speed (using API)
  await page.evaluate(async () => {
    const actions = [
      'registration_complete',
      'profile_basic_complete',
      'profile_optional_complete',
      'health_question_answered', // x25
      'document_uploaded', // x5
      'interview_scheduled'
    ];

    // Award all points in <3 seconds
    for (const action of actions) {
      await fetch('/api/gamification/points/earn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: action })
      });
    }
  });

  // Verify fraud flag
  await page.goto('/dashboard');
  await expect(page.locator('[data-testid="manual-review-notice"]')).toBeVisible();
});
```

**Coverage**:
- Onboarding flow: 100% of critical path
- Authentication: 100% of ADR-002 flows
- Gamification: 80% of GAMIFICATION_SPEC scenarios

---

## 7. Security Testing

### 7.1 OWASP ZAP Baseline Scan

**Frequency**: Every commit to main branch

**Configuration**:
```yaml
# .github/workflows/security-scan.yml

name: Security Scan
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  zap-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Start application
        run: docker-compose up -d

      - name: Run OWASP ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.7.0
        with:
          target: 'http://localhost:3000'
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a'

      - name: Upload ZAP Report
        uses: actions/upload-artifact@v3
        with:
          name: zap-report
          path: zap-report.html
```

**Rules Configuration** (`.zap/rules.tsv`):
```
10202	FAIL	Cross-Site Scripting (XSS)
10094	FAIL	SQL Injection
10020	FAIL	X-Frame-Options Header Not Set
10021	FAIL	X-Content-Type-Options Header Missing
10023	FAIL	Information Disclosure - Debug Error Messages
```

**Fail Conditions**:
- High severity: Build fails
- Medium severity: Warning (review required)
- Low severity: Informational

### 7.2 Dependency Scanning

**PHP (Composer)**:
```bash
composer audit
```

**JavaScript (npm)**:
```bash
npm audit --production
```

**Automated**: GitHub Dependabot

### 7.3 Secret Scanning

**Tools**:
- GitGuardian (pre-commit hook)
- GitHub Secret Scanning

**Blocked Patterns**:
- AWS keys (AKIA*)
- Database credentials (mysql://*, postgres://*)
- API tokens (sk_live_*, pk_live_*)
- Private keys (BEGIN RSA PRIVATE KEY)

---

## 8. Performance Testing

### 8.1 Load Testing (k6)

**Framework**: k6 (Grafana)

**Test Scenarios**:

**1. Gamification Point Award Endpoint**
```javascript
// load-tests/gamification-points.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp-up
    { duration: '1m', target: 100 },   // Sustained load
    { duration: '30s', target: 0 }     // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests <500ms
    http_req_failed: ['rate<0.01']    // <1% error rate
  }
};

export default function () {
  const payload = JSON.stringify({
    action_type: 'document_upload'
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + __ENV.AUTH_TOKEN
    }
  };

  const res = http.post('http://localhost:8000/api/gamification/points/earn', payload, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time <500ms': (r) => r.timings.duration < 500,
    'points awarded': (r) => r.json('points_earned') === 75
  });

  sleep(1);
}
```

**SLO Budgets**:
| Endpoint | p95 Latency | p99 Latency | Error Rate |
|----------|-------------|-------------|------------|
| `/api/gamification/points/earn` | <500ms | <1s | <0.1% |
| `/api/gamification/progress` | <200ms | <500ms | <0.1% |
| `/api/auth/login` | <300ms | <800ms | <0.1% |

**2. Database Query Performance**
```javascript
// load-tests/database-queries.js

import sql from 'k6/x/sql';

const db = sql.open('mysql', 'user:pass@tcp(localhost:3306)/onboarding');

export default function () {
  // Test complex gamification query
  const result = sql.query(db, `
    SELECT
      gp.*,
      COUNT(DISTINCT ph.id) as points_transactions,
      JSON_LENGTH(gp.earned_badges) as badge_count
    FROM gamification_progress gp
    LEFT JOIN gamification_point_history ph ON ph.beneficiary_id = gp.beneficiary_id
    WHERE gp.beneficiary_id = ?
    GROUP BY gp.id
  `, [1]);

  check(result, {
    'query executed': (r) => r.length > 0,
    'query time <100ms': () => true // k6/x/sql doesn't expose timing
  });
}
```

### 8.2 Stress Testing

**Scenario**: Black Friday traffic (10x normal load)

**Load Profile**:
```
100 RPS → 500 RPS → 1000 RPS (sustained 5 min) → 100 RPS
```

**Success Criteria**:
- No 5xx errors
- p95 latency <2s (degraded but functional)
- Database connections <80% pool capacity

---

## 9. Accessibility Testing

### 9.1 Automated (axe-core)

**Framework**: @axe-core/playwright

**Test Structure**:
```typescript
// e2e/accessibility.spec.ts

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('gamification dashboard is accessible', async ({ page }) => {
  await page.goto('/dashboard');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('level-up modal is keyboard accessible', async ({ page }) => {
  await page.goto('/dashboard');

  // Trigger level-up
  // ...

  // Tab through modal
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveText('Continuar');

  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveText('Ver Benefícios');

  // Close with Escape
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="level-up-modal"]')).not.toBeVisible();
});
```

**Checks**:
- ✅ Color contrast (4.5:1 for text, 3:1 for UI)
- ✅ ARIA labels (buttons, form fields, modals)
- ✅ Keyboard navigation (Tab, Escape, Enter, Arrow keys)
- ✅ Screen reader compatibility (VoiceOver, NVDA)
- ✅ Reduced motion (respects `prefers-reduced-motion`)

### 9.2 Manual Testing

**Checklist** (per GAMIFICATION_SPEC.md):
- [ ] All badges have alt text
- [ ] Progress bars have `aria-valuenow` and `aria-valuemax`
- [ ] Animations can be disabled via system preference
- [ ] Color contrast ratio ≥4.5:1 for all text
- [ ] Focus indicators visible on all interactive elements
- [ ] Screen reader announces point changes
- [ ] Keyboard shortcuts documented and functional

---

## 10. Coverage Targets

### 10.1 Code Coverage

| Metric | Target | Measurement | Tool |
|--------|--------|-------------|------|
| **Overall Coverage** | 85% | Lines, branches | PHPUnit/Pest, Vitest |
| **Critical Path Coverage** | 90% | Lines | Manual calculation |
| **Mutation Score** | ≥60% | Killed mutants / total mutants | Infection (PHP), Stryker (JS) |

**Critical Paths**:
1. Authentication (ADR-002)
2. Gamification point award (GAMIFICATION_SPEC)
3. Document upload and OCR
4. Interview scheduling

### 10.2 Mutation Testing

**PHP (Infection)**:
```json
// infection.json
{
  "source": {
    "directories": ["app/Services", "app/Models"]
  },
  "logs": {
    "text": "infection.log"
  },
  "mutators": {
    "@default": true
  },
  "minMsi": 60,
  "minCoveredMsi": 70
}
```

**Run**:
```bash
vendor/bin/infection --min-msi=60
```

**JavaScript (Stryker)**:
```json
// stryker.conf.json
{
  "mutate": ["app/**/*.ts", "!app/**/*.test.ts"],
  "testRunner": "vitest",
  "coverageAnalysis": "perTest",
  "thresholds": { "high": 80, "low": 60, "break": 60 }
}
```

**Run**:
```bash
npx stryker run
```

---

## 11. CI/CD Integration

### 11.1 GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml

name: CI/CD Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: PHP CS Fixer
        run: composer run lint
      - name: ESLint
        run: npm run lint

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Backend Unit Tests (Pest)
        run: |
          composer install
          php artisan test --parallel --coverage --min=85

      - name: Frontend Unit Tests (Vitest)
        run: |
          npm ci
          npm run test:unit -- --coverage --coverage.lines=85

  integration-tests:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: secret
          MYSQL_DATABASE: onboarding_test
    steps:
      - uses: actions/checkout@v3
      - name: Run Integration Tests
        run: php artisan test --testsuite=Feature

  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Validate OpenAPI Spec
        run: composer run test:contract

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: OWASP ZAP Scan
        uses: zaproxy/action-baseline@v0.7.0
        with:
          target: 'http://localhost:3000'

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Run E2E Tests
        run: npm run test:e2e

  performance-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Run k6 Load Tests
        run: |
          docker run --rm -i grafana/k6 run - <load-tests/gamification-points.js

  mutation-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Run Infection
        run: vendor/bin/infection --min-msi=60

  deploy:
    runs-on: ubuntu-latest
    needs: [lint, unit-tests, integration-tests, contract-tests, security-scan, e2e-tests]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Production
        run: ./deploy.sh
```

### 11.2 Test Execution Order

**Priority 1 (Fast Feedback, <2 min)**:
1. Lint (30s)
2. Unit tests (60s)

**Priority 2 (Moderate, <10 min)**:
3. Integration tests (5 min)
4. Contract tests (2 min)
5. Security scan (3 min)

**Priority 3 (Slow, <30 min)**:
6. E2E tests (15 min)
7. Performance tests (10 min - main branch only)

**Priority 4 (Very Slow, <60 min)**:
8. Mutation tests (45 min - main branch only, nightly)

---

## What Could Go Wrong?

### Scenario 1: Flaky E2E Tests
**Risk**: Intermittent failures due to race conditions, network latency
**Mitigation**:
- Use Playwright auto-waiting (built-in retry logic)
- Avoid hard-coded `sleep()` (use `waitFor()` with conditions)
- Run tests 3x on failure before marking as failed
- Track flaky test rate (alert if >5%)

### Scenario 2: Slow Test Suite
**Risk**: Tests take >10 min, blocking deployments
**Mitigation**:
- Parallelize tests (PHPUnit/Pest `--parallel`, Vitest `--threads`)
- Use test containers (faster than Docker Compose)
- Run mutation tests nightly, not on every commit
- Cache dependencies (Composer, npm) in CI

### Scenario 3: Low Coverage on Critical Path
**Risk**: Gamification fraud detection untested, fraud slips through
**Mitigation**:
- Enforce 90% coverage on `app/Services/GamificationService.php`
- Add mutation tests for fraud detection logic
- Manual QA review for critical paths

### Scenario 4: Security Scan False Positives
**Risk**: ZAP flags legitimate behavior, blocks deployment
**Mitigation**:
- Maintain `.zap/rules.tsv` with known false positives
- Manual review for new medium/high findings
- Escalate to security team for unknowns

---

## How We'll Know

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Test Execution Time** | <10 min (P1-P2) | GitHub Actions duration |
| **Flaky Test Rate** | <5% | Failures on re-run / total runs |
| **Coverage Regression** | 0% (no decrease) | Coverage diff in PRs |
| **Production Bugs** | <3 per sprint | Sentry/Rollbar alerts |
| **Security Vulnerabilities** | 0 high/critical | OWASP ZAP, Dependabot |

### Dashboards

**Grafana Panels**:
1. Test execution time (trend line)
2. Coverage by module (heatmap)
3. Flaky test rate (30-day rolling average)
4. Production error rate (correlated with deployments)

---

**End of Test Strategy**
