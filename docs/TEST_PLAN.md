# Test Plan

**Version**: 1.0.0
**Last Updated**: 2025-09-30
**Status**: Production-Ready

---

## Table of Contents

1. [Test Scope](#1-test-scope)
2. [ADR-002: Authentication Flow Test Matrix](#2-adr-002-authentication-flow-test-matrix)
3. [ADR-003: State Management Test Matrix](#3-adr-003-state-management-test-matrix)
4. [Gamification Test Scenarios](#4-gamification-test-scenarios)
5. [Regression Test Suite](#5-regression-test-suite)
6. [Performance Test Scenarios](#6-performance-test-scenarios)
7. [Test Environment Setup](#7-test-environment-setup)
8. [Test Data Management](#8-test-data-management)

---

## 1. Test Scope

### 1.1 In Scope

**Functional Testing**:
- Authentication (cookie, JWT, social OAuth)
- Gamification (points, levels, badges, streaks, challenges)
- Onboarding flow (registration → profile → health → documents → interview)
- Admin dashboard (user management, analytics)

**Non-Functional Testing**:
- Performance (load, stress, spike tests)
- Security (OWASP ZAP, penetration testing)
- Accessibility (WCAG 2.1 AA compliance)
- LGPD/HIPAA compliance

### 1.2 Out of Scope

- Third-party integrations (AWS Textract, SendGrid) - mocked
- Payment processing (not applicable to onboarding portal)
- Mobile app testing (web responsive only)

---

## 2. ADR-002: Authentication Flow Test Matrix

### 2.1 Cookie-Based Authentication

| Test Case | Scenario | Steps | Expected Result | Priority |
|-----------|----------|-------|-----------------|----------|
| **AUTH-001** | Successful login with valid credentials | 1. Navigate to `/login`<br>2. Enter valid email/password<br>3. Submit form | - 200 OK<br>- `laravel_session` cookie set<br>- Redirect to `/dashboard`<br>- Session fingerprint stored | **P0** |
| **AUTH-002** | Login fails with invalid password | 1. Navigate to `/login`<br>2. Enter valid email, wrong password<br>3. Submit | - 422 Unprocessable<br>- Error message displayed<br>- No session cookie set | **P0** |
| **AUTH-003** | CSRF token validation on login | 1. Get CSRF token from `/sanctum/csrf-cookie`<br>2. Submit login without token | - 419 CSRF Token Mismatch<br>- Login rejected | **P0** |
| **AUTH-004** | Session fingerprint mismatch detection | 1. Login successfully<br>2. Change User-Agent<br>3. Make authenticated request | - Session invalidated<br>- `SessionFingerprintMismatch` event fired<br>- Redirect to login | **P1** |
| **AUTH-005** | Logout clears session and cookies | 1. Login successfully<br>2. POST `/api/auth/logout`<br>3. Attempt to access `/dashboard` | - 401 Unauthorized<br>- `laravel_session` cookie deleted<br>- Redirect to `/login` | **P0** |
| **AUTH-006** | Concurrent session handling | 1. Login from Device A<br>2. Login from Device B<br>3. Access dashboard from Device A | - Both sessions active (stateless JWT) OR Device A logged out (stateful sessions) | **P2** |

### 2.2 JWT Authentication

| Test Case | Scenario | Steps | Expected Result | Priority |
|-----------|----------|-------|-----------------|----------|
| **AUTH-007** | JWT token issued on login | 1. POST `/api/auth/login` with credentials | - 200 OK<br>- Response body contains `access_token` (JWT)<br>- Token expiry set to 1 hour | **P0** |
| **AUTH-008** | Authenticated request with valid JWT | 1. Login, get JWT<br>2. GET `/api/user` with `Authorization: Bearer {token}` | - 200 OK<br>- User profile returned | **P0** |
| **AUTH-009** | Request fails with expired JWT | 1. Generate JWT with 1-second expiry<br>2. Wait 2 seconds<br>3. GET `/api/user` | - 401 Unauthorized<br>- Error: "Token expired" | **P1** |
| **AUTH-010** | Request fails with malformed JWT | 1. GET `/api/user` with invalid token format | - 401 Unauthorized<br>- Error: "Invalid token" | **P1** |
| **AUTH-011** | JWT refresh flow | 1. Login, get JWT<br>2. POST `/api/auth/refresh` with valid token | - 200 OK<br>- New JWT issued<br>- Old token invalidated | **P1** |

### 2.3 Social OAuth (Google, Facebook)

| Test Case | Scenario | Steps | Expected Result | Priority |
|-----------|----------|-------|-----------------|----------|
| **AUTH-012** | Google OAuth redirect | 1. Click "Login with Google"<br>2. Redirected to Google OAuth consent | - Redirect to `accounts.google.com/o/oauth2/auth`<br>- `state` parameter validated | **P1** |
| **AUTH-013** | OAuth callback creates new user | 1. Complete Google OAuth<br>2. Callback to `/api/auth/google/callback` | - New user created<br>- Email from Google stored<br>- `provider` = 'google'<br>- Redirect to `/dashboard` | **P1** |
| **AUTH-014** | OAuth callback links existing user | 1. Register with `user@example.com`<br>2. Login with Google (same email) | - No duplicate user created<br>- Google provider linked to existing account | **P1** |
| **AUTH-015** | OAuth state parameter validation | 1. Initiate Google OAuth<br>2. Tamper with `state` parameter in callback URL | - 400 Bad Request<br>- Error: "Invalid state" | **P2** |

### 2.4 Multi-Role Access Control

| Test Case | Scenario | Steps | Expected Result | Priority |
|-----------|----------|-------|-----------------|----------|
| **AUTH-016** | Beneficiary accesses own dashboard | 1. Login as beneficiary<br>2. GET `/dashboard` | - 200 OK<br>- Beneficiary-specific UI shown | **P0** |
| **AUTH-017** | Admin accesses admin panel | 1. Login as admin<br>2. GET `/admin/users` | - 200 OK<br>- Admin panel displayed | **P0** |
| **AUTH-018** | Beneficiary blocked from admin panel | 1. Login as beneficiary<br>2. GET `/admin/users` | - 403 Forbidden<br>- Error: "Insufficient permissions" | **P0** |
| **AUTH-019** | Role-based menu rendering | 1. Login as beneficiary<br>2. Check navigation menu | - No "Admin Panel" link visible | **P1** |
| **AUTH-020** | Company admin sees only their users | 1. Login as Company A admin<br>2. GET `/admin/users` | - Only Company A users returned<br>- Company B users hidden | **P1** |

---

## 3. ADR-003: State Management Test Matrix

### 3.1 Component-Local State

| Test Case | Scenario | Steps | Expected Result | Priority |
|-----------|----------|-------|-----------------|----------|
| **STATE-001** | Form input controlled by local state | 1. Type in "Name" field<br>2. Check React component state | - State updates on each keystroke<br>- No server request made | **P0** |
| **STATE-002** | Dropdown menu expands/collapses | 1. Click dropdown trigger<br>2. Check `isOpen` state | - `isOpen` toggles to `true`<br>- Menu visible | **P1** |
| **STATE-003** | State resets on unmount | 1. Open modal (mounts component)<br>2. Close modal (unmounts component)<br>3. Reopen modal | - Component state reset to initial values | **P2** |

### 3.2 Shared Client State (Zustand)

| Test Case | Scenario | Steps | Expected Result | Priority |
|-----------|----------|-------|-----------------|----------|
| **STATE-004** | Gamification points update across components | 1. Award points in `DocumentUpload` component<br>2. Check `GamificationHeader` component | - Header displays updated points<br>- No page refresh required | **P0** |
| **STATE-005** | User profile stored in Zustand | 1. Login<br>2. Fetch user profile<br>3. Navigate to different page<br>4. Check profile data | - Profile data persists across pages<br>- No re-fetch required | **P1** |
| **STATE-006** | Store state persists in localStorage | 1. Set user preference (e.g., dark mode)<br>2. Reload page<br>3. Check preference | - Preference persists after reload | **P2** |

### 3.3 Server State (React Query)

| Test Case | Scenario | Steps | Expected Result | Priority |
|-----------|----------|-------|-----------------|----------|
| **STATE-007** | Cache hit prevents redundant API call | 1. Fetch `/api/user` (cache miss)<br>2. Navigate away<br>3. Navigate back (cache hit) | - API called once<br>- Second render uses cache | **P1** |
| **STATE-008** | Optimistic update on point award | 1. Award points (POST `/api/gamification/points`)<br>2. Check UI before API response | - UI shows +75 points immediately<br>- Rollback if API fails | **P0** |
| **STATE-009** | Stale data refetched on focus | 1. Fetch data<br>2. Leave tab (window blur)<br>3. Return to tab (window focus) | - Data refetched if stale (>5 min) | **P2** |
| **STATE-010** | Error boundary on failed mutation | 1. Submit form with network error<br>2. Check UI | - Error message displayed<br>- Form data preserved<br>- Retry button shown | **P1** |

### 3.4 URL State (Next.js Router)

| Test Case | Scenario | Steps | Expected Result | Priority |
|-----------|----------|-------|-----------------|----------|
| **STATE-011** | Query params control pagination | 1. Navigate to `/admin/users?page=2`<br>2. Check API request | - API called with `?page=2`<br>- Page 2 data displayed | **P1** |
| **STATE-012** | Filter state synced to URL | 1. Select "Active Users" filter<br>2. Check URL | - URL updates to `?status=active`<br>- Shareable link works | **P1** |
| **STATE-013** | Back button respects state | 1. Navigate to Page 2<br>2. Click browser back button | - Page 1 displayed<br>- URL updates to `?page=1` | **P2** |

---

## 4. Gamification Test Scenarios

### 4.1 Point System

| Test Case | Scenario | Steps | Expected Result | Priority |
|-----------|----------|-------|-----------------|----------|
| **GAM-001** | Award points for document upload | 1. Upload RG document<br>2. Check points balance | - +75 points awarded<br>- `gamification.points_earned` event fired<br>- Point history updated | **P0** |
| **GAM-002** | Prevent duplicate point awards | 1. Complete registration (+100 pts)<br>2. Try to award registration points again | - 422 Unprocessable<br>- Error: "Points already awarded"<br>- Total points unchanged | **P0** |
| **GAM-003** | Bonus points for early completion | 1. Complete onboarding in <10 min<br>2. Check for bonus | - +100 bonus points awarded<br>- `bonus_type` = 'early_completion' | **P1** |
| **GAM-004** | Points display updates in real-time | 1. Open two browser tabs<br>2. Award points in Tab 1<br>3. Check Tab 2 (WebSocket connected) | - Tab 2 shows updated points without refresh | **P1** |
| **GAM-005** | Point history shows all transactions | 1. Earn points from 5 different actions<br>2. View point history | - All 5 transactions listed<br>- Sorted by date (newest first)<br>- Each shows `action_type`, `points_earned`, `timestamp` | **P2** |

### 4.2 Level Progression

| Test Case | Scenario | Steps | Expected Result | Priority |
|-----------|----------|-------|-----------------|----------|
| **GAM-006** | Level-up from Iniciante to Bronze | 1. Earn 300 points<br>2. Check level | - Level changes to "Bronze"<br>- `gamification.level_up` event fired<br>- Celebration modal shown | **P0** |
| **GAM-007** | Level-up unlocks benefits | 1. Reach Bronze (300 pts)<br>2. Check user benefits | - `priority_support` = true in DB<br>- Support tickets tagged "Priority" | **P1** |
| **GAM-008** | Progress bar to next level accurate | 1. Earn 500 points (Bronze, 300-699 range)<br>2. Check progress bar | - Shows 50% progress to Prata (700)<br>- Text: "Faltam 200 pontos" | **P1** |
| **GAM-009** | Cannot skip levels | 1. Manually set points to 1200 (Ouro range)<br>2. Trigger level check | - System assigns Ouro (not skipping Bronze/Prata)<br>- Level history correct | **P2** |

### 4.3 Badge System

| Test Case | Scenario | Steps | Expected Result | Priority |
|-----------|----------|-------|-----------------|----------|
| **GAM-010** | Badge unlocked on criteria met | 1. Answer all 25 health questions<br>2. Check badges | - "Campeão da Saúde" badge unlocked<br>- +150 points awarded<br>- Badge notification modal shown | **P0** |
| **GAM-011** | Badge appears in profile | 1. Unlock "Campeão da Saúde"<br>2. Navigate to `/profile`<br>3. Check badge collection | - Badge visible in grid<br>- Rarity indicator (Uncommon) shown | **P1** |
| **GAM-012** | Locked badge shows unlock criteria | 1. View badge collection<br>2. Hover over locked badge | - Tooltip shows: "Complete 100% of health questions" | **P2** |
| **GAM-013** | Badge sharing generates image | 1. Unlock badge<br>2. Click "Share" button | - PNG image generated<br>- Image shows badge icon + user name + achievement | **P2** |

### 4.4 Streak Tracking

| Test Case | Scenario | Steps | Expected Result | Priority |
|-----------|----------|-------|-----------------|----------|
| **GAM-014** | Streak increments on daily activity | 1. Perform action on Day 1<br>2. Perform action on Day 2<br>3. Check streak | - Streak = 2 days<br>- `gamification.streak_updated` event fired | **P1** |
| **GAM-015** | Grace period prevents accidental breaks | 1. Active on Day 1 at 11 PM<br>2. Active on Day 2 at 1 AM (26 hours later)<br>3. Check streak | - Streak still active (within 24h grace) | **P1** |
| **GAM-016** | Streak resets after 24h inactivity | 1. Active on Day 1<br>2. Inactive for 48 hours<br>3. Check streak | - Streak reset to 0<br>- `longest_streak` preserved | **P2** |
| **GAM-017** | Streak reminder notification sent | 1. Active on Day 1<br>2. Inactive on Day 2 until 6 PM | - Notification sent: "Continue your 1-day streak!"<br>- Opt-out setting respected | **P2** |

### 4.5 Challenge System

| Test Case | Scenario | Steps | Expected Result | Priority |
|-----------|----------|-------|-----------------|----------|
| **GAM-018** | Opt into weekly challenge | 1. Banner shows "Maratona de Documentos"<br>2. Click "Participate"<br>3. Check challenge status | - Challenge status = "active"<br>- Progress bar shows 0% | **P1** |
| **GAM-019** | Challenge progress updates | 1. Opt into "Maratona de Documentos"<br>2. Upload 3 of 5 documents<br>3. Check progress | - Progress bar shows 60% (3/5)<br>- Text: "3/5 documentos enviados" | **P1** |
| **GAM-020** | Challenge completion awards bonus | 1. Complete all challenge requirements<br>2. Check points | - +150 bonus points awarded<br>- Challenge badge unlocked<br>- Confetti animation shown | **P1** |
| **GAM-021** | Declining challenge has no penalty | 1. See challenge banner<br>2. Click "Agora Não"<br>3. Complete onboarding normally | - No points deducted<br>- All features work normally | **P2** |

### 4.6 Fraud Detection

| Test Case | Scenario | Steps | Expected Result | Priority |
|-----------|----------|-------|-----------------|----------|
| **GAM-022** | Rapid progression flagged | 1. Award 1500 points in 2 seconds<br>2. Check fraud score | - `fraud_score` > 80<br>- `manual_review_required` = true<br>- Email sent to admin | **P0** |
| **GAM-023** | Flagged user sees review notice | 1. Trigger fraud flag<br>2. Login as flagged user<br>3. View dashboard | - Banner: "Account under review"<br>- Level benefits delayed | **P1** |
| **GAM-024** | Admin can approve flagged account | 1. Login as admin<br>2. Navigate to `/admin/fraud-reviews`<br>3. Approve user | - `manual_review_required` = false<br>- `fraud_score` reset<br>- Benefits unlocked | **P1** |

---

## 5. Regression Test Suite

### 5.1 Critical Paths (Never Break)

| Test Case | Path | Steps | Priority |
|-----------|------|-------|----------|
| **REG-001** | Registration → Dashboard | 1. POST `/api/register`<br>2. Verify email<br>3. GET `/dashboard` | **P0** |
| **REG-002** | Document Upload → Approval | 1. POST `/api/documents` (upload RG)<br>2. Admin approves<br>3. Check status | **P0** |
| **REG-003** | Interview Scheduling | 1. GET `/api/interview-slots`<br>2. POST `/api/interviews` (book slot)<br>3. Receive confirmation email | **P0** |
| **REG-004** | Gamification Point Award | 1. Trigger action (e.g., profile complete)<br>2. POST `/api/gamification/points`<br>3. Verify DB update | **P0** |
| **REG-005** | Admin User Management | 1. Login as admin<br>2. GET `/admin/users`<br>3. Edit user role<br>4. Verify change | **P0** |

### 5.2 Past Bugs (Should Not Reoccur)

| Test Case | Bug ID | Description | Regression Test | Priority |
|-----------|--------|-------------|-----------------|----------|
| **REG-006** | BUG-47 | Infinite auth loop | 1. Clear cookies<br>2. Navigate to `/login`<br>3. Verify no redirect loop | **P0** |
| **REG-007** | BUG-52 | Gamification points awarded twice | 1. Upload document<br>2. Refresh page<br>3. Verify points awarded once | **P0** |
| **REG-008** | BUG-61 | CSRF token expired on slow networks | 1. Get CSRF token<br>2. Wait 10 minutes<br>3. Submit login<br>4. Verify success (token auto-refreshes) | **P1** |
| **REG-009** | BUG-73 | Session fingerprint false positive | 1. Login<br>2. Rotate IP (VPN)<br>3. Verify session persists (IP change allowed) | **P1** |

---

## 6. Performance Test Scenarios

### 6.1 Load Tests (k6)

| Test Case | Scenario | Load Profile | SLO | Priority |
|-----------|----------|--------------|-----|----------|
| **PERF-001** | Gamification point award | 100 RPS sustained for 5 min | p95 < 500ms | **P0** |
| **PERF-002** | User dashboard page load | 50 RPS sustained for 10 min | p95 < 800ms | **P0** |
| **PERF-003** | Admin user list (1000 users) | 20 RPS sustained for 5 min | p95 < 1s | **P1** |
| **PERF-004** | Document upload (2MB image) | 10 concurrent uploads | p95 < 3s | **P1** |

### 6.2 Stress Tests

| Test Case | Scenario | Load Profile | Success Criteria | Priority |
|-----------|----------|--------------|------------------|----------|
| **PERF-005** | Black Friday traffic | 100 → 1000 RPS (spike in 30s) | - No 5xx errors<br>- p95 < 2s (degraded but functional) | **P1** |
| **PERF-006** | Database connection pool saturation | 500 concurrent requests | - No connection timeout errors<br>- Pool usage < 80% | **P1** |

### 6.3 Spike Tests

| Test Case | Scenario | Load Profile | Success Criteria | Priority |
|-----------|----------|--------------|------------------|----------|
| **PERF-007** | Sudden viral onboarding campaign | 10 → 500 RPS (instant spike) | - Auto-scaling triggered<br>- Error rate < 1% | **P2** |

---

## 7. Test Environment Setup

### 7.1 Local Development

**Requirements**:
- Docker Compose (MySQL 8.0, Redis, Nginx)
- PHP 8.2 with extensions (BCMath, PDO, Redis)
- Node.js 18+
- Composer 2.x, npm 9+

**Setup**:
```bash
# Clone repo
git clone https://github.com/your-org/onboarding-portal
cd onboarding-portal

# Install dependencies
composer install
npm ci

# Start containers
docker-compose up -d

# Run migrations
php artisan migrate --seed

# Run tests
composer test
npm run test
```

### 7.2 CI/CD (GitHub Actions)

**Environment Variables**:
```env
DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=onboarding_test
DB_USERNAME=root
DB_PASSWORD=secret

REDIS_HOST=redis
REDIS_PORT=6379

APP_ENV=testing
APP_DEBUG=true
```

### 7.3 Staging

**URL**: `https://staging.onboarding.example.com`

**Data**:
- Anonymized production data (LGPD-compliant)
- 1000 test users (beneficiaries + admins)
- Seeded gamification data (badges, levels)

**Refresh**: Weekly (Sunday 2 AM)

---

## 8. Test Data Management

### 8.1 Seeders

**Beneficiary Users**:
```php
// database/seeders/TestUserSeeder.php

User::factory()->count(100)->create([
    'role' => 'beneficiary',
    'email_verified_at' => now()
]);
```

**Gamification Data**:
```php
// database/seeders/GamificationSeeder.php

GamificationBadge::create([
    'id' => 'health_champion',
    'name' => 'Campeão da Saúde',
    'category' => 'health_thoroughness',
    'rarity' => 'uncommon',
    'points_awarded' => 150
]);
```

### 8.2 Factories

**Document Upload**:
```php
// database/factories/DocumentFactory.php

Document::factory()->definition([
    'beneficiary_id' => User::factory(),
    'document_type_id' => 1, // RG
    'file_path' => 'test-fixtures/rg-sample.jpg',
    'status' => 'pending'
]);
```

### 8.3 Fixtures

**Test Images**:
- `/tests/fixtures/rg-sample.jpg` (valid RG document)
- `/tests/fixtures/cpf-sample.jpg` (valid CPF document)
- `/tests/fixtures/invalid-blurry.jpg` (low-quality image, should fail OCR)

---

## What Could Go Wrong?

### Scenario 1: Test Data Drift
**Risk**: Seeded data doesn't match production schema
**Mitigation**:
- Run seeders against staging weekly
- Compare staging/production schemas in CI
- Alert if drift detected

### Scenario 2: Flaky E2E Tests
**Risk**: Tests fail intermittently due to timing issues
**Mitigation**:
- Use Playwright auto-waiting
- Retry failed tests 3x before marking as failed
- Track flaky test rate (<5% threshold)

### Scenario 3: Missing Test Coverage
**Risk**: Critical path untested, bug reaches production
**Mitigation**:
- Enforce 90% coverage on critical modules
- Manual QA checklist for each release
- Production smoke tests post-deployment

---

## How We'll Know

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Test Execution Time** | <10 min | GitHub Actions duration |
| **Test Failure Rate** | <2% | Failed tests / total tests |
| **Bug Escape Rate** | <3 per sprint | Production bugs not caught in testing |
| **Coverage** | 85% overall, 90% critical | PHPUnit/Vitest reports |

---

**End of Test Plan**
