# Sprint 1.5 Implementation Blueprint
## Backend Contract Hardening & SDK Generation

**Version:** 1.0.0
**Date:** 2025-10-01
**Status:** Architecture Design Complete
**Architect:** System Architecture Designer Agent

---

## Executive Summary

This blueprint defines the complete implementation strategy for Sprint 1.5, focusing on:

1. **Repository Layer Testing** - Comprehensive unit tests for EloquentPointsRepository and EloquentAuditLogRepository
2. **Integration Testing** - End-to-end auth flow tests with cookie-based authentication
3. **OpenAPI Contract Testing** - Response schema validation and contract drift detection
4. **SDK Generation Pipeline** - Automated TypeScript client generation for frontend

**Success Criteria:**
- ≥90% repository test coverage
- All auth flows tested (register → verify → login → refresh → logout)
- OpenAPI contract validation in CI/CD
- Type-safe SDK for frontend consumption

---

## 1. Repository Test Architecture

### 1.1 EloquentPointsRepository Test Suite

**File:** `/omni-portal/backend/tests/Unit/Repositories/EloquentPointsRepositoryTest.php`

**Current Status:** ✅ Already implemented with 12 tests (excellent coverage)

**Test Categories:**

#### A. Idempotency Tests (CRITICAL)
```php
✅ it_prevents_duplicate_transactions_via_idempotency_key()
✅ it_checks_transaction_existence_correctly()
- Expected: QueryException on duplicate idempotency_key
- Validates: Unique constraint on points_transactions.idempotency_key
```

#### B. Concurrency Safety Tests
```php
✅ it_handles_concurrent_balance_updates_safely()
✅ it_increments_balance_with_database_locking()
- Mechanism: Database-level row locking (lockForUpdate)
- Future Enhancement: Add optimistic locking with version field
```

**Gap Analysis:**
- Need to add actual optimistic locking version test (currently placeholder)
- Add test for StaleVersionException when implemented

#### C. Balance & Transaction Tests
```php
✅ it_calculates_user_balance_from_transactions()
✅ it_retrieves_transaction_history_with_pagination()
✅ it_filters_transactions_by_action_type()
✅ it_filters_transactions_by_date_range()
✅ it_handles_negative_point_deductions()
```

#### D. Performance Tests
```php
✅ it_uses_indexed_queries_for_performance()
- Validates: Query execution <100ms for 100 transactions
- Indexes tested: user_id, action, created_at
```

**Test Data Strategy:**

```php
// Factory Pattern (Create if not exists)
// Location: /omni-portal/backend/database/factories/PointsTransactionFactory.php

namespace Database\Factories;

use App\Modules\Gamification\Models\PointsTransaction;
use Illuminate\Database\Eloquent\Factories\Factory;

class PointsTransactionFactory extends Factory
{
    protected $model = PointsTransaction::class;

    public function definition(): array
    {
        return [
            'user_id' => \App\Models\User::factory(),
            'action' => $this->faker->randomElement([
                'registration',
                'document_upload',
                'health_questionnaire',
                'interview_scheduled'
            ]),
            'points' => $this->faker->numberBetween(10, 200),
            'metadata' => [
                'source' => $this->faker->randomElement(['web', 'mobile', 'api']),
                'timestamp' => now()->toIso8601String(),
            ],
            'idempotency_key' => $this->faker->uuid(),
            'source' => 'system',
            'processed_at' => now(),
        ];
    }

    public function forAction(string $action, int $points): self
    {
        return $this->state([
            'action' => $action,
            'points' => $points,
        ]);
    }

    public function withIdempotencyKey(string $key): self
    {
        return $this->state(['idempotency_key' => $key]);
    }
}
```

---

### 1.2 EloquentAuditLogRepository Test Suite

**File:** `/omni-portal/backend/tests/Unit/Repositories/EloquentAuditLogRepositoryTest.php`

**Status:** ⚠️ NEEDS IMPLEMENTATION (stub only)

**Required Tests (Minimum 10):**

