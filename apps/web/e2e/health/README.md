# Health Questionnaire E2E Tests

> **Note:** E2E tests have been moved to `/tests/e2e/health-questionnaire-flow.spec.ts` in the monorepo root for consistency with other E2E tests.

## Overview

Comprehensive end-to-end tests for the health questionnaire feature using Playwright.

## Test Coverage

### Core Functionality
- ✅ Complete PHQ-9 questionnaire with branching logic
- ✅ Resume from draft after page refresh
- ✅ Branching logic triggers correct sections (GAD-7)
- ✅ Progress indicator updates correctly
- ✅ Validation prevents incomplete submission

### Security & Privacy
- ✅ NO PHI in page content or network responses
- ✅ NO PHI in localStorage or sessionStorage
- ✅ Draft saved to server (not client-side storage)
- ✅ Response data contains only risk bands and scores

### Accessibility
- ✅ Keyboard navigation (Tab, Arrow keys)
- ✅ ARIA landmarks and roles
- ✅ Screen reader announcements
- ✅ Touch-friendly mobile interface (44x44px minimum)

### Analytics
- ✅ Page load tracking
- ✅ Page turn events
- ✅ Completion events
- ✅ Chronological event ordering

### Error Handling
- ✅ Network failure during submission
- ✅ Retry mechanism
- ✅ Answer preservation on error

### Feature Flags
- ✅ Questionnaire disabled state
- ✅ Feature unavailable message

### Responsive Design
- ✅ Mobile viewport (375x667)
- ✅ Touch-friendly controls
- ✅ Desktop browsers (Chrome, Firefox, Safari, Edge)

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI (interactive mode)
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test e2e/health/questionnaire.spec.ts

# Run specific test
npx playwright test -g "complete PHQ-9 questionnaire"

# View report
npm run test:e2e:report
```

## Test Data

### Test User
- Email: `test@example.com`
- Password: `password`

### Expected Questionnaire Sections
1. **PHQ-9** (9 questions) - Depression screening
2. **GAD-7** (7 questions) - Anxiety screening (conditional)

### Branching Logic
- PHQ-9 score ≥ 10 → Triggers GAD-7
- PHQ-9 score < 10 → Direct to completion

### Risk Bands
- **Minimal**: 0-4
- **Mild**: 5-9
- **Moderate**: 10-14
- **Moderately Severe**: 15-19
- **Severe**: 20-27

## Critical Assertions

### PHI Protection
```typescript
// Verify NO PHI in response
const responseBody = await submitResponse.json();
expect(responseBody).not.toHaveProperty('answers');
expect(responseBody).not.toHaveProperty('phq9');

// Verify NO PHI in page content
const pageContent = await page.content();
expect(pageContent).not.toContain('phq9');
expect(pageContent).not.toContain('answers');
```

### Analytics Events
```typescript
const eventTypes = analyticsEvents.map(e => e.event);
expect(eventTypes).toContain('questionnaire_started');
expect(eventTypes).toContain('questionnaire_page_turn');
expect(eventTypes).toContain('questionnaire_completed');
```

### Accessibility
```typescript
// ARIA landmarks
await expect(page.locator('main[role="main"]')).toBeVisible();
await expect(page.locator('[role="radiogroup"]')).toHaveCount(9);

// Keyboard navigation
await page.keyboard.press('Tab');
await page.keyboard.press('ArrowRight');
await expect(page.locator('[name="phq9.0"][value="1"]')).toBeChecked();
```

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Main branch commits
- Nightly builds

### Required Environment Variables
```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000
CI=true # Enables retry logic and parallel execution
```

## Debugging

### Enable trace viewer
```bash
npx playwright test --trace on
npx playwright show-trace trace.zip
```

### Enable headed mode
```bash
npx playwright test --headed
```

### Slow motion
```bash
npx playwright test --slow-mo=1000
```

## Known Limitations

1. **Test user setup**: Requires seeded test user in database
2. **Feature flags**: Tests assume questionnaire is enabled by default
3. **Network mocking**: Some tests mock API responses for edge cases

## Future Enhancements

- [ ] Test multi-language support
- [ ] Test offline mode (service worker)
- [ ] Test concurrent users (session isolation)
- [ ] Performance benchmarks (load time, interaction latency)
- [ ] Visual regression testing
