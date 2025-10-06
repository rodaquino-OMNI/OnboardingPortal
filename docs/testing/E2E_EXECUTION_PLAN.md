# E2E Test Execution Plan - Sprint 2C Registration Journey

**Status**: ⚠️ BLOCKED - Critical fixes required before execution
**Target**: Validate complete registration user journey end-to-end
**Timeline**: 2 hours to fix, 1 hour to execute

---

## Journey Under Test

```
/register → /callback-verify → /profile/minimal → /completion
```

### User Story
```
AS a new beneficiary
I WANT to complete the registration process
SO THAT I can access the onboarding portal and upload documents
```

---

## Pre-Execution Checklist

### 🔴 Critical Blockers (MUST FIX)

- [ ] **Fix Playwright test execution** (2 hours)
  ```bash
  # Issue: ReferenceError: describe is not defined
  # Root cause: Non-E2E test files being imported
  # Fix: Update playwright.config.ts testIgnore
  ```

- [ ] **Verify test environment** (30 minutes)
  ```bash
  cd apps/web
  npx playwright test --list  # Should show 8+ tests
  npx playwright test --project=chromium --headed  # Run in browser
  ```

- [ ] **Setup test data factory** (1 hour)
  ```typescript
  // Create tests/e2e/fixtures/test-data-factory.ts
  export const createTestUser = () => ({
    email: `test-${Date.now()}@example.com`,
    password: 'SecureTest123!',
    confirmPassword: 'SecureTest123!',
  });
  ```

---

## Test Execution Matrix

### Browser Coverage
| Browser | Desktop | Mobile | Priority |
|---------|---------|--------|----------|
| Chromium | ✅ | ✅ | P0 |
| Firefox | ✅ | ❌ | P1 |
| Webkit (Safari) | ✅ | ✅ | P1 |

### Test Scenarios (8 tests in registration flow)

#### Happy Path Tests
1. **Complete Registration Flow** (priority: P0)
   - Steps: Register → Verify Email → Complete Profile → Completion
   - Expected: User lands on dashboard/home
   - Analytics: 5 events tracked

2. **Keyboard Navigation** (priority: P1)
   - Steps: Tab through all form fields, submit with Enter
   - Expected: Full keyboard accessibility
   - WCAG: Success Criterion 2.1.1 (Keyboard)

#### Validation Tests
3. **Email Format Validation** (priority: P0)
   - Input: `invalid-email`
   - Expected: Error message "invalid email"
   - Form state: Preserved

4. **Password Strength Validation** (priority: P0)
   - Input: `weak`
   - Expected: Error message "password must be at least 8 characters"
   - Form state: Email preserved

5. **Password Confirmation Match** (priority: P0)
   - Input: Password ≠ Confirmation
   - Expected: Error message "passwords do not match"
   - Form state: Email and password cleared

#### Error Handling Tests
6. **Duplicate Email Handling** (priority: P1)
   - Input: Existing email `demo@example.com`
   - Expected: Error "email already exists"
   - Recovery: User can enter different email

7. **Form State Persistence** (priority: P1)
   - Scenario: Validation error occurs
   - Expected: Previously entered valid data remains
   - UX: User doesn't re-enter valid information

#### Analytics Tests
8. **Analytics Event Tracking** (priority: P0)
   - Events to validate:
     - `page_view` (on /register)
     - `registration_started` (form interaction)
     - `registration_submitted` (form submit)
     - `email_verified` (after verification)
     - `registration_completed` (journey complete)
   - Validation: All events conform to schemas

9. **Progress Bar Updates** (priority: P2)
   - Verify: Progress increases after each step
   - WCAG: aria-valuenow updates correctly

---

## Execution Steps

### Phase 1: Setup (15 minutes)

```bash
# 1. Start development server
cd apps/web
npm run dev  # Starts on http://localhost:3000

# 2. Install Playwright browsers (if not already)
npx playwright install --with-deps

# 3. Verify environment
curl http://localhost:3000/register  # Should return 200
```

### Phase 2: Run Tests (30 minutes)

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/phase8-registration-flow.spec.ts

# Run with UI (debugging)
npx playwright test --ui

# Run specific browser
npx playwright test --project=chromium