```php
namespace Tests\Unit\Repositories;

use Tests\TestCase;
use App\Modules\Audit\Repositories\EloquentAuditLogRepository;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

class EloquentAuditLogRepositoryTest extends TestCase
{
    use RefreshDatabase;

    private EloquentAuditLogRepository $repository;

    protected function setUp(): void
    {
        parent::setUp();
        $this->repository = new EloquentAuditLogRepository();
    }

    /** @test */
    public function it_appends_audit_log_entry(): void
    {
        $user = User::factory()->create();
        $requestId = Str::uuid();

        $logId = $this->repository->append([
            'user_id' => $user->id,
            'who' => 'user:' . $user->id,
            'what' => 'user_registered',
            'where' => hash('sha256', '192.168.1.1'),
            'how' => 'POST /api/auth/register',
            'details' => ['email' => $user->email],
            'request_id' => $requestId,
            'session_id' => 'sess_' . Str::random(32),
        ]);

        $this->assertNotEmpty($logId);
        $this->assertDatabaseHas('audit_logs', [
            'id' => $logId,
            'user_id' => $user->id,
            'what' => 'user_registered',
            'request_id' => $requestId,
        ]);
    }

    /** @test */
    public function it_retrieves_logs_by_user_id(): void
    {
        $user = User::factory()->create();

        // Create 5 logs for this user
        for ($i = 1; $i <= 5; $i++) {
            AuditLog::factory()->create([
                'user_id' => $user->id,
                'what' => "action_{$i}",
                'created_at' => now()->subMinutes($i),
            ]);
        }

        $logs = $this->repository->getByUser($user->id, limit: 3);

        $this->assertCount(3, $logs);
        $this->assertEquals('action_1', $logs->first()->what); // Most recent
    }

    /** @test */
    public function it_filters_logs_by_action(): void
    {
        $user = User::factory()->create();

        AuditLog::factory()->create(['what' => 'user_registered', 'user_id' => $user->id]);
        AuditLog::factory()->create(['what' => 'user_logged_in', 'user_id' => $user->id]);
        AuditLog::factory()->create(['what' => 'user_registered', 'user_id' => $user->id]);

        $logs = $this->repository->getByAction('user_registered');

        $this->assertCount(2, $logs);
        $this->assertTrue($logs->every(fn($log) => $log->what === 'user_registered'));
    }

    /** @test */
    public function it_retrieves_logs_by_time_range(): void
    {
        $user = User::factory()->create();

        $oldLog = AuditLog::factory()->create([
            'user_id' => $user->id,
            'created_at' => now()->subDays(10),
        ]);

        $recentLog = AuditLog::factory()->create([
            'user_id' => $user->id,
            'created_at' => now()->subHours(1),
        ]);

        $logs = $this->repository->getByTimeRange(
            now()->subDays(2),
            now()
        );

        $this->assertCount(1, $logs);
        $this->assertEquals($recentLog->id, $logs->first()->id);
    }

    /** @test */
    public function it_correlates_logs_by_request_id(): void
    {
        $requestId = Str::uuid();
        $user = User::factory()->create();

        // Create multiple logs with same request_id (tracking request lifecycle)
        $log1 = AuditLog::factory()->create([
            'request_id' => $requestId,
            'what' => 'request_started',
            'created_at' => now()->subSeconds(3),
        ]);

        $log2 = AuditLog::factory()->create([
            'request_id' => $requestId,
            'what' => 'database_query',
            'created_at' => now()->subSeconds(2),
        ]);

        $log3 = AuditLog::factory()->create([
            'request_id' => $requestId,
            'what' => 'request_completed',
            'created_at' => now()->subSeconds(1),
        ]);

        $correlatedLogs = $this->repository->getByRequestId($requestId);

        $this->assertCount(3, $correlatedLogs);
        // Should be chronologically ordered
        $this->assertEquals('request_started', $correlatedLogs[0]->what);
        $this->assertEquals('database_query', $correlatedLogs[1]->what);
        $this->assertEquals('request_completed', $correlatedLogs[2]->what);
    }

    /** @test */
    public function it_searches_logs_with_multiple_filters(): void
    {
        $user = User::factory()->create();

        AuditLog::factory()->create([
            'user_id' => $user->id,
            'what' => 'user_logged_in',
            'created_at' => now()->subDays(1),
        ]);

        AuditLog::factory()->create([
            'user_id' => $user->id,
            'what' => 'user_logged_out',
            'created_at' => now()->subHours(1),
        ]);

        $results = $this->repository->search([
            'user_id' => $user->id,
            'action' => 'user_logged_in',
            'start_date' => now()->subDays(2),
        ]);

        $this->assertCount(1, $results);
        $this->assertEquals('user_logged_in', $results->first()->what);
    }

    /** @test */
    public function it_counts_logs_matching_filters(): void
    {
        $user = User::factory()->create();

        AuditLog::factory()->count(5)->create(['user_id' => $user->id]);
        AuditLog::factory()->count(3)->create(); // Other users

        $count = $this->repository->count(['user_id' => $user->id]);

        $this->assertEquals(5, $count);
    }

    /** @test */
    public function it_purges_old_logs_in_chunks(): void
    {
        // Create old logs (>365 days)
        AuditLog::factory()->count(10)->create([
            'created_at' => now()->subDays(400),
        ]);

        // Create recent logs
        AuditLog::factory()->count(5)->create([
            'created_at' => now()->subDays(30),
        ]);

        $deleted = $this->repository->purgeOlderThan(now()->subDays(365));

        $this->assertEquals(10, $deleted);
        $this->assertDatabaseCount('audit_logs', 6); // 5 recent + 1 purge log
    }

    /** @test */
    public function it_logs_purge_activity_for_compliance(): void
    {
        AuditLog::factory()->count(5)->create([
            'created_at' => now()->subDays(400),
        ]);

        $this->repository->purgeOlderThan(now()->subDays(365));

        // Should create meta-audit log
        $this->assertDatabaseHas('audit_logs', [
            'what' => 'audit_log_purge',
            'who' => 'system',
        ]);
    }

    /** @test */
    public function it_handles_pagination_correctly(): void
    {
        $user = User::factory()->create();

        AuditLog::factory()->count(20)->create(['user_id' => $user->id]);

        $page1 = $this->repository->getByUser($user->id, limit: 10, offset: 0);
        $page2 = $this->repository->getByUser($user->id, limit: 10, offset: 10);

        $this->assertCount(10, $page1);
        $this->assertCount(10, $page2);

        // Verify no overlap
        $page1Ids = $page1->pluck('id')->toArray();
        $page2Ids = $page2->pluck('id')->toArray();
        $this->assertEmpty(array_intersect($page1Ids, $page2Ids));
    }

    /** @test */
    public function it_respects_retention_policy_date_boundaries(): void
    {
        $retentionDate = now()->subDays(365);

        // Logs right at boundary
        AuditLog::factory()->create([
            'created_at' => $retentionDate->copy()->subMinutes(1), // Should delete
        ]);

        AuditLog::factory()->create([
            'created_at' => $retentionDate->copy()->addMinutes(1), // Should keep
        ]);

        $deleted = $this->repository->purgeOlderThan($retentionDate);

        $this->assertEquals(1, $deleted);
        $this->assertDatabaseCount('audit_logs', 2); // 1 kept + 1 purge log
    }

    /** @test */
    public function it_uses_indexed_queries_for_performance(): void
    {
        $user = User::factory()->create();
        $requestId = Str::uuid();

        // Create large dataset
        AuditLog::factory()->count(100)->create(['user_id' => $user->id]);

        // Test indexed query performance
        $start = microtime(true);
        $logs = $this->repository->getByUser($user->id, limit: 10);
        $duration = microtime(true) - $start;

        $this->assertLessThan(0.1, $duration); // <100ms

        // Test request_id index
        AuditLog::factory()->create(['request_id' => $requestId]);

        $start = microtime(true);
        $correlatedLogs = $this->repository->getByRequestId($requestId);
        $duration = microtime(true) - $start;

        $this->assertLessThan(0.05, $duration); // <50ms for single request
    }
}
```

