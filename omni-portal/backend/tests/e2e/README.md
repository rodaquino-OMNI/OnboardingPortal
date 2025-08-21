# End-to-End (E2E) Testing with Playwright

This directory contains comprehensive E2E tests for the Omni Portal backend and frontend integration using Playwright.

## Overview

The E2E test suite covers:

- **Authentication Flow** - Login, logout, session management, social auth
- **Multi-Step Registration** - Complete user onboarding process
- **Health Questionnaire** - Medical screening and mental health assessments
- **Document Upload** - File upload, OCR processing, verification workflow
- **Cross-browser Testing** - Chrome, Firefox, Safari, mobile devices
- **API Integration** - Backend API endpoint validation

## Project Structure

```
tests/e2e/
├── auth.spec.ts                 # Authentication flow tests
├── registration.spec.ts         # Multi-step registration tests
├── health-questionnaire.spec.ts # Health assessment tests
├── document-upload.spec.ts      # Document upload and processing tests
├── helpers/
│   └── test-helpers.ts          # Shared test utilities and functions
├── fixtures/
│   └── README.md                # Test files and sample data
├── global-setup.ts              # Test environment setup
└── global-teardown.ts           # Test environment cleanup
```

## Test Configuration

### Browser Coverage
- **Desktop**: Chrome, Firefox, Safari
- **Mobile**: Mobile Chrome (Pixel 5), Mobile Safari (iPhone 12)
- **Tablet**: iPad Pro
- **API-only**: Headless API testing

### Environment Variables
- `FRONTEND_URL` - Frontend application URL (default: http://localhost:3000)
- `BACKEND_URL` - Backend API URL (default: http://localhost:8000)
- `CI` - Enables CI-specific settings (retries, workers)

### Test Data
- Uses demo users created by `DemoUserSeeder`
- Test database is reset before each test run
- Mock data for edge cases and error scenarios

## Running Tests

### Prerequisites

1. **Install Dependencies**:
   ```bash
   npm install
   npx playwright install
   ```

2. **Setup Test Database**:
   ```bash
   npm run test:setup
   ```

3. **Start Services**:
   ```bash
   # Backend (Laravel)
   php artisan serve --host=0.0.0.0 --port=8000
   
   # Frontend (Next.js)
   cd ../frontend && npm run dev
   ```

### Test Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run tests with browser UI (headed mode)
npm run test:e2e:headed

# Debug tests (step-by-step execution)
npm run test:e2e:debug

# Interactive test runner UI
npm run test:e2e:ui

# View test reports
npm run test:e2e:report

# Browser-specific testing
npm run test:e2e:chrome
npm run test:e2e:firefox
npm run test:e2e:safari

# Mobile device testing
npm run test:e2e:mobile

# API-only testing
npm run test:e2e:api
```

### Continuous Integration

```bash
# CI-optimized run (with retries, single worker)
CI=true npm run test:e2e
```

## Test Patterns

### 1. Authentication Testing

```typescript
// Login with test user
await loginUser(page, TEST_USERS.demo);

// Verify authentication state
await expect(page).toHaveURL(/.*dashboard/);
await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();

// Logout
await logoutUser(page);
```

### 2. Form Testing

```typescript
// Fill multi-step registration
await registerUser(page, {
  name: 'Test User',
  email: 'test@example.com',
  password: 'SecurePassword123!',
  cpf: '12345678901'
});

// Validate form errors
await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
```

### 3. File Upload Testing

```typescript
// Upload document with OCR processing
await uploadDocument(page, testFilePath, 'ID');

// Wait for processing completion
await expect(page.locator('[data-testid="ocr-complete"]')).toBeVisible({ timeout: 60000 });
```

### 4. API Mocking

```typescript
// Mock API responses for error testing
await page.route('**/api/login', route => {
  route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Server error' })
  });
});
```

## Test Data Management

### Demo Users
```typescript
export const TEST_USERS = {
  admin: { email: 'admin@example.com', password: 'password123' },
  demo: { email: 'demo@example.com', password: 'demo123' },
  testUser: { email: 'test@example.com', password: 'test123' }
};
```

### Test Fixtures
- Sample document images for upload testing
- Mock API responses for error scenarios
- Health questionnaire response templates

## Debugging

### Screenshots and Videos
- Automatic screenshots on test failure
- Video recording for failed tests
- Full-page screenshots for debugging

### Trace Files
- Detailed execution traces for failed tests
- Timeline view of all actions and network requests

### Console Logging
```typescript
// Check for console errors
const errors = await checkConsoleErrors(page);
expect(errors).toHaveLength(0);
```

## Mobile Testing

### Responsive Design
- Tests adapt to mobile viewport constraints
- Touch-friendly interaction validation
- Mobile-specific UI component testing

### Device Simulation
```typescript
// Mobile-specific test execution
if (isMobile) {
  await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
}
```

## Performance Testing

### Core Web Vitals
- Lighthouse integration for performance metrics
- Load time validation
- Bundle size monitoring

### API Performance
- Response time validation
- Concurrent request handling
- Rate limiting behavior

## Security Testing

### Authentication Security
- Session management validation
- CSRF protection testing
- XSS prevention verification

### Data Privacy
- LGPD compliance validation
- Sensitive data handling
- Audit logging verification

## Best Practices

### 1. Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Maintain test independence

### 2. Locators
- Use `data-testid` attributes for reliable element selection
- Avoid CSS selectors that may change
- Prefer semantic locators when possible

### 3. Timeouts
- Use appropriate timeouts for async operations
- Wait for specific conditions, not arbitrary delays
- Handle slow network conditions

### 4. Error Handling
- Test both success and failure scenarios
- Validate error messages and user feedback
- Ensure graceful degradation

## Troubleshooting

### Common Issues

1. **Test Flakiness**
   - Increase timeouts for slow operations
   - Wait for specific elements instead of arbitrary delays
   - Check for race conditions

2. **Browser Installation**
   ```bash
   npx playwright install --with-deps
   ```

3. **Permission Issues**
   ```bash
   chmod +x tests/e2e/fixtures/*
   ```

4. **Database Issues**
   ```bash
   php artisan migrate:fresh --env=testing
   php artisan db:seed --class=DemoUserSeeder --env=testing
   ```

### Debug Mode
```bash
# Step-through debugging
npm run test:e2e:debug

# Headed mode with slow motion
playwright test --headed --slowMo=1000
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Run E2E Tests
  run: |
    npm run test:setup
    npm run test:e2e
  env:
    CI: true
    FRONTEND_URL: http://localhost:3000
    BACKEND_URL: http://localhost:8000
```

### Test Reports
- HTML reports with screenshots and videos
- JUnit XML for CI integration
- JSON results for custom processing

## Contributing

### Adding New Tests
1. Follow existing patterns and structure
2. Add appropriate data-testid attributes to components
3. Include both positive and negative test scenarios
4. Update this README with new test patterns

### Test Review Checklist
- [ ] Tests are independent and can run in any order
- [ ] Error scenarios are covered
- [ ] Mobile responsiveness is tested where applicable
- [ ] Performance implications are considered
- [ ] Security aspects are validated

---

For more information about Playwright, visit: https://playwright.dev/