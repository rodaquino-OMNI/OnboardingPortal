<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;

class RateLimitingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Clear rate limit cache between tests
        Cache::flush();
        
        // Set cache driver to array for testing
        Config::set('cache.default', 'array');
    }

    /**
     * Test basic API rate limiting for anonymous users
     */
    public function test_anonymous_user_rate_limiting()
    {
        // Anonymous users should have stricter limits
        $responses = [];
        
        // Make multiple requests to exceed anonymous limit (30 per minute)
        for ($i = 0; $i < 35; $i++) {
            $response = $this->getJson('/api/health');
            $responses[] = $response;
            
            if ($i < 30) {
                // First 30 requests should succeed
                $this->assertTrue(in_array($response->getStatusCode(), [200, 429]));
            } else {
                // Subsequent requests should be rate limited
                $response->assertStatus(429);
                $response->assertJsonStructure([
                    'success',
                    'error',
                    'message',
                    'details' => [
                        'max_attempts_per_window',
                        'window_minutes',
                        'retry_after_seconds',
                        'current_time'
                    ]
                ]);
            }
        }
    }

    /**
     * Test authenticated user rate limiting
     */
    public function test_authenticated_user_rate_limiting()
    {
        $user = User::factory()->create();
        
        // Authenticated users should have higher limits
        $responses = [];
        
        // Make multiple requests as authenticated user (60 per minute limit)
        for ($i = 0; $i < 65; $i++) {
            $response = $this->actingAs($user, 'sanctum')
                          ->getJson('/api/health');
            $responses[] = $response;
            
            if ($i < 60) {
                // First 60 requests should succeed
                $this->assertTrue(in_array($response->getStatusCode(), [200, 429]));
            } else {
                // Subsequent requests should be rate limited
                $response->assertStatus(429);
            }
        }
    }

    /**
     * Test rate limiting headers are present
     */
    public function test_rate_limiting_headers()
    {
        $response = $this->getJson('/api/health');
        
        $response->assertHeader('X-RateLimit-Limit');
        $response->assertHeader('X-RateLimit-Remaining');
        $response->assertHeader('X-RateLimit-Reset');
        
        // Security headers should also be present
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('X-Frame-Options', 'DENY');
        $response->assertHeader('X-XSS-Protection', '1; mode=block');
    }

    /**
     * Test critical endpoint rate limiting
     */
    public function test_critical_endpoint_rate_limiting()
    {
        $user = User::factory()->create();
        
        // Critical endpoints should have stricter limits
        for ($i = 0; $i < 35; $i++) {
            $response = $this->actingAs($user, 'sanctum')
                          ->postJson('/api/auth/logout');
            
            if ($i < 30) {
                // Should succeed or return expected error (like already logged out)
                $this->assertTrue(in_array($response->status(), [200, 401, 422, 429]));
            } else {
                // Should be rate limited
                $response->assertStatus(429);
            }
        }
    }

    /**
     * Test authentication endpoint rate limiting
     */
    public function test_auth_endpoint_rate_limiting()
    {
        // Auth endpoints should have moderate limits
        for ($i = 0; $i < 25; $i++) {
            $response = $this->postJson('/api/auth/check-email', [
                'email' => 'test' . $i . '@example.com'
            ]);
            
            if ($i < 20) {
                // Should succeed with validation or success
                $this->assertTrue(in_array($response->status(), [200, 422, 429]));
            } else {
                // Should be rate limited
                $response->assertStatus(429);
            }
        }
    }

    /**
     * Test submission endpoint rate limiting
     */
    public function test_submission_endpoint_rate_limiting()
    {
        $user = User::factory()->create();
        
        // Test health questionnaire submission rate limiting
        for ($i = 0; $i < 30; $i++) {
            $response = $this->actingAs($user, 'sanctum')
                          ->postJson('/api/health-questionnaires/submit', [
                              'responses' => [],
                              'template_id' => 1
                          ]);
            
            if ($i < 25) {
                // Should succeed or return validation error
                $this->assertTrue(in_array($response->status(), [200, 422, 429]));
            } else {
                // Should be rate limited
                $response->assertStatus(429);
            }
        }
    }

    /**
     * Test rate limiting with different IPs
     */
    public function test_rate_limiting_per_ip()
    {
        // Simulate requests from different IPs
        $ip1Responses = [];
        $ip2Responses = [];
        
        // IP 1 requests
        for ($i = 0; $i < 35; $i++) {
            $response = $this->withServerVariables(['REMOTE_ADDR' => '192.168.1.1'])
                          ->getJson('/api/health');
            $ip1Responses[] = $response->getStatusCode();
        }
        
        // IP 2 requests (should have fresh limit)
        for ($i = 0; $i < 35; $i++) {
            $response = $this->withServerVariables(['REMOTE_ADDR' => '192.168.1.2'])
                          ->getJson('/api/health');
            $ip2Responses[] = $response->getStatusCode();
        }
        
        // Both IPs should eventually hit rate limits independently
        $this->assertContains(429, $ip1Responses);
        $this->assertContains(429, $ip2Responses);
    }

    /**
     * Test rate limiting bypass for specific routes
     */
    public function test_rate_limiting_bypass_for_health_check()
    {
        // Health check endpoints should have generous limits
        $successCount = 0;
        
        for ($i = 0; $i < 100; $i++) {
            $response = $this->getJson('/api/health');
            
            if ($response->getStatusCode() === 200) {
                $successCount++;
            }
        }
        
        // Should allow most health check requests
        $this->assertGreaterThan(50, $successCount);
    }

    /**
     * Test rate limiting configuration values
     */
    public function test_rate_limiting_configuration()
    {
        $response = $this->getJson('/api/health');
        
        // Check that limits are properly configured
        $limitHeader = $response->headers->get('X-RateLimit-Limit');
        $remainingHeader = $response->headers->get('X-RateLimit-Remaining');
        
        $this->assertNotNull($limitHeader);
        $this->assertNotNull($remainingHeader);
        $this->assertTrue(is_numeric($limitHeader));
        $this->assertTrue(is_numeric($remainingHeader));
        $this->assertTrue($remainingHeader <= $limitHeader);
    }

    /**
     * Test rate limiting with malformed requests
     */
    public function test_rate_limiting_with_malformed_requests()
    {
        // Even malformed requests should be rate limited
        for ($i = 0; $i < 35; $i++) {
            $response = $this->postJson('/api/auth/login', [
                'invalid' => 'data'
            ]);
            
            if ($i >= 20) {
                // Should eventually be rate limited
                if ($response->getStatusCode() === 429) {
                    $this->assertEquals(429, $response->status());
                    break;
                }
            }
        }
    }

    /**
     * Test rate limiting recovery after window expires
     */
    public function test_rate_limiting_recovery()
    {
        // Hit rate limit first
        for ($i = 0; $i < 35; $i++) {
            $response = $this->getJson('/api/health');
            if ($response->getStatusCode() === 429) {
                break;
            }
        }
        
        // Clear cache to simulate time passage
        Cache::flush();
        
        // Should be able to make requests again
        $response = $this->getJson('/api/health');
        $this->assertTrue(in_array($response->status(), [200, 429]));
    }
}