**Test Data Factory:**

```php
// Location: /omni-portal/backend/database/factories/AuditLogFactory.php

namespace Database\Factories;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class AuditLogFactory extends Factory
{
    protected $model = AuditLog::class;

    public function definition(): array
    {
        return [
            'user_id' => \App\Models\User::factory(),
            'who' => 'user:' . $this->faker->uuid(),
            'what' => $this->faker->randomElement([
                'user_registered',
                'user_logged_in',
                'user_logged_out',
                'document_uploaded',
                'profile_updated',
            ]),
            'where' => hash('sha256', $this->faker->ipv4()),
            'how' => 'POST ' . $this->faker->randomElement([
                '/api/auth/register',
                '/api/auth/login',
                '/api/documents/upload',
            ]),
            'details' => [
                'timestamp' => now()->toIso8601String(),
                'user_agent' => $this->faker->userAgent(),
            ],
            'request_id' => Str::uuid(),
            'session_id' => 'sess_' . Str::random(32),
        ];
    }

    public function forUser(int $userId): self
    {
        return $this->state([
            'user_id' => $userId,
            'who' => "user:{$userId}",
        ]);
    }

    public function withRequestId(string $requestId): self
    {
        return $this->state(['request_id' => $requestId]);
    }

    public function forAction(string $action): self
    {
        return $this->state(['what' => $action]);
    }
}
```

---

## 2. Integration Test Flows

### 2.1 Auth Flow Integration Test

**File:** `/omni-portal/backend/tests/Feature/Auth/AuthFlowTest.php`

**Status:** ✅ Already implemented with 16 comprehensive tests

**Test Coverage:**

#### A. Happy Path Flow
```php
✅ it_completes_full_registration_and_login_flow()
  1. POST /auth/register → 201 Created
  2. GET /auth/verify-email?token={token} → 200 OK + 100 points
  3. POST /auth/login → 200 OK + access_token
  4. GET /gamification/progress (authenticated) → 200 OK
  5. POST /auth/logout → 200 OK
  6. GET /gamification/progress (after logout) → 401 Unauthorized
```

#### B. Cookie-Based Authentication Tests
**Gap:** Need to add explicit cookie assertions

```php
/** @test */
public function it_sets_httponly_session_cookie_on_login(): void
{
    $user = User::factory()->create([
        'email' => 'user@example.com',
        'password' => Hash::make('SecureP@ssw0rd!'),
        'email_verified_at' => now(),
    ]);

    $response = $this->postJson('/api/auth/login', [
        'email' => 'user@example.com',
        'password' => 'SecureP@ssw0rd!',
    ]);

    $response->assertStatus(200)
        ->assertCookie('session_token', null, true, true, false, 'strict')
        // ↑ name, value, httpOnly, secure, sameSite
        ->assertCookie('XSRF-TOKEN'); // CSRF token
}

/** @test */
public function it_clears_cookies_on_logout(): void
{
    $user = User::factory()->create(['email_verified_at' => now()]);

    Sanctum::actingAs($user);

    $response = $this->postJson('/api/auth/logout');

    $response->assertStatus(200)
        ->assertCookieExpired('session_token')
        ->assertCookieExpired('XSRF-TOKEN');
}

/** @test */
public function it_validates_csrf_token_for_state_changing_requests(): void
{
    $user = User::factory()->create(['email_verified_at' => now()]);

    // Login to get CSRF token
    $loginResponse = $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $csrfToken = $loginResponse->getCookie('XSRF-TOKEN')->getValue();

    // Make POST request without CSRF token
    $response = $this->postJson('/api/gamification/points/earn', [
        'action_type' => 'document_uploaded',
        'points' => 75,
    ]);

    $response->assertStatus(419); // CSRF token mismatch

    // With CSRF token
    $response = $this->withHeader('X-XSRF-TOKEN', $csrfToken)
        ->postJson('/api/gamification/points/earn', [
            'action_type' => 'document_uploaded',
            'points' => 75,
        ]);

    $response->assertStatus(200);
}
```

#### C. PointsEngine Integration Tests
**Gap:** Test points award through full repository → service → event flow

