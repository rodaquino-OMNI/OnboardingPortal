<?php

namespace Tests\Unit\Audit;

use Tests\TestCase;
use App\Modules\Gamification\Services\AuditLogService;
use App\Modules\Audit\Repositories\AuditLogRepository;
use App\Models\User;
use App\Models\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Request;
use Mockery;

/**
 * AuditLogServiceTest - Unit tests for HIPAA/LGPD compliant audit logging
 *
 * Test coverage:
 * - WHO-WHAT-WHEN-WHERE-HOW capture
 * - IP address hashing (LGPD privacy)
 * - PHI redaction
 * - Request correlation
 * - Session tracking
 * - System vs user actions
 *
 * Target: ≥8 tests, 90% coverage
 */
class AuditLogServiceTest extends TestCase
{
    use RefreshDatabase;

    private AuditLogService $service;
    private AuditLogRepository $repository;

    protected function setUp(): void
    {
        parent::setUp();

        $this->repository = Mockery::mock(AuditLogRepository::class);
        $this->service = new AuditLogService($this->repository);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    /** @test */
    public function it_logs_audit_entry_with_who_what_when_where_how(): void
    {
        $user = User::factory()->create();

        Request::shouldReceive('ip')->andReturn('192.168.1.100');
        Request::shouldReceive('header')->with('X-Request-ID')->andReturn('req-123');
        Request::shouldReceive('method')->andReturn('POST');
        Request::shouldReceive('path')->andReturn('/api/auth/login');

        $this->repository->shouldReceive('append')
            ->once()
            ->with(Mockery::on(function ($entry) use ($user) {
                return $entry['who'] === "user:{$user->id}"
                    && $entry['what'] === 'user_logged_in'
                    && isset($entry['where']) // Hashed IP
                    && $entry['how'] === 'POST /api/auth/login'
                    && $entry['request_id'] === 'req-123';
            }))
            ->andReturn('log-1');

        $log = $this->service->log($user, 'user_logged_in', ['email' => $user->email]);

        $this->assertInstanceOf(AuditLog::class, $log);
    }

    /** @test */
    public function it_hashes_ip_addresses_for_lgpd_privacy(): void
    {
        $user = User::factory()->create();

        Request::shouldReceive('ip')->andReturn('192.168.1.100');
        Request::shouldReceive('header')->andReturn(null);
        Request::shouldReceive('method')->andReturn('GET');
        Request::shouldReceive('path')->andReturn('/api/test');

        $this->repository->shouldReceive('append')
            ->once()
            ->with(Mockery::on(function ($entry) {
                // IP should be hashed to 16-char SHA-256 prefix
                $hashedIp = $entry['where'];
                return strlen($hashedIp) === 16
                    && ctype_xdigit($hashedIp);
            }))
            ->andReturn('log-1');

        $this->service->log($user, 'test_action');
    }

    /** @test */
    public function it_logs_system_actions_without_user(): void
    {
        Request::shouldReceive('ip')->andReturn('127.0.0.1');
        Request::shouldReceive('header')->andReturn(null);
        Request::shouldReceive('method')->andReturn('CLI');
        Request::shouldReceive('path')->andReturn('artisan:migrate');

        $this->repository->shouldReceive('append')
            ->once()
            ->with(Mockery::on(function ($entry) {
                return $entry['who'] === 'system'
                    && $entry['user_id'] === null;
            }))
            ->andReturn('log-1');

        $log = $this->service->log(null, 'database_migration', ['version' => '2025_01_01']);

        $this->assertInstanceOf(AuditLog::class, $log);
    }

    /** @test */
    public function it_captures_http_method_and_endpoint(): void
    {
        $user = User::factory()->create();

        Request::shouldReceive('ip')->andReturn('127.0.0.1');
        Request::shouldReceive('header')->andReturn(null);
        Request::shouldReceive('method')->andReturn('POST');
        Request::shouldReceive('path')->andReturn('/api/gamification/points/earn');

        $this->repository->shouldReceive('append')
            ->once()
            ->with(Mockery::on(function ($entry) {
                return $entry['how'] === 'POST /api/gamification/points/earn';
            }))
            ->andReturn('log-1');

        $this->service->log($user, 'points_awarded');
    }

    /** @test */
    public function it_captures_cli_command_for_artisan_jobs(): void
    {
        $user = User::factory()->create();

        Request::shouldReceive('ip')->andReturn('127.0.0.1');
        Request::shouldReceive('header')->andReturn(null);

        // Simulate CLI environment
        app()->runningInConsole = true;
        $_SERVER['argv'] = ['artisan', 'queue:work'];

        $this->repository->shouldReceive('append')
            ->once()
            ->with(Mockery::on(function ($entry) {
                return str_contains($entry['how'], 'CLI:');
            }))
            ->andReturn('log-1');

        $this->service->log($user, 'queue_job_processed');
    }

    /** @test */
    public function it_generates_request_id_if_missing(): void
    {
        $user = User::factory()->create();

        Request::shouldReceive('ip')->andReturn('127.0.0.1');
        Request::shouldReceive('header')->with('X-Request-ID')->andReturn(null);
        Request::shouldReceive('method')->andReturn('GET');
        Request::shouldReceive('path')->andReturn('/api/test');

        $this->repository->shouldReceive('append')
            ->once()
            ->with(Mockery::on(function ($entry) {
                // Should generate UUID if no request ID
                return isset($entry['request_id'])
                    && strlen($entry['request_id']) === 36; // UUID format
            }))
            ->andReturn('log-1');

        $this->service->log($user, 'test_action');
    }

    /** @test */
    public function it_uses_provided_request_id_for_correlation(): void
    {
        $user = User::factory()->create();

        Request::shouldReceive('ip')->andReturn('127.0.0.1');
        Request::shouldReceive('header')->with('X-Request-ID')->andReturn('custom-req-123');
        Request::shouldReceive('method')->andReturn('GET');
        Request::shouldReceive('path')->andReturn('/api/test');

        $this->repository->shouldReceive('append')
            ->once()
            ->with(Mockery::on(function ($entry) {
                return $entry['request_id'] === 'custom-req-123';
            }))
            ->andReturn('log-1');

        $this->service->log($user, 'test_action');
    }

    /** @test */
    public function it_allows_explicit_request_id_override(): void
    {
        $user = User::factory()->create();

        Request::shouldReceive('ip')->andReturn('127.0.0.1');
        Request::shouldReceive('header')->andReturn(null);
        Request::shouldReceive('method')->andReturn('GET');
        Request::shouldReceive('path')->andReturn('/api/test');

        $this->repository->shouldReceive('append')
            ->once()
            ->with(Mockery::on(function ($entry) {
                return $entry['request_id'] === 'manual-override-123';
            }))
            ->andReturn('log-1');

        $this->service->log($user, 'test_action', [], 'manual-override-123');
    }

    /** @test */
    public function it_redacts_phi_from_details(): void
    {
        $user = User::factory()->create();

        Request::shouldReceive('ip')->andReturn('127.0.0.1');
        Request::shouldReceive('header')->andReturn(null);
        Request::shouldReceive('method')->andReturn('POST');
        Request::shouldReceive('path')->andReturn('/api/health/submit');

        $detailsWithPhi = [
            'email' => 'user@example.com', // PHI
            'cpf' => '123.456.789-00', // PHI
            'action' => 'questionnaire_submitted', // Safe
            'score' => 85, // Safe
        ];

        $this->repository->shouldReceive('append')
            ->once()
            ->with(Mockery::on(function ($entry) {
                $details = $entry['details'];
                // PHI fields should be removed
                return !isset($details['email'])
                    && !isset($details['cpf'])
                    && isset($details['action'])
                    && isset($details['score']);
            }))
            ->andReturn('log-1');

        $this->service->log($user, 'health_questionnaire_submitted', $detailsWithPhi);
    }

    /** @test */
    public function it_supports_session_tracking(): void
    {
        $user = User::factory()->create();

        Request::shouldReceive('ip')->andReturn('127.0.0.1');
        Request::shouldReceive('header')->andReturn(null);
        Request::shouldReceive('method')->andReturn('GET');
        Request::shouldReceive('path')->andReturn('/api/test');

        // Mock session
        session()->put('session_id', 'session-abc-123');

        $this->repository->shouldReceive('append')
            ->once()
            ->with(Mockery::on(function ($entry) {
                return $entry['session_id'] === 'session-abc-123';
            }))
            ->andReturn('log-1');

        $this->service->log($user, 'test_action');
    }

    /** @test */
    public function it_handles_empty_details_gracefully(): void
    {
        $user = User::factory()->create();

        Request::shouldReceive('ip')->andReturn('127.0.0.1');
        Request::shouldReceive('header')->andReturn(null);
        Request::shouldReceive('method')->andReturn('GET');
        Request::shouldReceive('path')->andReturn('/api/test');

        $this->repository->shouldReceive('append')
            ->once()
            ->with(Mockery::on(function ($entry) {
                return $entry['details'] === [];
            }))
            ->andReturn('log-1');

        $this->service->log($user, 'test_action', []);
    }
}
