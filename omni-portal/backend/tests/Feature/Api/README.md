# Integration Tests - Onboarding Portal API

This directory contains comprehensive end-to-end integration tests for the Onboarding Portal API, focusing on complete user journeys and cross-feature data consistency.

## Test Suites

### 1. UserJourneyEndToEndTest.php
**Purpose**: Tests the complete user journey from registration to interview scheduling.

**Key Scenarios**:
- Complete user journey with progressive disclosure
- Multi-step registration process
- Health assessment with AI insights
- Document upload with OCR processing
- Interview scheduling with timezone support
- Gamification progress tracking
- LGPD compliance throughout the journey

**Coverage**:
- Registration (3 steps)
- Profile setup
- Health questionnaire submission
- Document processing pipeline
- Interview booking
- Data export and privacy

### 2. MultiRoleWorkflowIntegrationTest.php
**Purpose**: Tests complex workflows involving multiple user roles (beneficiary, healthcare professional, admin, reviewer).

**Key Scenarios**:
- Complete multi-role workflow from registration to approval
- Role-based access control enforcement
- Concurrent operations by different roles
- Workflow rollback and error recovery
- Audit trail across all role actions
- Permission boundary testing

**Roles Tested**:
- Beneficiary: Registration, document upload, health assessment
- Healthcare Professional: Health review, interview conduct
- Document Reviewer: Document validation with OCR
- Admin: Final approval and system oversight

### 3. DataConsistencyIntegrationTest.php
**Purpose**: Ensures data consistency across all features during concurrent operations.

**Key Scenarios**:
- Concurrent updates from multiple sources
- Transaction rollback on failures
- Cascade updates across related models
- Event-driven data synchronization
- Cache consistency with database
- Referential integrity constraints
- LGPD data privacy and anonymization

**Technical Coverage**:
- Database transactions
- Event dispatching
- Queue job processing
- Cache invalidation
- Audit logging

### 4. DocumentProcessingPipelineTest.php
**Purpose**: Tests the complete document processing pipeline including OCR with fallback mechanisms.

**Key Scenarios**:
- Complete document upload and OCR processing
- Primary OCR failure and fallback activation
- Batch document processing
- Document type-specific validation rules
- Performance metrics tracking
- Network failure handling
- Concurrent upload handling

**OCR Features**:
- Primary service integration
- Fallback service activation
- Data extraction and validation
- Confidence scoring
- Retry mechanisms

## Running the Tests

### Run All Integration Tests
```bash
./run-integration-tests.sh
```

### Run Specific Test Suite
```bash
# Run only user journey tests
php artisan test --configuration=phpunit.integration.xml --testsuite="UserJourney"

# Run specific test file
php artisan test tests/Feature/Api/UserJourneyEndToEndTest.php

# Run with coverage
php artisan test --configuration=phpunit.integration.xml --coverage
```

### Test Environment Configuration
The tests use the following environment settings:
- Database: SQLite in-memory
- Queue: Synchronous
- Cache: Array driver
- OCR: Mocked services
- Storage: Fake disk

## Key Testing Patterns

### 1. Progressive Disclosure Testing
Tests verify that features are unlocked based on user progress:
- Basic profile → Health assessment unlocked
- Health complete → Document upload unlocked
- Documents verified → Interview scheduling unlocked

### 2. Role-Based Access Testing
Each test verifies proper permission enforcement:
```php
// Beneficiary cannot access admin endpoints
Sanctum::actingAs($beneficiary);
$response = $this->getJson('/api/admin/users');
$response->assertStatus(403);
```

### 3. Data Consistency Verification
Tests ensure data remains consistent across operations:
```php
// Verify cascade updates
$this->beneficiary->refresh();
$this->assertTrue($this->beneficiary->documents_verified);
$this->assertTrue($this->beneficiary->health_assessment_completed);
```

### 4. OCR Fallback Testing
Tests verify automatic fallback when primary service fails:
```php
// Mock primary failure
$this->ocrService->shouldReceive('processDocument')
    ->andReturn(['success' => false]);

// Verify fallback activated
$this->assertEquals('fallback', $document->ocr_metadata['service']);
```

## Test Data Factories

The tests use Laravel factories for consistent test data:
- User factory with role variations
- Beneficiary factory with progress states
- Document factory with OCR metadata
- Interview factory with scheduling options
- Gamification factories for badges and levels

## Assertions and Verifications

### Database Assertions
```php
$this->assertDatabaseHas('beneficiaries', [
    'status' => 'approved',
    'documents_verified' => true
]);
```

### API Response Assertions
```php
$response->assertStatus(200)
    ->assertJsonStructure([
        'user' => ['id', 'email', 'beneficiary']
    ]);
```

### Event and Job Assertions
```php
Event::assertDispatched(DocumentUploaded::class);
Queue::assertPushed(ProcessDocumentOCR::class);
```

## Performance Considerations

- Tests use in-memory SQLite for speed
- Faker data is minimal but realistic
- HTTP requests are mocked when possible
- OCR services are mocked to avoid external dependencies

## Continuous Integration

These tests are designed to run in CI/CD pipelines:
- Total runtime: ~2-3 minutes
- Memory usage: < 256MB
- No external service dependencies
- Generates coverage reports

## Contributing

When adding new integration tests:
1. Follow the existing naming convention
2. Group related scenarios in single test files
3. Use descriptive test method names
4. Include both positive and negative test cases
5. Verify audit logs and events
6. Test permission boundaries
7. Include LGPD compliance checks where relevant