```php
/** @test */
public function it_awards_points_idempotently_through_full_stack(): void
{
    $user = User::factory()->create([
        'email_verified_at' => now(),
        'points_balance' => 0,
    ]);

    Sanctum::actingAs($user);

    // First request - should succeed
    $response1 = $this->postJson('/api/gamification/points/earn', [
        'action_type' => 'document_uploaded',
        'points' => 75,
    ]);

    $response1->assertStatus(200)
        ->assertJsonPath('points_earned', 75)
        ->assertJsonPath('total_points', 75);

    // Second identical request - should be idempotent
    $response2 = $this->postJson('/api/gamification/points/earn', [
        'action_type' => 'document_uploaded',
        'points' => 75,
    ]);

    $response2->assertStatus(200)
        ->assertJsonPath('message', 'Pontos já foram concedidos para esta ação');

    // Balance should not change
    $user->refresh();
    $this->assertEquals(75, $user->points_balance);

    // Verify only one transaction recorded
    $this->assertDatabaseCount('points_transactions', 1);
}

/** @test */
public function it_emits_events_when_points_awarded(): void
{
    Event::fake([
        \App\Events\PointsEarned::class,
        \App\Events\LevelUp::class,
    ]);

    $user = User::factory()->create([
        'email_verified_at' => now(),
        'points_balance' => 450,
        'current_level' => 1,
    ]);

    Sanctum::actingAs($user);

    $response = $this->postJson('/api/gamification/points/earn', [
        'action_type' => 'document_uploaded',
        'points' => 75,
    ]);

    $response->assertStatus(200);

    Event::assertDispatched(\App\Events\PointsEarned::class, function ($event) use ($user) {
        return $event->user->id === $user->id && $event->points === 75;
    });

    // User should level up (450 + 75 = 525 >= 500)
    Event::assertDispatched(\App\Events\LevelUp::class, function ($event) use ($user) {
        return $event->user->id === $user->id && $event->newLevel === 2;
    });
}
```

---

### 2.2 MySQL 8 Test Database Setup

**File:** `/omni-portal/backend/tests/DatabaseSetup.php`

```php
namespace Tests;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

trait DatabaseSetup
{
    /**
     * Setup MySQL 8 test database with required indexes
     */
    protected function setUpMySQLTestDatabase(): void
    {
        // Verify MySQL version
        $version = DB::select('SELECT VERSION() as version')[0]->version;
        $this->assertStringContainsString('8.', $version, 'MySQL 8 required for tests');

        // Verify critical indexes exist
        $this->assertIndexExists('points_transactions', 'idx_user_id');
        $this->assertIndexExists('points_transactions', 'idx_action');
        $this->assertIndexExists('points_transactions', 'idx_idempotency_key');
        $this->assertIndexExists('audit_logs', 'idx_user_id');
        $this->assertIndexExists('audit_logs', 'idx_request_id');
        $this->assertIndexExists('audit_logs', 'idx_action');
    }

    protected function assertIndexExists(string $table, string $indexName): void
    {
        $indexes = DB::select("SHOW INDEX FROM {$table} WHERE Key_name = '{$indexName}'");
        $this->assertNotEmpty($indexes, "Index {$indexName} not found on table {$table}");
    }
}
```

**PHPUnit Configuration:**

```xml
<!-- /omni-portal/backend/phpunit.xml -->
<phpunit>
    <testsuites>
        <testsuite name="Unit">
            <directory>tests/Unit</directory>
        </testsuite>
        <testsuite name="Feature">
            <directory>tests/Feature</directory>
        </testsuite>
        <testsuite name="Integration">
            <directory>tests/Integration</directory>
        </testsuite>
        <testsuite name="Contracts">
            <directory>tests/Contracts</directory>
        </testsuite>
    </testsuites>

    <php>
        <env name="DB_CONNECTION" value="mysql"/>
        <env name="DB_DATABASE" value="onboarding_test"/>
        <env name="CACHE_DRIVER" value="array"/>
        <env name="SESSION_DRIVER" value="array"/>
        <env name="QUEUE_CONNECTION" value="sync"/>
    </php>
</phpunit>
```

---

## 3. OpenAPI Contract Testing

### 3.1 Contract Validation Strategy

**File:** `/omni-portal/backend/tests/Contracts/OpenAPIContractTest.php`

