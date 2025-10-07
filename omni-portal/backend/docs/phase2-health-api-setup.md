# Phase 2: Health Questionnaire API Setup

## Created Files

### 1. API Controller
**File:** `app/Http/Controllers/Api/Health/QuestionnaireController.php`

**Endpoints:**
- `GET /api/v1/health/schema` - Returns questionnaire schema (NO PHI)
- `POST /api/v1/health/response` - Create/submit response (draft or final)
- `GET /api/v1/health/response/{id}` - Get response metadata (NO decrypted answers)
- `PATCH /api/v1/health/response/{id}` - Update draft response

**Security:**
- Feature flag: `sliceC_health` (default: disabled)
- Rate limiting: 10 submissions/hour per user
- All endpoints require `auth:sanctum`
- Submission requires `verified` email
- User isolation (own responses only, admin bypass)
- Comprehensive audit logging

### 2. Domain Events
**Files:**
- `app/Modules/Health/Events/HealthQuestionnaireStarted.php`
- `app/Modules/Health/Events/HealthQuestionnaireSubmitted.php`
- `app/Modules/Health/Events/HealthQuestionnaireReviewed.php`

**Event Payload (NO PHI):**
- User hash (SHA-256, never plaintext)
- Version, duration_ms, risk_band, score_redacted
- NO answers, NO free text

### 3. Event Listener
**File:** `app/Modules/Health/Listeners/PersistHealthAnalytics.php`

**Features:**
- Asynchronous (queued to `analytics` queue)
- Persists to `analytics_events` table
- Retry logic: 3 attempts with exponential backoff
- PII-free analytics

### 4. Feature Flag Middleware
**File:** `app/Http/Middleware/FeatureFlagMiddleware.php`

**Usage:**
```php
Route::get('/endpoint', [Controller::class, 'method'])
    ->middleware('feature.flag:sliceC_health');
```

**Middleware Alias Registration:**
Add to `bootstrap/app.php` or equivalent kernel registration:
```php
protected $middlewareAliases = [
    'feature.flag' => \App\Http\Middleware\FeatureFlagMiddleware::class,
];
```

### 5. Feature Flag Seeder
**File:** `database/seeders/FeatureFlagSeeder.php`

**Flags:**
- `sliceC_health` (default: disabled)
- `sliceB_documents` (default: disabled)
- `gamification` (default: enabled)
- `registration_flow` (default: enabled)

## Routes Updated

**File:** `routes/api.php`

Added health questionnaire routes under `v1/health` prefix:
```php
Route::prefix('health')->middleware(['feature.flag:sliceC_health'])->group(function () {
    Route::get('/schema', [QuestionnaireController::class, 'getSchema']);
    Route::post('/response', [QuestionnaireController::class, 'createResponse'])
        ->middleware('verified');
    Route::get('/response/{id}', [QuestionnaireController::class, 'getResponse']);
    Route::patch('/response/{id}', [QuestionnaireController::class, 'updateResponse']);
});
```

## Event Service Provider Updated

**File:** `app/Providers/EventServiceProvider.php`

Added health event listener:
```php
HealthQuestionnaireSubmitted::class => [
    PersistHealthAnalytics::class,
],
```

## Analytics Schema Updated

**File:** `app/Services/AnalyticsEventRepository.php`

Added event schemas:
- `health.questionnaire_started`
- `health.questionnaire_submitted`
- `health.questionnaire_reviewed`

## Manual Setup Steps

### 1. Register Middleware Alias (Laravel 11)
In your application bootstrap or middleware configuration, register the alias:

**Option A: Via `bootstrap/app.php` (Laravel 11+)**
```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'feature.flag' => \App\Http\Middleware\FeatureFlagMiddleware::class,
    ]);
})
```

**Option B: Via service provider**
Create or update `app/Providers/AppServiceProvider.php`:
```php
use Illuminate\Routing\Router;

public function boot(Router $router)
{
    $router->aliasMiddleware('feature.flag', \App\Http\Middleware\FeatureFlagMiddleware::class);
}
```

