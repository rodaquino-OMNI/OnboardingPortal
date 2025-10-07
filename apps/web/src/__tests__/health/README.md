# Health Questionnaire Frontend Tests

## Overview

Comprehensive test suite for health questionnaire components targeting **85%+ coverage** and **100% WCAG 2.1 AA accessibility compliance**.

## Test Files

### 1. `useQuestionnaireOrchestration.test.tsx`
Tests the SWR-based orchestration hook for questionnaire data management.

**Coverage:**
- Schema fetching with SWR caching
- Analytics event tracking (fetch latency, errors, completion)
- Auto-save debouncing (3-second intervals)
- Draft resume functionality
- Response submission and validation
- Error handling and recovery
- Cleanup on unmount

**Key Test Cases:**
- ✅ Fetches schema and tracks fetch latency analytics
- ✅ Auto-saves draft every 3 seconds with debounce
- ✅ Debounces rapid draft saves (only final value saved)
- ✅ Handles auto-save errors without blocking user
- ✅ Cancels pending auto-save on unmount
- ✅ Validates required fields before submission
- ✅ Loads existing draft on mount
- ✅ Tracks question view time and abandonment

**Analytics Events Tested:**
```typescript
'health.schema_fetched'          // Schema load completion
'health.schema_fetch_failed'     // Schema load errors
'health.draft_saved'             // Auto-save success
'health.draft_save_failed'       // Auto-save errors
'health.response_submitted'      // Final submission
'health.validation_failed'       // Validation errors
'health.draft_resumed'           // Draft loaded
'health.question_viewed'         // Question tracking
'health.questionnaire_abandoned' // User exits
```

### 2. `DynamicFormRenderer.test.tsx`
Tests the dynamic form rendering component with accessibility and keyboard navigation.

**Coverage:**
- ARIA label associations
- Required field marking (aria-required)
- Error message associations (aria-describedby)
- Keyboard navigation (Arrow keys, Tab, Home/End)
- Form interaction (onChange, onBlur)
- Progressive disclosure (conditional questions)
- Visual feedback (error highlighting, progress)
- Performance (React.memo optimization)

**Key Test Cases:**
- ✅ Renders PHQ-9 scale with proper ARIA labels
- ✅ Marks required fields with aria-required
- ✅ Associates error messages with aria-describedby
- ✅ Sets aria-invalid on fields with errors
- ✅ Supports arrow key navigation between options
- ✅ Wraps keyboard navigation at boundaries
- ✅ Allows tab navigation between questions
- ✅ Supports Home/End keys for quick navigation
- ✅ Shows conditional questions based on answers
- ✅ Displays completion progress indicator

**Accessibility Features:**
- Screen reader instructions (`sr-only` class)
- Proper radiogroup semantics
- Error role="alert" announcements
- Logical focus order
- No positive tabindex values

### 3. `QuestionnaireContainer.test.tsx`
Tests the main questionnaire container with branching logic and state management.

**Coverage:**
- Loading and error states
- Branching logic (conditional questions)
- Draft resume functionality
- Form submission and validation
- Progress tracking
- Error recovery with retry
- Loading indicators during submission

**Key Test Cases:**
- ✅ Shows loading spinner while fetching schema
- ✅ Displays error message on fetch failure
- ✅ Provides retry button on error
- ✅ Shows conditional questions when condition is met
- ✅ Hides conditional questions when condition not met
- ✅ Clears answers from hidden conditional questions
- ✅ Loads and displays draft answers on mount
- ✅ Allows user to start fresh instead of resuming
- ✅ Validates all required fields before submission
- ✅ Updates progress bar as questions are answered

**Branching Logic:**
```typescript
// Example: PHQ-9 only shown if screening = 'yes'
{
  id: 'phq9_q1',
  condition: {
    question_id: 'has_symptoms',
    operator: 'equals',
    value: 'yes'
  }
}
```

### 4. `questionnaire-a11y.test.tsx`
Comprehensive accessibility testing using jest-axe.

**Coverage:**
- WCAG 2.1 Level A compliance
- WCAG 2.1 Level AA compliance
- Specific success criteria validation
- Screen reader compatibility
- Landmark regions
- Focus management
- Form semantics

**WCAG Success Criteria Tested:**
- ✅ **1.3.1 Info and Relationships (A)** - ARIA structure
- ✅ **1.4.3 Contrast (Minimum) (AA)** - Color contrast
- ✅ **2.1.1 Keyboard (A)** - Keyboard access
- ✅ **2.4.3 Focus Order (A)** - Logical focus order
- ✅ **3.2.2 On Input (A)** - No unexpected changes
- ✅ **3.3.1 Error Identification (A)** - Error messages
- ✅ **3.3.2 Labels or Instructions (A)** - Form labels
- ✅ **4.1.2 Name, Role, Value (A)** - ARIA semantics