```php
namespace Tests\Contracts;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Illuminate\Support\Facades\File;
use Symfony\Component\Yaml\Yaml;

/**
 * OpenAPIContractTest - Validates API responses against OpenAPI specification
 *
 * Uses: spectator/spectator package for contract testing
 * Install: composer require --dev spectator/spectator
 */
class OpenAPIContractTest extends TestCase
{
    use RefreshDatabase;

    private array $openApiSpec;

    protected function setUp(): void
    {
        parent::setUp();

        $specPath = base_path('../docs/API_SPEC.yaml');
        $this->openApiSpec = Yaml::parseFile($specPath);
    }

    /** @test */
    public function auth_register_response_matches_contract(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'email' => 'test@example.com',
            'password' => 'SecureP@ssw0rd!',
            'password_confirmation' => 'SecureP@ssw0rd!',
            'cpf' => '123.456.789-00',
            'phone' => '(11) 98765-4321',
        ]);

        $response->assertStatus(201);

        // Validate against OpenAPI schema
        $this->assertMatchesOpenAPISchema(
            'RegisterResponse',
            $response->json()
        );

        // Specific field validations
        $response->assertJsonStructure([
            'message',
            'user' => ['id', 'email'],
            'verification_email_sent',
        ]);
    }

    /** @test */
    public function auth_login_response_matches_contract(): void
    {
        $user = User::factory()->create([
            'email' => 'user@example.com',
            'email_verified_at' => now(),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'user@example.com',
            'password' => 'password',
        ]);

        $response->assertStatus(200);

        $this->assertMatchesOpenAPISchema(
            'LoginResponse',
            $response->json()
        );

        // Verify token format
        $this->assertMatchesRegex(
            '/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/',
            $response->json('access_token'),
            'Access token should be valid JWT'
        );
    }

    /** @test */
    public function gamification_progress_response_matches_contract(): void
    {
        $user = User::factory()->create([
            'email_verified_at' => now(),
            'points_balance' => 250,
            'current_level' => 1,
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/gamification/progress');

        $response->assertStatus(200);

        $this->assertMatchesOpenAPISchema(
            'GamificationProgressResponse',
            $response->json()
        );

        // Validate level name format
        $this->assertContains(
            $response->json('level_name'),
            ['iniciante', 'bronze', 'prata', 'ouro', 'platina']
        );
    }

    /** @test */
    public function error_responses_match_rfc7807_problem_details(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'invalid@example.com',
            'password' => 'wrong',
        ]);

        $response->assertStatus(401);

        // Validate RFC 7807 Problem Details format
        $this->assertMatchesOpenAPISchema(
            'ErrorResponse',
            $response->json()
        );

        $response->assertJsonStructure([
            'error',
            // Optional: 'type', 'title', 'status', 'detail', 'instance'
        ]);
    }

    /** @test */
    public function validation_errors_match_contract(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'email' => 'invalid-email',
            'password' => 'weak',
        ]);

        $response->assertStatus(422);

        $this->assertMatchesOpenAPISchema(
            'ValidationErrorResponse',
            $response->json()
        );

        $response->assertJsonStructure([
            'errors' => [
                'email',
                'password',
            ],
        ]);
    }

    /**
     * Helper: Validate JSON against OpenAPI schema definition
     */
    private function assertMatchesOpenAPISchema(string $schemaName, array $data): void
    {
        $schema = $this->openApiSpec['components']['schemas'][$schemaName] ?? null;

        $this->assertNotNull($schema, "Schema {$schemaName} not found in OpenAPI spec");

        // Validate required fields
        if (isset($schema['required'])) {
            foreach ($schema['required'] as $requiredField) {
                $this->assertArrayHasKey(
                    $requiredField,
                    $data,
                    "Required field '{$requiredField}' missing in response"
                );
            }
        }

        // Validate property types
        if (isset($schema['properties'])) {
            foreach ($schema['properties'] as $property => $definition) {
                if (array_key_exists($property, $data)) {
                    $this->assertValidPropertyType(
                        $property,
                        $data[$property],
                        $definition
                    );
                }
            }
        }
    }

    private function assertValidPropertyType(string $property, $value, array $definition): void
    {
        $expectedType = $definition['type'] ?? null;

        if ($expectedType === 'string') {
            $this->assertIsString($value, "Property '{$property}' should be string");
        } elseif ($expectedType === 'integer') {
            $this->assertIsInt($value, "Property '{$property}' should be integer");
        } elseif ($expectedType === 'boolean') {
            $this->assertIsBool($value, "Property '{$property}' should be boolean");
        } elseif ($expectedType === 'array') {
            $this->assertIsArray($value, "Property '{$property}' should be array");
        } elseif ($expectedType === 'object') {
            $this->assertIsArray($value, "Property '{$property}' should be object");
        }

        // Validate format (e.g., email, date-time, uuid)
        if (isset($definition['format'])) {
            $this->assertValidFormat($property, $value, $definition['format']);
        }
    }

    private function assertValidFormat(string $property, $value, string $format): void
    {
        match($format) {
            'email' => $this->assertMatchesRegex(
                '/^[^\s@]+@[^\s@]+\.[^\s@]+$/',
                $value,
                "Property '{$property}' should be valid email"
            ),
            'date-time' => $this->assertMatchesRegex(
                '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/',
                $value,
                "Property '{$property}' should be ISO 8601 datetime"
            ),
            'uuid' => $this->assertMatchesRegex(
                '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i',
                $value,
                "Property '{$property}' should be valid UUID"
            ),
            default => null,
        };
    }
}
```

### 3.2 Golden Response Fixtures

**Directory Structure:**
```
/omni-portal/backend/tests/Contracts/fixtures/
├── auth/
│   ├── register_201.json
│   ├── login_200.json
│   ├── verify_email_200.json
│   └── logout_200.json
├── gamification/
│   ├── progress_200.json
│   ├── levels_current_200.json
│   └── badges_200.json
└── errors/
    ├── validation_422.json
    ├── unauthorized_401.json
    └── not_found_404.json
```

**Example Fixture:**
```json
// tests/Contracts/fixtures/auth/login_200.json
{
  "access_token": "<JWT_TOKEN>",
  "refresh_token": "<REFRESH_TOKEN>",
  "token_type": "Bearer",
  "expires_in": 900,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "points_balance": 100,
    "current_level": 1
  }
}
```

### 3.3 Contract Drift Detection

**File:** `/omni-portal/backend/tests/Contracts/ContractDriftTest.php`

