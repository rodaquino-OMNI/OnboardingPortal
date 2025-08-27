<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

class SecurityHeadersTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that security headers are properly set
     */
    public function test_security_headers_present()
    {
        $response = $this->getJson('/api/health');
        
        // Rate limiting headers
        $response->assertHeader('X-RateLimit-Limit');
        $response->assertHeader('X-RateLimit-Remaining');
        $response->assertHeader('X-RateLimit-Reset');
        
        // Security headers
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('X-Frame-Options', 'DENY');
        $response->assertHeader('X-XSS-Protection', '1; mode=block');
    }

    /**
     * Test CORS headers for API endpoints
     */
    public function test_cors_headers()
    {
        $response = $this->withHeaders([
            'Origin' => 'http://localhost:3000',
            'Access-Control-Request-Method' => 'GET',
        ])->options('/api/health');
        
        // Should handle CORS properly
        $this->assertTrue(in_array($response->getStatusCode(), [200, 204]));
    }

    /**
     * Test Content-Type header enforcement
     */
    public function test_content_type_enforcement()
    {
        $response = $this->getJson('/api/health');
        
        // API should return JSON
        $response->assertHeader('Content-Type', 'application/json');
    }

    /**
     * Test rate limit error response format
     */
    public function test_rate_limit_error_response_format()
    {
        // Make enough requests to trigger rate limit
        for ($i = 0; $i < 35; $i++) {
            $response = $this->getJson('/api/health');
            
            if ($response->status() === 429) {
                // Verify error response structure
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
                
                $response->assertJson([
                    'success' => false,
                    'error' => 'RATE_LIMIT_EXCEEDED'
                ]);
                
                // Check required headers
                $response->assertHeader('Retry-After');
                $this->assertIsNumeric($response->headers->get('Retry-After'));
                
                break;
            }
        }
    }
}