**Test Configurations:**
```typescript
// QuestionnaireContainer with complete flow
await axe(container, {
  runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
});

// DynamicFormRenderer with errors
await axe(container, {
  runOnly: ['label', 'aria-describedby', 'color-contrast']
});
```

## Running Tests

### All Tests
```bash
npm test
```

### Health Questionnaire Tests Only
```bash
npm run test:health
```

### Accessibility Tests Only
```bash
npm run test:a11y
```

### With Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

## Coverage Thresholds

### Global
- Branches: 85%
- Functions: 85%
- Lines: 85%
- Statements: 85%

### Health Components
```javascript
'src/components/health/**/*.tsx': {
  branches: 85,
  functions: 85,
  lines: 85,
  statements: 85,
}
```

### Health Hooks
```javascript
'src/hooks/useQuestionnaire*.ts': {
  branches: 85,
  functions: 85,
  lines: 85,
  statements: 85,
}
```

## Test Projects

### Analytics Contracts
- **Display Name:** `analytics-contracts`
- **Environment:** Node
- **Focus:** Schema validation and event contracts

### Unit Tests
- **Display Name:** `unit`
- **Environment:** jsdom
- **Focus:** Component behavior and hooks

### Accessibility Tests
- **Display Name:** `accessibility`
- **Environment:** jsdom
- **Focus:** WCAG 2.1 AA compliance

## Dependencies

### Testing Libraries
- `@testing-library/react` - React component testing
- `@testing-library/jest-dom` - Custom Jest matchers
- `@testing-library/user-event` - User interaction simulation
- `jest-axe` - Accessibility testing
- `ts-jest` - TypeScript support
- `swr` - Data fetching (production dependency)

## Mock Setup

### Global Mocks
```typescript
// Fetch API
global.fetch = jest.fn();

// Analytics
jest.mock('@/lib/analytics', () => ({
  trackEvent: jest.fn(),
}));

// Next.js Router
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
```

### Environment Mocks
```typescript
// matchMedia for responsive tests
window.matchMedia = jest.fn();

// IntersectionObserver
global.IntersectionObserver = class {};

// ResizeObserver
global.ResizeObserver = class {};
```

## Test Patterns

### SWR Testing
```typescript
const wrapper = ({ children }) => (
  <SWRConfig value={{ provider: () => new Map() }}>
    {children}
  </SWRConfig>
);

const { result } = renderHook(() => useQuestionnaireOrchestration(1), {
  wrapper,
});
```

### Async Testing
```typescript
await waitFor(() => {
  expect(result.current.schema).toBeDefined();
});
```

### User Interaction
```typescript
const user = userEvent.setup();
await user.click(button);
await user.type(input, 'text');
await user.selectOptions(select, 'value');
```

### Timer Mocking
```typescript
jest.useFakeTimers();

act(() => {
  jest.advanceTimersByTime(3000);
});
```

## Accessibility Testing Guide

### Running Axe Tests
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

const { container } = render(<Component />);
const results = await axe(container);
expect(results).toHaveNoViolations();
```

### Custom Rules
```typescript
await axe(container, {
  runOnly: ['wcag2a', 'wcag2aa'],
  rules: {
    'color-contrast': { enabled: true },
  },
});
```

## Performance Considerations

### Test Optimization
- Use `waitFor` with timeout for async operations
- Mock timers for debounce/throttle testing
- Use `act()` for state updates
- Clear mocks between tests (`beforeEach`)

### Coverage Optimization
- Test edge cases (empty data, errors)
- Test conditional rendering
- Test cleanup on unmount
- Test error boundaries

## CI Integration

### GitHub Actions
```yaml
- name: Run health questionnaire tests
  run: npm run test:health -- --coverage

- name: Run accessibility tests
  run: npm run test:a11y

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

## Common Issues

### SWR Cache Persistence
**Problem:** Tests interfere with each other due to shared cache.
**Solution:** Use fresh `SWRConfig` provider per test.

### Fake Timers
**Problem:** Auto-save doesn't trigger.
**Solution:** Use `jest.advanceTimersByTime()` after `act()`.

### Accessibility Violations
**Problem:** False positives from testing library markup.
**Solution:** Test the actual component container, not wrapper divs.

## Future Enhancements

- [ ] Add visual regression tests with Playwright
- [ ] Add performance benchmarks with Lighthouse
- [ ] Add E2E tests for full questionnaire flow
- [ ] Add mutation testing with Stryker
- [ ] Add internationalization (i18n) tests
- [ ] Add mobile touch interaction tests
- [ ] Add contrast checker for custom themes

## Resources

- [Testing Library Docs](https://testing-library.com/react)
- [Jest Axe Documentation](https://github.com/nickcolley/jest-axe)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