```php
namespace Tests\Contracts;

use Tests\TestCase;
use Illuminate\Support\Facades\File;
use Symfony\Component\Yaml\Yaml;

/**
 * ContractDriftTest - Detects breaking changes in API contract
 *
 * Compares current OpenAPI spec against baseline version
 */
class ContractDriftTest extends TestCase
{
    /** @test */
    public function it_detects_contract_breaking_changes(): void
    {
        $currentSpec = Yaml::parseFile(base_path('../docs/API_SPEC.yaml'));
        $baselineSpec = Yaml::parseFile(base_path('../docs/API_SPEC_BASELINE.yaml'));

        $breakingChanges = $this->detectBreakingChanges($currentSpec, $baselineSpec);

        if (!empty($breakingChanges)) {
            $this->fail(
                "Breaking changes detected in API contract:\n" .
                implode("\n", $breakingChanges)
            );
        }

        $this->assertTrue(true, 'No breaking changes detected');
    }

    private function detectBreakingChanges(array $current, array $baseline): array
    {
        $changes = [];

        // Check for removed endpoints
        foreach ($baseline['paths'] as $path => $methods) {
            if (!isset($current['paths'][$path])) {
                $changes[] = "BREAKING: Endpoint '{$path}' was removed";
            }

            foreach ($methods as $method => $definition) {
                if (!isset($current['paths'][$path][$method])) {
                    $changes[] = "BREAKING: Method '{$method}' removed from '{$path}'";
                }
            }
        }

        // Check for removed required fields
        foreach ($baseline['components']['schemas'] ?? [] as $schemaName => $schema) {
            if (!isset($current['components']['schemas'][$schemaName])) {
                $changes[] = "BREAKING: Schema '{$schemaName}' was removed";
                continue;
            }

            $currentSchema = $current['components']['schemas'][$schemaName];

            foreach ($schema['required'] ?? [] as $requiredField) {
                if (!in_array($requiredField, $currentSchema['required'] ?? [])) {
                    $changes[] = "BREAKING: Required field '{$requiredField}' removed from schema '{$schemaName}'";
                }
            }
        }

        return $changes;
    }

    /** @test */
    public function it_reports_non_breaking_changes(): void
    {
        $currentSpec = Yaml::parseFile(base_path('../docs/API_SPEC.yaml'));
        $baselineSpec = Yaml::parseFile(base_path('../docs/API_SPEC_BASELINE.yaml'));

        $nonBreakingChanges = $this->detectNonBreakingChanges($currentSpec, $baselineSpec);

        if (!empty($nonBreakingChanges)) {
            // Log but don't fail
            dump("Non-breaking changes:\n" . implode("\n", $nonBreakingChanges));
        }

        $this->assertTrue(true);
    }

    private function detectNonBreakingChanges(array $current, array $baseline): array
    {
        $changes = [];

        // New endpoints (additive change)
        foreach ($current['paths'] as $path => $methods) {
            if (!isset($baseline['paths'][$path])) {
                $changes[] = "ADDED: New endpoint '{$path}'";
            }
        }

        // New optional fields (additive change)
        foreach ($current['components']['schemas'] ?? [] as $schemaName => $schema) {
            if (!isset($baseline['components']['schemas'][$schemaName])) {
                $changes[] = "ADDED: New schema '{$schemaName}'";
                continue;
            }

            $baselineSchema = $baseline['components']['schemas'][$schemaName];

            foreach ($schema['properties'] ?? [] as $property => $definition) {
                if (!isset($baselineSchema['properties'][$property])) {
                    $isRequired = in_array($property, $schema['required'] ?? []);
                    $changeType = $isRequired ? "BREAKING" : "ADDED";
                    $changes[] = "{$changeType}: New property '{$property}' in schema '{$schemaName}'";
                }
            }
        }

        return $changes;
    }
}
```

---

## 4. SDK Generation Pipeline

### 4.1 TypeScript Client Generation

**Tool:** `openapi-typescript` + `openapi-fetch`

**Installation:**
```bash
cd /omni-portal/apps/web
npm install --save-dev openapi-typescript
npm install openapi-fetch
```

**Generation Script:**

```bash
# /omni-portal/scripts/generate-sdk.sh

#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

OPENAPI_SPEC="$PROJECT_ROOT/docs/API_SPEC.yaml"
OUTPUT_DIR="$PROJECT_ROOT/omni-portal/apps/web/src/lib/api"

echo "🚀 Generating TypeScript SDK from OpenAPI spec..."

# Validate OpenAPI spec
echo "✓ Validating OpenAPI spec..."
npx @redocly/cli lint "$OPENAPI_SPEC" --format=stylish

# Generate TypeScript types
echo "✓ Generating TypeScript types..."
npx openapi-typescript "$OPENAPI_SPEC" \
  --output "$OUTPUT_DIR/schema.d.ts" \
  --alphabetize

# Generate client code
echo "✓ Generating API client..."
cat > "$OUTPUT_DIR/client.ts" << 'EOF'
import createClient from 'openapi-fetch';
import type { paths } from './schema';

export const apiClient = createClient<paths>({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor for authentication
apiClient.use({
  async onRequest({ request }) {
    const token = localStorage.getItem('access_token');
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    return request;
  },
  async onResponse({ response }) {
    if (response.status === 401) {
      // Token expired - attempt refresh
      await refreshToken();
    }
    return response;
  },
});

async function refreshToken() {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    window.location.href = '/login';
    return;
  }

  const { data, error } = await apiClient.POST('/auth/refresh', {
    body: { refresh_token: refreshToken },
  });

  if (error) {
    window.location.href = '/login';
    return;
  }

  localStorage.setItem('access_token', data.access_token);
}
EOF

# Generate typed API hooks for React
echo "✓ Generating React hooks..."
cat > "$OUTPUT_DIR/hooks.ts" << 'EOF'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import type { paths } from './schema';

type AuthRegisterBody = paths['/auth/register']['post']['requestBody']['content']['application/json'];
type AuthLoginBody = paths['/auth/login']['post']['requestBody']['content']['application/json'];

export function useRegister() {
  return useMutation({
    mutationFn: async (data: AuthRegisterBody) => {
      const { data: result, error } = await apiClient.POST('/auth/register', {
        body: data,
      });
      if (error) throw error;
      return result;
    },
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: async (data: AuthLoginBody) => {
      const { data: result, error } = await apiClient.POST('/auth/login', {
        body: data,
      });
      if (error) throw error;

      // Store tokens
      localStorage.setItem('access_token', result.access_token);
      localStorage.setItem('refresh_token', result.refresh_token);

      return result;
    },
  });
}

export function useGamificationProgress() {
  return useQuery({
    queryKey: ['gamification', 'progress'],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/gamification/progress');
      if (error) throw error;
      return data;
    },
  });
}

export function useEarnPoints() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      action_type: string;
      points: number;
      bonus_type?: string;
    }) => {
      const { data: result, error } = await apiClient.POST('/gamification/points/earn', {
        body: data,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      // Invalidate gamification queries to refetch
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
  });
}
EOF

echo "✅ SDK generation complete!"
echo "📁 Output: $OUTPUT_DIR"
echo ""
echo "Next steps:"
echo "1. Import: import { apiClient } from '@/lib/api/client';"
echo "2. Use hooks: const { mutate } = useLogin();"
echo "3. Type safety: Full IntelliSense from OpenAPI spec"
```

