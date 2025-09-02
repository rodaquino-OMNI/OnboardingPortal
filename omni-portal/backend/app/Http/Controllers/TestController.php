<?php

namespace App\Http\Controllers;

use App\Http\Middleware\RequestIDMiddleware;
use App\Support\RequestTraceHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Test Controller for Request Correlation Testing
 */
class TestController extends Controller
{
    /**
     * Test endpoint for request correlation
     */
    public function testEndpoint(Request $request): JsonResponse
    {
        $requestId = RequestIDMiddleware::getCurrentRequestId();
        
        // Log the test request
        RequestTraceHelper::info('Test endpoint accessed', [
            'test_data' => 'Request correlation test',
        ]);

        // Return success response with correlation data
        return response()->json(
            RequestTraceHelper::createSuccessResponse([
                'message' => 'Test endpoint working',
                'request_id' => $requestId,
                'correlation_test' => true,
            ], 'Test successful')
        );
    }

    /**
     * Test endpoint for error correlation
     */
    public function testError(Request $request): JsonResponse
    {
        // Log before throwing error
        RequestTraceHelper::warning('Test error endpoint accessed');

        // Simulate an error
        throw new \Exception('This is a test error for correlation testing');
    }

    /**
     * Test endpoint for validation error
     */
    public function testValidation(Request $request): JsonResponse
    {
        $request->validate([
            'required_field' => 'required|string',
            'email_field' => 'required|email',
        ]);

        return response()->json(
            RequestTraceHelper::createSuccessResponse([
                'message' => 'Validation passed',
            ], 'Validation successful')
        );
    }

    /**
     * Test endpoint for request tracing
     */
    public function testTrace(Request $request): JsonResponse
    {
        $requestId = RequestIDMiddleware::getCurrentRequestId();
        
        // Start timing test
        RequestTraceHelper::startTiming('test_operation');
        
        // Simulate some work
        usleep(50000); // 50ms
        
        // End timing
        $duration = RequestTraceHelper::endTiming('test_operation');
        
        // Get trace information
        $trace = RequestTraceHelper::getRequestTrace($request);
        $metrics = RequestTraceHelper::getRequestMetrics($request);
        $correlationHeaders = RequestTraceHelper::getCorrelationHeaders($request);

        return response()->json(
            RequestTraceHelper::createSuccessResponse([
                'request_id' => $requestId,
                'duration_ms' => $duration,
                'trace' => $trace,
                'metrics' => $metrics,
                'correlation_headers' => $correlationHeaders,
            ], 'Trace test successful')
        );
    }
}