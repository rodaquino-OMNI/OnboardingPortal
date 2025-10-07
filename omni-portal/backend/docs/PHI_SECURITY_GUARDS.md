# PHI Security Guards Implementation

## Overview

Runtime PHI encryption validation and security guards for HIPAA compliance.

## Components

### 1. PHIEncryptionGuard Trait
**Location**: `app/Modules/Health/Guards/PHIEncryptionGuard.php`

**Purpose**: Validates all PHI fields are encrypted before database save operations.

**Usage**:
```php
class QuestionnaireResponse extends Model {
    use PHIEncryptionGuard;
    
    protected $encrypted = ['answers_encrypted_json', 'patient_name'];
}
```

**Validation Logic**:
- Checks all fields in `$encrypted` array before save
- Throws `RuntimeException` if unencrypted PHI detected
- Accepts Laravel encrypted format (`encrypted:` prefix)
- Accepts base64 encrypted format (`eyJpdiI6` prefix)
- Allows null/empty values (no PHI)

### 2. AnalyticsPayloadValidator Service
**Location**: `app/Modules/Health/Guards/AnalyticsPayloadValidator.php`

**Purpose**: Ensures analytics events contain NO Protected Health Information.

**Usage**:
```php
$validator = new AnalyticsPayloadValidator();
$validator->validateNoPHI($analyticsPayload);
```

**Forbidden Keys**:
- Direct identifiers: `email`, `phone`, `name`, `dob`, `ssn`, `mrn`
- Encrypted data: `answers_encrypted_json`, `answers_hash`
- Address: `address`, `city`, `zip`, `coordinates`
- Medical: `diagnosis`, `medication`, `symptoms`

**Pattern Detection**:
- Email addresses (regex validation)
- Phone numbers (US format)
- Social Security Numbers

**Sanitization**:
```php
$sanitized = $validator->sanitizePayload($payload);
```

### 3. ResponseAPIGuard Middleware
**Location**: `app/Modules/Health/Guards/ResponseAPIGuard.php`

**Purpose**: Strips PHI from API responses to prevent exposure.

**PHI Fields Stripped**:
- `answers_encrypted_json`, `answers_hash`
- `patient_name`, `email`, `phone`, `dob`
- `diagnosis`, `medications`, `symptoms`
- `password`, `api_token`, `session_token`

**Bypass Routes** (authorized PHI access):
- `api/admin/health/*` - Admin dashboard
- `api/provider/patient/*` - Healthcare provider access
- `api/user/profile/phi` - User's own PHI

**Response Headers**:
- `X-PHI-Stripped: true` - Indicates PHI was removed

## Laravel 11 Integration

### Middleware Registration

**For API routes** (recommended approach in Laravel 11):

**Option 1: Route-specific** (`routes/api.php`):
```php
use App\Modules\Health\Guards\ResponseAPIGuard;

Route::middleware([ResponseAPIGuard::class])->group(function () {
    Route::get('/questionnaires', [QuestionnaireController::class, 'index']);
    Route::post('/questionnaires', [QuestionnaireController::class, 'store']);
});
```

**Option 2: Global API middleware** (`bootstrap/app.php`):
```php
use App\Modules\Health\Guards\ResponseAPIGuard;

return Application::configure(basePath: dirname(__DIR__))
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->api([
            ResponseAPIGuard::class,
        ]);
    })
    ->create();
```

**Option 3: Middleware alias** (`bootstrap/app.php`):
```php
use App\Modules\Health\Guards\ResponseAPIGuard;

return Application::configure(basePath: dirname(__DIR__))
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'phi.guard' => ResponseAPIGuard::class,
        ]);
    })
    ->create();

// Then in routes:
Route::middleware('phi.guard')->group(function () {
    // Routes
});
```

## Testing

### PHIEncryptionGuard Tests
**Location**: `tests/Unit/Modules/Health/Guards/PHIEncryptionGuardTest.php`

**Coverage**:
- Throws exception for unencrypted PHI
- Allows encrypted fields (Laravel/base64 format)
- Allows null/empty values
- Validates multiple PHI fields
- Helper methods (`getEncryptedFields`, `isFieldEncrypted`)

### AnalyticsPayloadValidator Tests
**Location**: `tests/Unit/Modules/Health/Guards/AnalyticsPayloadValidatorTest.php`

**Coverage**:
- Passes for clean payloads
- Detects forbidden PHI keys
- Detects nested PHI
- Pattern detection (email, phone, SSN)
- Sanitization functionality

### ResponseAPIGuard Tests
**Location**: `tests/Unit/Modules/Health/Guards/ResponseAPIGuardTest.php`

**Coverage**:
- Strips PHI from JSON responses
- Handles nested PHI fields
- Bypasses for authorized routes
- Adds security headers
- Handles arrays of objects

### Run Tests
```bash
cd omni-portal/backend
php vendor/bin/phpunit tests/Unit/Modules/Health/Guards/
```

## Security Compliance

### HIPAA Requirements Met
- **45 CFR § 164.312(a)(2)(iv)**: Encryption and Decryption
- **45 CFR § 164.502(b)**: Uses and Disclosures
- **45 CFR § 164.502(d)(2)**: Minimum Necessary Standard

### Audit Logging
All PHI access/validation events are logged:
```php
logger()->critical('PHI_LEAK_DETECTED', [...]);
logger()->info('PHI_ENCRYPTION_VALIDATED', [...]);
logger()->info('PHI_STRIPPED_FROM_RESPONSE', [...]);
```

### Exception Handling
- `PHILeakException`: Critical security exception for PHI exposure
- `RuntimeException`: PHI encryption validation failure
- Both automatically log incidents for security review

## Best Practices

### DO:
- Use guards on all models containing PHI
- Validate analytics payloads before transmission
- Apply ResponseAPIGuard to API routes
- Review audit logs regularly
- Test guards with PHUnit

### DON'T:
- Bypass guards in production
- Log decrypted PHI
- Expose encrypted fields via API
- Disable guards for "convenience"
- Include PHI in analytics events

## Monitoring

### Key Metrics
- PHI encryption failures (should be 0)
- PHI leak detections (should be 0)
- API response stripping events
- Guard bypass usage

### Alerts
Configure alerts for:
- `PHI_LEAK_DETECTED` log entries
- PHI encryption validation failures
- Unauthorized guard bypasses

## Migration Path

### Existing Models
1. Add `use PHIEncryptionGuard;` trait
2. Define `$encrypted` property
3. Run tests to validate encryption
4. Deploy with monitoring

### New Models
1. Include PHIEncryptionGuard from start
2. Define encrypted fields upfront
3. Add comprehensive tests
4. Document PHI handling

## Support

For questions or security concerns:
- Review `docs/phase8/ENCRYPTION_POLICY.md`
- Check ADR-004 (Database PHI Encryption)
- Contact security team for incident response
