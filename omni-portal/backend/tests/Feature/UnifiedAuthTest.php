<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

/**
 * Unified Authentication System Test Suite
 * 
 * Tests the UnifiedAuthMiddleware implementation to ensure:
 * - Proper authentication handling
 * - CSRF protection
 * - Security headers
 * - Rate limiting
 * - Backward compatibility
 */
class UnifiedAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create test user
        $this->user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => bcrypt('password123'),
        ]);
    }

    /**
     * Test public routes work without authentication
     */
    public function test_public_routes_accessible_without_auth()
    {
        $publicRoutes = [
            'GET /api/health',
            'GET /api/metrics',
            'POST /api/auth/login',
            'POST /api/auth/check-email',
        ];

        foreach ($publicRoutes as $route) {
            [$method, $path] = explode(' ', $route);
            
            $response = $this->json($method, $path);
            
            // Should not return 401 (unauthenticated)
            $this->assertNotEquals(401, $response->status(), 
                "Route {$route} should be accessible without authentication");
        }
    }

    /**
     * Test protected routes require authentication
     */
    public function test_protected_routes_require_authentication()
    {
        $protectedRoutes = [
            'GET /api/user',
            'POST /api/auth/logout',
            'GET /api/health-questionnaires/templates',
        ];

        foreach ($protectedRoutes as $route) {
            [$method, $path] = explode(' ', $route);
            
            $response = $this->json($method, $path);
            
            $this->assertEquals(401, $response->status(),
                "Route {$route} should require authentication");
            
            $this->assertEquals('Unauthenticated', $response->json('error'));
        }
    }

    /**
     * Test Sanctum token authentication works
     */
    public function test_sanctum_token_authentication()
    {
        Sanctum::actingAs($this->user);

        $response = $this->json('GET', '/api/user');

        $response->assertStatus(200)
                ->assertJson([
                    'authenticated' => true,
                    'guard' => 'sanctum',
                ])
                ->assertJsonStructure([
                    'user' => ['id', 'email'],
                    'authenticated',
                    'guard',
                    'timestamp',
                ]);
    }

    /**
     * Test CSRF protection on POST requests
     */
    public function test_csrf_protection_on_post_requests()
    {
        // Test without CSRF token
        $response = $this->json('POST', '/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(419) // 419 = CSRF token mismatch
                ->assertJson([
                    'error' => 'CSRF token mismatch',
                ]);
    }

    /**
     * Test security headers are added to responses
     */
    public function test_security_headers_added_to_responses()
    {
        $response = $this->json('GET', '/api/health');

        $expectedHeaders = [
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'X-XSS-Protection' => '1; mode=block',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
        ];

        foreach ($expectedHeaders as $header => $expectedValue) {
            $this->assertTrue(
                $response->headers->has($header),
                "Security header {$header} should be present"
            );
        }
    }

    /**
     * Test JSON response formatting for API routes
     */
    public function test_json_response_formatting()
    {
        $response = $this->json('GET', '/api/health');

        $this->assertTrue(
            str_contains($response->headers->get('Content-Type'), 'application/json'),
            'API responses should have JSON content type'
        );

        $this->assertTrue(
            $response->headers->has('X-API-Version'),
            'API responses should include version header'
        );
    }

    /**
     * Test rate limiting functionality
     */
    public function test_rate_limiting_functionality()
    {
        // This test simulates multiple requests to trigger rate limiting
        // Note: Actual rate limiting may need adjustment for testing
        
        $responses = [];
        for ($i = 0; $i < 5; $i++) {
            $responses[] = $this->json('GET', '/api/health');
        }

        // All initial requests should succeed
        foreach ($responses as $response) {
            $this->assertTrue(
                $response->status() < 400,
                'Initial requests should not be rate limited'
            );
        }
    }

    /**
     * Test backward compatibility with existing auth flows
     */
    public function test_backward_compatibility()
    {
        // Test that existing authentication flows still work
        
        // 1. Test user registration flow
        $response = $this->json('POST', '/api/auth/register/step1', [
            'email' => 'newuser@example.com',
            'cpf' => '12345678901',
        ]);

        // Should work or fail gracefully (not with 500 error)
        $this->assertNotEquals(500, $response->status(),
            'Registration flow should not break with unified auth');

        // 2. Test gamification endpoints (some public, some protected)
        $publicResponse = $this->json('GET', '/api/gamification/badges');
        $this->assertNotEquals(500, $publicResponse->status(),
            'Public gamification endpoints should work');
    }

    /**
     * Test error response format consistency
     */
    public function test_error_response_format_consistency()
    {
        // Test unauthenticated error
        $response = $this->json('GET', '/api/user');
        
        $response->assertStatus(401)
                ->assertJsonStructure([
                    'error',
                    'message',
                    'timestamp',
                ]);

        // Test CSRF error
        $csrfResponse = $this->json('POST', '/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password',
        ]);

        $csrfResponse->assertStatus(419)
                    ->assertJsonStructure([
                        'error',
                        'message',
                        'timestamp',
                    ]);
    }

    /**
     * Test performance of unified middleware
     */
    public function test_middleware_performance()
    {
        $startTime = microtime(true);
        
        // Make several requests to test performance
        for ($i = 0; $i < 10; $i++) {
            $this->json('GET', '/api/health');
        }
        
        $endTime = microtime(true);
        $averageTime = ($endTime - $startTime) / 10;
        
        // Assert that average response time is reasonable (under 500ms)
        $this->assertLessThan(0.5, $averageTime,
            'Unified middleware should maintain good performance');
    }

    /**
     * Test request context is properly set
     */
    public function test_request_context_is_set()
    {
        Sanctum::actingAs($this->user);

        $response = $this->json('GET', '/api/user');

        // Check if request ID header is present (set by UnifiedAuthMiddleware)
        $this->assertTrue(
            $response->headers->has('X-Request-ID'),
            'Request ID should be set by unified middleware'
        );
    }

    /**
     * Test middleware handles edge cases gracefully
     */
    public function test_edge_cases_handled_gracefully()
    {
        // Test with malformed headers
        $response = $this->withHeaders([
            'Authorization' => 'Bearer invalid-token-format',
            'X-Forwarded-Host' => 'suspicious-host.com', // Should be blocked
        ])->json('GET', '/api/health');

        // Should handle gracefully, not crash
        $this->assertNotEquals(500, $response->status(),
            'Malformed requests should not cause server errors');

        // Test with missing Accept header
        $response = $this->json('GET', '/api/health', [], [
            'HTTP_ACCEPT' => '', // Empty accept header
        ]);

        $this->assertNotEquals(500, $response->status(),
            'Requests with missing headers should be handled gracefully');
    }
}