# Generate HTML report
npx playwright show-report
```

### Phase 3: Validation (15 minutes)

**Success Criteria**:
- ✅ All 8 tests pass
- ✅ No WCAG violations
- ✅ Analytics events captured
- ✅ Screenshots generated on failure
- ✅ HTML report accessible

**Failure Triage**:
```bash
# 1. Check test results
cat test-results/accessibility-results.json

# 2. Review screenshots
open test-results/*.png

# 3. Watch videos
open test-results/*.webm

# 4. Check traces
npx playwright show-trace test-results/trace.zip
```

---

## Analytics Event Validation

### Mock Analytics Server Setup

```typescript
// tests/e2e/helpers/analytics-mock.ts
import { Page } from '@playwright/test';

export async function setupAnalyticsMock(page: Page) {
  const events: any[] = [];

  // Intercept analytics requests
  await page.route('**/analytics/**', (route) => {
    const event = route.request().postDataJSON();
    events.push(event);

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  return {
    getEvents: () => events,
    getEventByType: (type: string) =>
      events.find(e => e.event === type),
    assertEventFired: (type: string) => {
      const event = events.find(e => e.event === type);
      if (!event) throw new Error(`Event ${type} not fired`);
      return event;
    },
  };
}
```

### Event Assertions

```typescript
test('analytics events fire during registration', async ({ page }) => {
  const analytics = await setupAnalyticsMock(page);

  // Navigate to registration
  await page.goto('/register');

  // Verify page_view
  const pageView = analytics.assertEventFired('page_view');
  expect(pageView.properties.page_name).toBe('registration');

  // Fill form
  await page.fill('input[type="email"]', 'test@example.com');

  // Verify registration_started
  const regStarted = analytics.assertEventFired('registration_started');
  expect(regStarted.properties.email_domain).toBe('example.com');

  // Submit form
  await page.click('button[type="submit"]');

  // Verify registration_submitted
  const regSubmitted = analytics.assertEventFired('registration_submitted');
  expect(regSubmitted.schema_version).toBe('1.0.0');
});
```

---

## Page Object Pattern Implementation

### Registration Page Object

```typescript
// tests/e2e/pages/RegistrationPage.ts
import { Page, expect } from '@playwright/test';

export class RegistrationPage {
  constructor(private page: Page) {}

  // Locators
  get emailInput() { return this.page.locator('input[type="email"]'); }
  get passwordInput() { return this.page.locator('input[type="password"]'); }
  get confirmPasswordInput() {
    return this.page.locator('input[name="password_confirmation"]');
  }
  get submitButton() { return this.page.locator('button[type="submit"]'); }
  get errorMessage() { return this.page.locator('[role="alert"]'); }

  // Actions
  async navigate() {
    await this.page.goto('/register');
    await expect(this.emailInput).toBeVisible();
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async fillConfirmPassword(password: string) {
    await this.confirmPasswordInput.fill(password);
  }

  async submit() {
    await this.submitButton.click();
  }

  async fillRegistrationForm(data: {
    email: string;
    password: string;
    confirmPassword?: string;
  }) {
    await this.fillEmail(data.email);
    await this.fillPassword(data.password);
    await this.fillConfirmPassword(data.confirmPassword || data.password);
  }

  async submitRegistration(data: {
    email: string;
    password: string;
    confirmPassword?: string;
  }) {
    await this.fillRegistrationForm(data);
    await this.submit();
  }

  // Assertions
  async expectValidationError(message: string) {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(message);
  }

  async expectSuccess() {
    await expect(this.page).not.toHaveURL('/register');
  }

  async expectFormPreserved(email: string) {
    await expect(this.emailInput).toHaveValue(email);
  }
}
```

### Usage Example

```typescript
import { test } from '@playwright/test';
import { RegistrationPage } from './pages/RegistrationPage';
import { createTestUser } from './fixtures/test-data-factory';

test('complete registration with page objects', async ({ page }) => {
  const registrationPage = new RegistrationPage(page);
  const userData = createTestUser();

  await registrationPage.navigate();
  await registrationPage.submitRegistration(userData);
  await registrationPage.expectSuccess();
});
```

---

## Cookie-Based Auth Validation

### Cookie Assertion Helpers

```typescript
// tests/e2e/helpers/cookie-helpers.ts
import { BrowserContext } from '@playwright/test';

export async function getAuthCookie(context: BrowserContext) {
  const cookies = await context.cookies();
  return cookies.find(c =>
    c.name.includes('auth') ||
    c.name.includes('session') ||
    c.name.includes('token')
  );
}

export function assertSecureCookie(cookie: any) {
  expect(cookie).toBeDefined();
  expect(cookie.secure).toBe(true);  // HTTPS only
  expect(cookie.httpOnly).toBe(true);  // No JS access
  expect(cookie.sameSite).toBe('Strict');  // CSRF protection
}

export async function assertAuthenticated(context: BrowserContext) {
  const authCookie = await getAuthCookie(context);
  expect(authCookie).toBeDefined();
  assertSecureCookie(authCookie);
}
```

### Cookie Flow Test

```typescript
test('maintains authentication via cookies', async ({ page, context }) => {
  // 1. Register and login
  await page.goto('/register');
  // ... complete registration ...

  // 2. Verify auth cookie set
  await assertAuthenticated(context);

  // 3. Navigate to protected route
  await page.goto('/documents');
  await expect(page).toHaveURL('/documents');  // Not redirected to /login

  // 4. Verify cookie persists across navigation
  await page.goto('/profile');
  await assertAuthenticated(context);

  // 5. Logout and verify cookie cleared
  await page.click('text=Logout');
  const authCookie = await getAuthCookie(context);
  expect(authCookie).toBeUndefined();
});
```

---

## Test Data Management

### Test User Factory

```typescript
// tests/e2e/fixtures/test-data-factory.ts
export interface TestUser {
  email: string;
  password: string;
  confirmPassword: string;
  name?: string;
  cpf?: string;
  phone?: string;
}

export function createTestUser(overrides?: Partial<TestUser>): TestUser {
  const timestamp = Date.now();
  const randomId = Math.floor(Math.random() * 10000);

  return {
    email: `test-${timestamp}-${randomId}@example.com`,
    password: 'SecureTest123!',
    confirmPassword: 'SecureTest123!',
    name: 'Test User',
    cpf: '123.456.789-00',
    phone: '(11) 98765-4321',
    ...overrides,
  };
}

export function createInvalidEmailUser(): TestUser {
  return {
    ...createTestUser(),
    email: 'invalid-email',
  };
}

export function createWeakPasswordUser(): TestUser {
  return {
    ...createTestUser(),
    password: 'weak',
    confirmPassword: 'weak',
  };
}

export function createMismatchedPasswordUser(): TestUser {
  const base = createTestUser();
  return {
    ...base,
    confirmPassword: 'DifferentPassword123!',
  };
}
```

### Fixture Usage

```typescript
test('validates email format', async ({ page }) => {
  const registrationPage = new RegistrationPage(page);
  const userData = createInvalidEmailUser();

  await registrationPage.navigate();
  await registrationPage.submitRegistration(userData);
  await registrationPage.expectValidationError('invalid email');
});
```

---

## Execution Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Setup** | 2h | Fix execution blockers, implement page objects |
| **Execution** | 1h | Run all 8 tests across 3 browsers |
| **Validation** | 30min | Review results, triage failures |
| **Report** | 30min | Generate HTML report, document issues |
| **Total** | 4h | Complete E2E validation |

---

## Success Metrics

### Test Execution
- ✅ 8/8 tests passing (100%)
- ✅ 3/3 browsers passing (Chromium, Firefox, Webkit)
- ✅ 0 accessibility violations
- ✅ 5/5 analytics events validated

### Coverage
- ✅ Complete registration journey (4 pages)
- ✅ Form validation scenarios (5 cases)
- ✅ Error handling (2 scenarios)
- ✅ Analytics tracking (5 events)

### Quality
- ✅ WCAG 2.1 AA compliant
- ✅ Keyboard accessible
- ✅ Cookie-based auth validated
- ✅ No PII/PHI in analytics

---

## Next Steps After Execution

1. **Add to CI Pipeline** (2 hours)
   - Create `.github/workflows/e2e-tests.yml`
   - Run on every PR
   - Upload reports and videos

2. **Expand Test Coverage** (4 hours)
   - Add document upload flow tests
   - Add profile completion tests
   - Add gamification tests

3. **Performance Testing** (3 hours)
   - Add Lighthouse CI
   - Validate LCP < 2.5s
   - Track Core Web Vitals

---

**Plan created by Tester Agent**
**Coordination via Claude-Flow**
**Ready for 2C cleanup and 2D execution**
