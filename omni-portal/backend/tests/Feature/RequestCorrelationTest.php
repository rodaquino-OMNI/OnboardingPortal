<?php

namespace Tests\Feature;

use App\Http\Middleware\RequestIDMiddleware;
use App\Support\RequestTraceHelper;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class RequestCorrelationTest extends TestCase
{
    /**
     * Test that request ID is generated when not provided
     */
    public function test_request_id_is_generated_when_not_provided(): void
    {
        $response = $this->getJson('/api/test-endpoint');

        // Should have request ID in response headers
        $this->assertTrue($response->headers->has('X-Request-ID'));
        
        $requestId = $response->headers->get('X-Request-ID');
        $this->assertNotEmpty($requestId);
        $this->assertMatchesRegularExpression('/^req_\d{14}_[a-z0-9]{8}$/', $requestId);
    }

    /**
     * Test that provided request ID is preserved
     */
    public function test_provided_request_id_is_preserved(): void
    {
        $requestId = 'test_request_id_123';

        $response = $this->getJson('/api/test-endpoint', [
            'X-Request-ID' => $requestId,
        ]);

        // Should preserve the provided request ID
        $this->assertEquals($requestId, $response->headers->get('X-Request-ID'));
    }

    /**
     * Test that invalid request ID is replaced
     */
    public function test_invalid_request_id_is_replaced(): void
    {
        $invalidRequestId = 'invalid@request#id!';

        $response = $this->getJson('/api/test-endpoint', [
            'X-Request-ID' => $invalidRequestId,
        ]);

        // Should replace invalid request ID with valid one
        $responseRequestId = $response->headers->get('X-Request-ID');
        $this->assertNotEquals($invalidRequestId, $responseRequestId);
        $this->assertMatchesRegularExpression('/^req_\d{14}_[a-z0-9]{8}$/', $responseRequestId);
    }

    /**
     * Test request correlation in error responses
     */
    public function test_error_responses_include_request_id(): void
    {
        $requestId = 'test_error_request_123';

        $response = $this->getJson('/api/nonexistent-endpoint', [
            'X-Request-ID' => $requestId,
        ]);

        $response->assertStatus(404);
        
        // Check response has request ID in headers
        $this->assertEquals($requestId, $response->headers->get('X-Request-ID'));
        
        // Check response body includes request ID
        $responseData = $response->json();
        $this->assertEquals($requestId, $responseData['error']['request_id']);
    }

    /**
     * Test validation error includes request ID
     */
    public function test_validation_error_includes_request_id(): void
    {
        $requestId = 'test_validation_request_123';

        // Assuming there's an endpoint that requires validation
        $response = $this->postJson('/api/auth/login', [], [
            'X-Request-ID' => $requestId,
        ]);

        $response->assertStatus(422);
        
        // Check response includes request ID
        $responseData = $response->json();
        $this->assertEquals($requestId, $responseData['error']['request_id']);
    }

    /**
     * Test RequestTraceHelper creates proper success response
     */
    public function test_request_trace_helper_success_response(): void
    {
        $this->withoutMiddleware(); // Skip middleware for this unit test
        
        $data = ['test' => 'data'];
        $response = RequestTraceHelper::createSuccessResponse($data, 'Test successful');

        $this->assertEquals(true, $response['success']);
        $this->assertEquals('Test successful', $response['message']);
        $this->assertEquals($data, $response['data']);
        $this->assertArrayHasKey('timestamp', $response);
    }

    /**
     * Test RequestTraceHelper creates proper error response
     */
    public function test_request_trace_helper_error_response(): void
    {
        $this->withoutMiddleware(); // Skip middleware for this unit test
        
        $response = RequestTraceHelper::createErrorResponse('Test error', 400);

        $this->assertEquals(false, $response['success']);
        $this->assertEquals('Test error', $response['error']['message']);
        $this->assertArrayHasKey('timestamp', $response['error']);
    }

    /**
     * Test request trace information gathering
     */
    public function test_request_trace_information_gathering(): void
    {
        $requestId = 'test_trace_request_123';

        $this->getJson('/api/test-endpoint', [
            'X-Request-ID' => $requestId,
            'User-Agent' => 'Test User Agent',
        ]);

        // Create a mock request to test trace helper
        $request = $this->app['request'];
        $trace = RequestTraceHelper::getRequestTrace($request);

        $this->assertEquals($requestId, $trace['request_id']);
        $this->assertArrayHasKey('timestamp', $trace);
        $this->assertArrayHasKey('request', $trace);
        $this->assertArrayHasKey('user', $trace);
    }

    /**
     * Test request correlation headers generation
     */
    public function test_correlation_headers_generation(): void
    {
        $requestId = 'test_correlation_123';

        $this->getJson('/api/test-endpoint', [
            'X-Request-ID' => $requestId,
        ]);

        $request = $this->app['request'];
        $headers = RequestTraceHelper::getCorrelationHeaders($request);

        $this->assertEquals($requestId, $headers['X-Request-ID']);
        $this->assertEquals($requestId, $headers['X-Correlation-ID']);
        $this->assertEquals($requestId, $headers['X-Trace-ID']);
    }

    /**
     * Test request metrics collection
     */
    public function test_request_metrics_collection(): void
    {
        $requestId = 'test_metrics_request_123';

        $this->getJson('/api/test-endpoint', [
            'X-Request-ID' => $requestId,
        ]);

        $request = $this->app['request'];
        $metrics = RequestTraceHelper::getRequestMetrics($request);

        $this->assertEquals($requestId, $metrics['request_id']);
        $this->assertArrayHasKey('timestamp', $metrics);
        $this->assertArrayHasKey('metrics', $metrics);
        $this->assertArrayHasKey('memory_usage', $metrics['metrics']);
        $this->assertArrayHasKey('memory_peak', $metrics['metrics']);
    }

    /**
     * Test request ID middleware static methods
     */
    public function test_request_id_middleware_static_methods(): void
    {
        $requestId = 'test_static_methods_123';

        $this->getJson('/api/test-endpoint', [
            'X-Request-ID' => $requestId,
        ]);

        // Test getCurrentRequestId (should work within request context)
        $currentRequestId = RequestIDMiddleware::getCurrentRequestId();
        $this->assertEquals($requestId, $currentRequestId);
    }

    /**
     * Test logging includes request context
     */
    public function test_logging_includes_request_context(): void
    {
        Log::shouldReceive('shareContext')
            ->once()
            ->with(\Mockery::on(function ($context) {
                return isset($context['request_id']) && 
                       isset($context['ip_address']) && 
                       isset($context['method']) && 
                       isset($context['url']);
            }));

        Log::shouldReceive('shareContext')
            ->once()
            ->with(\Mockery::on(function ($context) {
                return isset($context['response_status']) && 
                       isset($context['response_size']);
            }));

        $this->getJson('/api/test-endpoint', [
            'X-Request-ID' => 'test_logging_123',
        ]);
    }
}