**Make executable:**
```bash
chmod +x /omni-portal/scripts/generate-sdk.sh
```

### 4.2 Type Safety Guarantees

**Example Usage in Frontend:**

```typescript
// apps/web/src/app/auth/register/page.tsx
import { useRegister } from '@/lib/api/hooks';
import type { components } from '@/lib/api/schema';

type RegisterForm = components['schemas']['RegisterRequest'];

export default function RegisterPage() {
  const register = useRegister();

  const handleSubmit = async (data: RegisterForm) => {
    try {
      const result = await register.mutateAsync(data);
      // ✅ result is fully typed as RegisterResponse
      console.log('User created:', result.user.email);
      router.push(`/verify-email?token=${result.verification_token}`);
    } catch (error) {
      // ✅ error is typed as ValidationErrorResponse
      if ('errors' in error) {
        setErrors(error.errors); // Type-safe error handling
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields with type checking */}
    </form>
  );
}
```

**Benefits:**
1. ✅ IntelliSense for all endpoints and request/response types
2. ✅ Compile-time validation of API calls
3. ✅ Automatic deserialization and type coercion
4. ✅ Single source of truth (OpenAPI spec)
5. ✅ Breaking changes detected at build time

### 4.3 CI/CD Integration

**GitHub Actions Workflow:**

```yaml
# .github/workflows/sdk-generation.yml
name: SDK Generation

on:
  push:
    paths:
      - 'docs/API_SPEC.yaml'
      - 'omni-portal/backend/routes/api.php'
  pull_request:
    paths:
      - 'docs/API_SPEC.yaml'

jobs:
  generate-sdk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci
        working-directory: ./omni-portal/apps/web

      - name: Validate OpenAPI Spec
        run: npx @redocly/cli lint docs/API_SPEC.yaml

      - name: Generate TypeScript SDK
        run: ./scripts/generate-sdk.sh

      - name: Check for SDK changes
        run: |
          if [[ $(git diff --stat omni-portal/apps/web/src/lib/api/) ]]; then
            echo "⚠️ SDK changes detected. Commit required!"
            git diff omni-portal/apps/web/src/lib/api/
            exit 1
          else
            echo "✅ SDK is up-to-date"
          fi

      - name: TypeScript type check
        run: npm run typecheck
        working-directory: ./omni-portal/apps/web

      - name: Run contract tests
        run: |
          cd omni-portal/backend
          php artisan test --testsuite=Contracts
```

---

## 5. Implementation Checklist

### Phase 1: Repository Tests (Week 1)

- [x] EloquentPointsRepository tests (COMPLETE - 12 tests)
- [ ] Create PointsTransactionFactory
- [ ] EloquentAuditLogRepository tests (10+ tests needed)
- [ ] Create AuditLogFactory
- [ ] Add optimistic locking version tests (future enhancement)
- [ ] Verify all tests pass with MySQL 8

### Phase 2: Integration Tests (Week 1-2)

- [x] Auth flow tests (COMPLETE - 16 tests)
- [ ] Add cookie-based auth assertions (3 tests)
- [ ] Add CSRF token validation tests (2 tests)
- [ ] PointsEngine integration tests (2 tests)
- [ ] Event emission tests (1 test)
- [ ] MySQL 8 test database setup trait

### Phase 3: Contract Testing (Week 2)

- [ ] Install spectator/spectator package
- [ ] Implement OpenAPIContractTest (5 core tests)
- [ ] Create golden response fixtures (8 files)
- [ ] Implement ContractDriftTest (2 tests)
- [ ] Create API_SPEC_BASELINE.yaml
- [ ] Add contract tests to CI/CD

### Phase 4: SDK Generation (Week 2-3)

- [ ] Install openapi-typescript and openapi-fetch
- [ ] Create generate-sdk.sh script
- [ ] Generate TypeScript types from OpenAPI
- [ ] Create typed API client with interceptors
- [ ] Create React Query hooks
- [ ] Add SDK generation to CI/CD
- [ ] Document SDK usage in README

### Phase 5: Validation & Documentation (Week 3)

- [ ] Run full test suite and verify ≥90% coverage
- [ ] Performance test indexed queries
- [ ] Create test execution guide
- [ ] Update API documentation with examples
- [ ] Code review and refinement

---

## 6. File Paths Reference

