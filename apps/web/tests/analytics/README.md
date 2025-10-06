# Analytics Contract Tests

## Overview

This directory contains comprehensive contract tests for the analytics infrastructure, validating that all event payloads conform to strict JSON schemas with AJV validation.

## Structure

```
tests/analytics/
├── fixtures/           # Test fixtures for all 9 event types
│   ├── gamification.points_earned.fixture.json
│   ├── gamification.level_up.fixture.json
│   ├── gamification.badge_unlocked.fixture.json
│   ├── auth.registration_started.fixture.json
│   ├── auth.registration_completed.fixture.json
│   ├── auth.email_verified.fixture.json
│   ├── documents.upload_completed.fixture.json
│   ├── documents.approved.fixture.json
│   └── documents.upload_failed.fixture.json
└── contracts/          # Contract test suites
    └── analytics-schema-contracts.test.ts
```

## Running Tests

### Run all analytics contract tests
```bash
npm run test:analytics
```

### Run in watch mode
```bash
npm run test:analytics:watch
```

### Run with coverage
```bash
npm run test:analytics -- --coverage
```

## Test Coverage Requirements

- **Schema Coverage**: 100% - All 9 event types must have comprehensive fixtures
- **Code Coverage**: 95% minimum for analytics infrastructure
- **PII/PHI Validation**: 100% - All events must be validated for PII/PHI absence

## Contract Test Features

### 1. Schema Validation
- Validates all event payloads against JSON schemas using AJV strict mode
- Tests both valid and invalid fixtures for each event type
- Ensures no additional properties beyond schema definitions

### 2. PII/PHI Protection
- Scans for CPF patterns
- Scans for RG patterns
- Scans for email addresses (except domain-only fields)
- Scans for phone numbers
- Validates user_id hashing format
- Validates approved_by hashing format

### 3. Cross-Schema Validation
- Ensures consistent user_id hashing across all events
- Validates context structure consistency
- Checks schema integrity and compilation

### 4. Performance Testing
- Validates that 1000 events can be validated in under 100ms
- Ensures efficient schema compilation

## CI/CD Integration

The analytics contract tests are integrated into the CI/CD pipeline via `.github/workflows/analytics-contracts.yml`:

- **Required Check**: All PRs must pass analytics contract tests
- **Schema Drift Detection**: Automatically detects and reports schema changes
- **PII/PHI Scanning**: Automated scanning in CI for PII/PHI patterns
- **Coverage Enforcement**: Enforces minimum 95% test coverage

## Fixture Structure

Each fixture file contains an array of test cases:

```json
[
  {
    "name": "Valid event description",
    "valid": true,
    "event": {
      "schema_version": "1.0.0",
      "event": "event.type",
      "timestamp": "2025-10-03T12:00:00.000Z",
      "user_id": "hash_...",
      "platform": "web",
      "properties": { ... },
      "context": { ... }
    }
  },
  {
    "name": "Invalid event description",
    "valid": false,
    "event": { ... }
  }
]
```

## Best Practices

### Adding New Event Types

1. Create JSON schema in `lib/analytics/schemas/`
2. Update TypeScript types in `lib/analytics/types.ts`
3. Create fixture file in `tests/analytics/fixtures/`
4. Add test case in contract test suite
5. Run tests locally before committing

### Fixture Guidelines

- Include at least 2 valid test cases per event type
- Include at least 2 invalid test cases per event type
- Test edge cases (min/max values, optional fields)
- Never include real PII/PHI data
- Use realistic but synthetic data
- Always use hashed user IDs with `hash_` prefix

### Schema Changes

When modifying schemas:

1. Ensure backward compatibility
2. Update schema version if breaking changes
3. Update all related fixtures
4. Run full test suite
5. Update documentation
6. Notify analytics team

## Troubleshooting

### Tests failing with "Schema not found"
- Verify schema file exists in `lib/analytics/schemas/`
- Check schema `$id` matches the expected value
- Ensure schema is imported in `emitter.ts`

### PII/PHI validation errors
- Check fixture data for patterns matching real PII
- Ensure user_id uses `hash_` prefix
- Verify email fields only contain domains, not full addresses

### Performance test failures
- Check for complex schema patterns
- Verify AJV configuration matches production
- Consider schema optimization if consistently slow

## Related Documentation

- [Analytics Specification](../../lib/analytics/ANALYTICS_SPEC.md)
- [Schema Documentation](../../lib/analytics/schemas/README.md)
- [CI/CD Pipeline](../../.github/workflows/analytics-contracts.yml)