### 2. Run Database Seeder
```bash
php artisan db:seed --class=FeatureFlagSeeder
```

### 3. Enable Feature Flag (When Ready)
```bash
php artisan tinker
>>> app(\App\Services\FeatureFlagService::class)->toggle('sliceC_health');
```

Or via seeder update:
```php
FeatureFlag::where('key', 'sliceC_health')->update(['enabled' => true]);
```

## Security Features

### PHI Protection
1. **Encrypted Storage:** All answers encrypted via `encrypt()` before database storage
2. **NO Decryption in Responses:** API never returns decrypted answers
3. **User Hash Only:** Analytics uses SHA-256 hash, never plaintext user IDs
4. **Audit Logging:** All PHI access logged with IP, user agent, timestamp

### Rate Limiting
- 10 submissions per hour per user
- 429 Too Many Requests with retry_after
- Rate limit key: `health_submission:{user_id}`

### Authorization
- User isolation: Can only access own responses
- Admin bypass: Admin role can review any response
- Email verification required for submission

### Audit Trail
All controller actions create `AuditLog` entries:
- `health.questionnaire.schema_accessed`
- `health.questionnaire.draft_saved`
- `health.questionnaire.submitted`
- `health.questionnaire.response_viewed`
- `health.questionnaire.draft_updated`

## Testing Endpoints

### 1. Get Schema (Feature Flag Disabled)
```bash
curl -X GET http://localhost:8000/api/v1/health/schema \
  -H "Authorization: Bearer {token}"

# Expected: 403 Forbidden (feature disabled)
```

### 2. Get Schema (Feature Flag Enabled)
```bash
curl -X GET http://localhost:8000/api/v1/health/schema \
  -H "Authorization: Bearer {token}"

# Expected: 200 OK with schema
```

### 3. Submit Response (Draft)
```bash
curl -X POST http://localhost:8000/api/v1/health/response \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "questionnaire_id": 1,
    "answers": [
      {"question_id": "q1", "value": true},
      {"question_id": "q2", "value": false}
    ],
    "is_draft": true
  }'

# Expected: 201 Created with draft status
```

### 4. Submit Response (Final)
```bash
curl -X POST http://localhost:8000/api/v1/health/response \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "questionnaire_id": 1,
    "answers": [
      {"question_id": "q1", "value": true},
      {"question_id": "q2", "value": false}
    ],
    "is_draft": false
  }'

# Expected: 201 Created with score_redacted and risk_band
```

## Analytics Event Structure

### HealthQuestionnaireSubmitted Event
```json
{
  "event_name": "health.questionnaire_submitted",
  "event_category": "health",
  "schema_version": "1.0.0",
  "user_id_hash": "sha256(user_id)",
  "metadata": {
    "version": 1,
    "duration_ms": 300000,
    "risk_band": "low|medium|high",
    "score_redacted": "70-80"
  },
  "context": {
    "questionnaire_id": 123
  },
  "occurred_at": "2025-10-06T20:17:39.000Z"
}
```

## Next Steps (Phase 3)

1. **Database Migration:** Create `health_questionnaires` table with PHI encryption
2. **QuestionnaireTemplate Model:** Replace placeholder queries
3. **Scoring Algorithm:** Implement actual risk scoring logic
4. **Admin Review UI:** Build admin dashboard for reviewing responses
5. **Analytics Dashboard:** Visualize health submission trends

## Deliverables Summary

- ✅ API Controller with 4 endpoints
- ✅ 3 Domain events (Started, Submitted, Reviewed)
- ✅ Event listener for analytics persistence
- ✅ Feature flag middleware
- ✅ Feature flag seeder
- ✅ Routes updated
- ✅ Event service provider updated
- ✅ Analytics schema updated
- ✅ Comprehensive audit logging
- ✅ Rate limiting
- ✅ PHI encryption
- ✅ Zero PHI in API responses

All endpoints are secured, feature-flagged, and emit de-identified events for the analytics pipeline.