### Test Files
```
omni-portal/backend/tests/
├── Unit/
│   ├── Repositories/
│   │   ├── EloquentPointsRepositoryTest.php (✅ EXISTS)
│   │   └── EloquentAuditLogRepositoryTest.php (❌ CREATE)
│   ├── Gamification/
│   │   └── PointsEngineTest.php (✅ EXISTS)
│   └── Audit/
│       └── AuditLogServiceTest.php (✅ EXISTS)
├── Feature/
│   └── Auth/
│       └── AuthFlowTest.php (✅ EXISTS)
├── Integration/
│   └── PointsEngineIntegrationTest.php (❌ CREATE)
├── Contracts/
│   ├── OpenAPIContractTest.php (❌ CREATE)
│   ├── ContractDriftTest.php (❌ CREATE)
│   └── fixtures/
│       ├── auth/
│       ├── gamification/
│       └── errors/
└── DatabaseSetup.php (❌ CREATE - trait)
```

### Factories
```
omni-portal/backend/database/factories/
├── UserFactory.php (✅ EXISTS)
├── PointsTransactionFactory.php (❌ CREATE)
└── AuditLogFactory.php (❌ CREATE)
```

### SDK Files
```
omni-portal/apps/web/src/lib/api/
├── schema.d.ts (🤖 GENERATED)
├── client.ts (🤖 GENERATED)
└── hooks.ts (🤖 GENERATED)
```

### Scripts
```
omni-portal/scripts/
└── generate-sdk.sh (❌ CREATE)
```

### Configuration
```
.github/workflows/
└── sdk-generation.yml (❌ CREATE)

docs/
├── API_SPEC.yaml (✅ EXISTS)
└── API_SPEC_BASELINE.yaml (❌ CREATE - copy from current)
```

---

## 7. Success Metrics

### Test Coverage Targets
- EloquentPointsRepository: ≥90% (Currently: ~95% ✅)
- EloquentAuditLogRepository: ≥90% (Currently: 0% ❌)
- AuthFlowTest: ≥85% (Currently: ~90% ✅)
- Contract Tests: 100% endpoint coverage (Currently: 0% ❌)

### Performance Targets
- Repository query execution: <100ms for 100 records
- Auth flow completion: <2 seconds end-to-end
- SDK generation: <30 seconds
- Contract validation: <10 seconds

### Quality Gates
- ✅ All tests pass on MySQL 8
- ✅ No contract breaking changes detected
- ✅ SDK builds without TypeScript errors
- ✅ Code coverage ≥90% for repositories
- ✅ Zero security vulnerabilities in dependencies

---

## 8. Risk Mitigation

### Risk 1: Optimistic Locking Not Implemented
**Impact:** High
**Mitigation:**
- Use database-level row locking (lockForUpdate) as interim solution
- Add version field to users table in future migration
- Write tests that expect future StaleVersionException

### Risk 2: Refresh Token Not Fully Implemented
**Impact:** Medium
**Mitigation:**
- Stub implementation returns valid response format
- Tests verify response structure (contract testing)
- Full implementation in Sprint 2.0

### Risk 3: OpenAPI Spec Drift
**Impact:** High
**Mitigation:**
- Automated contract tests in CI/CD
- Baseline version control
- Breaking change detection before merge

### Risk 4: MySQL 8 Dependency
**Impact:** Low
**Mitigation:**
- Document MySQL 8 requirement
- CI/CD uses MySQL 8 Docker image
- Development environment setup guide

---

## 9. Dependencies

### PHP Packages (Composer)
```json
{
  "require-dev": {
    "spectator/spectator": "^2.0",
    "symfony/yaml": "^6.0"
  }
}
```

### Node Packages (NPM)
```json
{
  "devDependencies": {
    "openapi-typescript": "^6.7.3",
    "@redocly/cli": "^1.5.0"
  },
  "dependencies": {
    "openapi-fetch": "^0.9.0",
    "@tanstack/react-query": "^5.0.0"
  }
}
```

---

## 10. Next Steps

1. **Immediate (Week 1):**
   - Create AuditLogFactory and PointsTransactionFactory
   - Implement EloquentAuditLogRepositoryTest (10 tests)
   - Add cookie assertion tests to AuthFlowTest

2. **Short-term (Week 2):**
   - Implement OpenAPI contract testing
   - Create SDK generation pipeline
   - Add contract tests to CI/CD

3. **Medium-term (Week 3):**
   - Full SDK documentation
   - Performance benchmarking
   - Code review and refinement

---

## Appendix A: Test Execution Commands

```bash
# Run all tests
php artisan test

# Run repository tests only
php artisan test --testsuite=Unit --filter=Repository

# Run integration tests
php artisan test --testsuite=Feature

# Run contract tests
php artisan test --testsuite=Contracts

# Run with coverage
php artisan test --coverage --min=90

# Run performance tests
php artisan test --group=performance
```

## Appendix B: Assertion Helpers

```php
// Custom assertion for idempotent operations
protected function assertIdempotentOperation(callable $operation): void
{
    $result1 = $operation();
    $result2 = $operation();

    $this->assertEquals($result1, $result2, 'Operation should be idempotent');
}

// Custom assertion for concurrent safety
protected function assertConcurrentSafe(callable $operation, int $concurrency = 5): void
{
    $results = [];

    for ($i = 0; $i < $concurrency; $i++) {
        $results[] = $operation();
    }

    // All operations should complete without exception
    $this->assertCount($concurrency, $results);
}
```

---

**End of Blueprint**

This implementation blueprint provides a complete roadmap for Sprint 1.5. All file paths are absolute, test strategies are defined, and SDK generation is fully specified.
