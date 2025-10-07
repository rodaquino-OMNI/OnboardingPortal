# End-to-End Tests

Comprehensive E2E tests for the entire Onboarding Portal using Playwright.

## Test Files

### Health Questionnaire Flow (`health-questionnaire-flow.spec.ts`)
Complete end-to-end testing for the health questionnaire feature covering:

- **Core Functionality**
  - PHQ-9 questionnaire completion with branching logic
  - Draft auto-save and resume after page refresh
  - Progress indicator updates
  - Form validation

- **Security & Privacy (HIPAA Compliance)**
  - NO PHI in page content or network responses
  - NO PHI in localStorage or sessionStorage
  - Draft saved to server (not client-side storage)
  - Response data contains only risk bands and scores

- **Accessibility**
  - Keyboard navigation (Tab, Arrow keys)
  - ARIA landmarks and roles
  - Screen reader announcements
  - Touch-friendly mobile interface (44x44px minimum)

- **Analytics**
  - Page load tracking
  - Page turn events
  - Completion events
  - Chronological event ordering

- **Error Handling**
  - Network failure during submission
  - Retry mechanism
  - Answer preservation on error

- **Feature Flags**
  - Questionnaire disabled state
  - Feature unavailable messaging

- **Responsive Design**
  - Mobile viewport (375x667)
  - Desktop browsers (Chrome, Firefox, Safari, Edge)

## Running Tests

```bash
# Run all E2E tests across all browsers
npm run test:e2e

# Run with interactive UI
npm run test:e2e:ui

# Debug mode (step through tests)
npm run test:e2e:debug

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test tests/e2e/health-questionnaire-flow.spec.ts

# Run specific test by name
npx playwright test -g "complete PHQ-9 questionnaire"

# Run on specific browser
npx playwright test --project=chromium

# View HTML report
npm run test:e2e:report
```

## Test Configuration

- **Location**: `/playwright.config.ts` (monorepo root)
- **Test Directory**: `/tests/e2e`
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Reporters**: HTML, JSON, JUnit, List
- **Retry**: 2 times on CI, 0 locally
- **Parallel Execution**: Enabled (except CI)

## Test Data

### Test User Credentials
```typescript
{
  email: 'test@example.com',
  password: 'password'
}
```

### Expected Questionnaire Sections
1. **PHQ-9** (9 questions) - Depression screening
2. **GAD-7** (7 questions) - Anxiety screening (conditional on PHQ-9 score)

### Branching Logic
- PHQ-9 score ≥ 10 → Triggers GAD-7 section
- PHQ-9 score < 10 → Direct to completion

### Risk Bands (Non-PHI)
- **Minimal**: 0-4
- **Mild**: 5-9
- **Moderate**: 10-14
- **Moderately Severe**: 15-19
- **Severe**: 20-27

## Critical Assertions

### PHI Protection
```typescript
// Verify NO PHI in API response
const responseBody = await submitResponse.json();
expect(responseBody).not.toHaveProperty('answers');
expect(responseBody).not.toHaveProperty('phq9');
expect(responseBody).not.toHaveProperty('gad7');

// Verify NO PHI in page content
const pageContent = await page.content();
expect(pageContent).not.toContain('phq9');
expect(pageContent).not.toContain('answers');

// Verify NO PHI in client storage
const localStorage = await page.evaluate(() =>
  JSON.stringify(window.localStorage)
);
expect(localStorage).not.toContain('phq9');
expect(localStorage).not.toContain('answers');
```

### Analytics Event Tracking
```typescript
// Track all analytics events
page.on('response', async (response) => {
  if (response.url().includes('/api/analytics')) {
    const data = await response.request().postDataJSON();
    analyticsEvents.push(data.event);
  }
});

// Verify expected events
expect(analyticsEvents).toContain('questionnaire_started');
expect(analyticsEvents).toContain('questionnaire_page_turn');
expect(analyticsEvents).toContain('questionnaire_completed');
```

### Accessibility
```typescript
// Verify ARIA landmarks
await expect(page.locator('main[role="main"]')).toBeVisible();
await expect(page.locator('[role="radiogroup"]')).toHaveCount(9);

// Keyboard navigation
await page.keyboard.press('Tab');
await expect(page.locator(':focus')).toHaveAttribute('name', 'phq9.0');

await page.keyboard.press('ArrowRight');
await expect(page.locator('[name="phq9.0"][value="1"]')).toBeChecked();
```

## CI/CD Integration

Tests run automatically on:
- Pull requests to main
- Main branch commits
- Nightly builds

### Required Environment Variables
```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000
CI=true # Enables retry logic and serial execution
```

## Debugging

### Trace Viewer
```bash
# Generate trace on failure
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip
```

### Headed Mode
```bash
# See the browser
npx playwright test --headed
```

### Slow Motion
```bash
# Slow down execution
npx playwright test --slow-mo=1000
```

### Inspector
```bash
# Step through tests
npx playwright test --debug
```

## Test Maintenance

### Adding New Tests
1. Create test file in `/tests/e2e/` with `.spec.ts` extension
2. Follow existing patterns from `health-questionnaire-flow.spec.ts`
3. Include accessibility, analytics, and PHI protection assertions
4. Update this README with new test coverage

### Updating Test Data
- Modify test user credentials in individual test files as needed
- Keep test data consistent across test files
- Document any special test data requirements

## Known Limitations

1. **Test User Setup**: Requires seeded test user in database
2. **Feature Flags**: Tests assume features are enabled by default (uses mocking for disabled state)
3. **Network Mocking**: Some tests mock API responses for edge cases
4. **Browser Support**: Limited to browsers supported by Playwright

## Future Enhancements

- [ ] Multi-language support testing
- [ ] Offline mode testing (service worker)
- [ ] Concurrent user testing (session isolation)
- [ ] Performance benchmarks (load time, interaction latency)
- [ ] Visual regression testing
- [ ] Cross-browser compatibility matrix
- [ ] Automated accessibility audits (aXe integration)
