<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;
use App\Models\User;
use App\Events\SessionFingerprintMismatch;
use App\Services\SessionFingerprintService;
use App\Http\Middleware\SessionFingerprintMiddleware;

class SessionFingerprintTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Enable fingerprinting for tests
        Config::set('session.fingerprinting', true);
        Config::set('session.fingerprint_mode', 'balanced');
        Config::set('session.max_fingerprint_mismatches', 3);
        
        // Fake events to avoid actual email sending
        Event::fake();
    }

    public function test_fingerprint_middleware_can_be_applied(): void
    {
        $user = User::factory()->create();
        
        $response = $this->actingAs($user)
            ->withHeaders([
                'User-Agent' => 'Mozilla/5.0 Test Browser',
                'Accept-Language' => 'en-US,en;q=0.9',
            ])
            ->get('/api/user');
            
        $response->assertStatus(200);
    }

    public function test_fingerprint_is_generated_on_login(): void
    {
        $user = User::factory()->create();
        
        // Clear any existing session data
        Session::flush();
        
        // Simulate login
        $response = $this->withHeaders([
            'User-Agent' => 'Mozilla/5.0 Test Browser',
            'Accept-Language' => 'en-US,en;q=0.9',
            'Accept-Encoding' => 'gzip, deflate',
        ])->actingAs($user)->get('/api/user');
        
        $response->assertStatus(200);
        
        // Check that fingerprint data exists in session
        $fingerprintInfo = SessionFingerprintMiddleware::getFingerprintInfo();
        $this->assertTrue($fingerprintInfo['has_fingerprint']);
        $this->assertNotNull($fingerprintInfo['created_at']);
    }

    public function test_fingerprint_validation_succeeds_with_same_characteristics(): void
    {
        $user = User::factory()->create();
        
        $headers = [
            'User-Agent' => 'Mozilla/5.0 Test Browser',
            'Accept-Language' => 'en-US,en;q=0.9',
            'Accept-Encoding' => 'gzip, deflate',
        ];
        
        // First request - establishes fingerprint
        $this->actingAs($user)
            ->withHeaders($headers)
            ->get('/api/user')
            ->assertStatus(200);
        
        // Second request with same headers - should pass validation
        $this->actingAs($user)
            ->withHeaders($headers)
            ->get('/api/user')
            ->assertStatus(200);
        
        // Verify no mismatch events were fired
        Event::assertNotDispatched(SessionFingerprintMismatch::class);
    }

    public function test_fingerprint_mismatch_is_detected(): void
    {
        $user = User::factory()->create();
        
        // First request - establishes fingerprint
        $this->actingAs($user)
            ->withHeaders([
                'User-Agent' => 'Mozilla/5.0 Test Browser',
                'Accept-Language' => 'en-US,en;q=0.9',
            ])
            ->get('/api/user')
            ->assertStatus(200);
        
        // Second request with different user agent
        $response = $this->actingAs($user)
            ->withHeaders([
                'User-Agent' => 'Mozilla/5.0 Different Browser',
                'Accept-Language' => 'en-US,en;q=0.9',
            ])
            ->get('/api/user');
        
        // Should still return 200 but with warning
        $response->assertStatus(200);
        
        // Check that mismatch was logged
        $fingerprintInfo = SessionFingerprintMiddleware::getFingerprintInfo();
        $this->assertGreaterThan(0, $fingerprintInfo['mismatch_count']);
    }

    public function test_session_invalidated_after_max_mismatches(): void
    {
        $user = User::factory()->create();
        
        // First request - establishes fingerprint
        $this->actingAs($user)
            ->withHeaders([
                'User-Agent' => 'Mozilla/5.0 Test Browser',
                'Accept-Language' => 'en-US,en;q=0.9',
            ])
            ->get('/api/user')
            ->assertStatus(200);
        
        // Generate multiple mismatches
        for ($i = 0; $i < 4; $i++) {
            $response = $this->actingAs($user)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 Different Browser ' . $i,
                    'Accept-Language' => 'en-US,en;q=0.9',
                ])
                ->get('/api/user');
                
            if ($i >= 2) {
                // After 3 mismatches, session should be invalidated
                $response->assertStatus(419); // Authentication Timeout
                break;
            }
        }
    }

    public function test_fingerprint_service_status_method(): void
    {
        $user = User::factory()->create();
        $service = new SessionFingerprintService();
        
        // Initial status should show no fingerprint
        $status = $service->getFingerprintStatus();
        $this->assertFalse($status['has_fingerprint']);
        
        // After login, should show active fingerprint
        $request = $this->createMockRequest();
        $service->onUserLogin($request, $user);
        
        $status = $service->getFingerprintStatus();
        $this->assertTrue($status['has_fingerprint']);
        $this->assertEquals('active', $status['status']);
    }

    public function test_fingerprint_validation_bypassed_for_excluded_routes(): void
    {
        // Health endpoints should not trigger fingerprinting
        $response = $this->get('/api/health');
        $response->assertStatus(200);
        
        // CSRF cookie endpoint should not trigger fingerprinting
        $response = $this->get('/sanctum/csrf-cookie');
        $response->assertSuccessful();
    }

    public function test_fingerprint_modes_affect_ip_validation(): void
    {
        $user = User::factory()->create();
        
        // Test strict mode (should detect IP changes)
        Config::set('session.fingerprint_mode', 'strict');
        
        $this->actingAs($user)
            ->withServerVariables(['REMOTE_ADDR' => '192.168.1.1'])
            ->withHeaders(['User-Agent' => 'Test Browser'])
            ->get('/api/user')
            ->assertStatus(200);
        
        // Request from different IP should trigger mismatch in strict mode
        $response = $this->actingAs($user)
            ->withServerVariables(['REMOTE_ADDR' => '192.168.1.2'])
            ->withHeaders(['User-Agent' => 'Test Browser'])
            ->get('/api/user');
            
        // Should detect mismatch
        $fingerprintInfo = SessionFingerprintMiddleware::getFingerprintInfo();
        $this->assertGreaterThan(0, $fingerprintInfo['mismatch_count']);
    }

    public function test_fingerprint_regeneration_on_logout(): void
    {
        $user = User::factory()->create();
        $service = new SessionFingerprintService();
        
        // Login and establish fingerprint
        $request = $this->createMockRequest();
        $service->onUserLogin($request, $user);
        
        $statusBefore = $service->getFingerprintStatus();
        $this->assertTrue($statusBefore['has_fingerprint']);
        
        // Logout
        Auth::login($user);
        $service->onUserLogout($request);
        
        // Fingerprint should be cleared
        $statusAfter = $service->getFingerprintStatus();
        $this->assertFalse($statusAfter['has_fingerprint']);
    }

    public function test_fingerprint_includes_browser_characteristics(): void
    {
        $user = User::factory()->create();
        
        // Test with custom browser characteristics headers
        $response = $this->actingAs($user)
            ->withHeaders([
                'User-Agent' => 'Mozilla/5.0 Test Browser',
                'Accept-Language' => 'en-US,en;q=0.9',
                'X-Screen-Resolution' => '1920x1080',
                'X-Timezone' => 'America/New_York',
                'X-Browser-Features' => 'webgl,canvas,touch',
            ])
            ->get('/api/user');
            
        $response->assertStatus(200);
        
        // Verify fingerprint was created with enhanced characteristics
        $fingerprintInfo = SessionFingerprintMiddleware::getFingerprintInfo();
        $this->assertTrue($fingerprintInfo['has_fingerprint']);
    }

    public function test_fingerprint_analysis_returns_insights(): void
    {
        $service = new SessionFingerprintService();
        $analysis = $service->analyzeFingerprintPatterns(30);
        
        $this->assertArrayHasKey('period_days', $analysis);
        $this->assertArrayHasKey('recommendations', $analysis);
        $this->assertEquals(30, $analysis['period_days']);
        $this->assertIsArray($analysis['recommendations']);
    }

    protected function createMockRequest()
    {
        return $this->app['request']->create(
            '/api/user',
            'GET',
            [],
            [],
            [],
            [
                'REMOTE_ADDR' => '127.0.0.1',
                'HTTP_USER_AGENT' => 'Test Browser',
                'HTTP_ACCEPT_LANGUAGE' => 'en-US,en;q=0.9',
            ]
        );
    }
}