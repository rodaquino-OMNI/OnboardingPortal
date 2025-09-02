<?php

namespace App\Support;

use App\Http\Middleware\RequestIDMiddleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Request Trace Helper for request correlation and debugging
 * 
 * Provides utilities for:
 * - Request tracing across services
 * - Error correlation with request IDs
 * - Performance monitoring
 * - Debug information gathering
 */
class RequestTraceHelper
{
    /**
     * Log a message with request context
     */
    public static function logWithRequestContext(
        string $level,
        string $message,
        array $context = [],
        ?Request $request = null
    ): void {
        $request = $request ?? request();
        $requestId = RequestIDMiddleware::getRequestId($request);

        $fullContext = array_merge([
            'request_id' => $requestId,
            'user_id' => $request?->user()?->id,
            'ip_address' => $request?->ip(),
            'method' => $request?->method(),
            'url' => $request?->fullUrl(),
            'timestamp' => now()->toISOString(),
        ], $context);

        Log::log($level, $message, $fullContext);
    }

    /**
     * Log an info message with request context
     */
    public static function info(string $message, array $context = [], ?Request $request = null): void
    {
        self::logWithRequestContext('info', $message, $context, $request);
    }

    /**
     * Log a warning message with request context
     */
    public static function warning(string $message, array $context = [], ?Request $request = null): void
    {
        self::logWithRequestContext('warning', $message, $context, $request);
    }

    /**
     * Log an error message with request context
     */
    public static function error(string $message, array $context = [], ?Request $request = null): void
    {
        self::logWithRequestContext('error', $message, $context, $request);
    }

    /**
     * Log an exception with full request context
     */
    public static function logException(
        Throwable $exception,
        string $message = 'Exception occurred',
        array $context = [],
        ?Request $request = null
    ): void {
        $request = $request ?? request();
        $requestId = RequestIDMiddleware::getRequestId($request);

        $exceptionContext = array_merge([
            'request_id' => $requestId,
            'user_id' => $request?->user()?->id,
            'ip_address' => $request?->ip(),
            'method' => $request?->method(),
            'url' => $request?->fullUrl(),
            'exception' => [
                'class' => get_class($exception),
                'message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'trace' => $exception->getTraceAsString(),
            ],
            'timestamp' => now()->toISOString(),
        ], $context);

        Log::error($message, $exceptionContext);
    }

    /**
     * Start request timing
     */
    public static function startTiming(string $operation): void
    {
        $requestId = RequestIDMiddleware::getCurrentRequestId();
        $key = "timing_{$requestId}_{$operation}";
        
        app()->instance($key, microtime(true));
    }

    /**
     * End request timing and log duration
     */
    public static function endTiming(string $operation, array $context = []): float
    {
        $requestId = RequestIDMiddleware::getCurrentRequestId();
        $key = "timing_{$requestId}_{$operation}";
        
        $startTime = app($key, null);
        if (!$startTime) {
            self::warning("Timing not started for operation: {$operation}");
            return 0.0;
        }

        $duration = (microtime(true) - $startTime) * 1000; // Convert to milliseconds

        self::info("Operation completed: {$operation}", array_merge([
            'duration_ms' => round($duration, 2),
            'operation' => $operation,
        ], $context));

        return $duration;
    }

    /**
     * Create error response with request ID
     */
    public static function createErrorResponse(
        string $message,
        int $statusCode = 500,
        array $data = [],
        ?Request $request = null
    ): array {
        $request = $request ?? request();
        $requestId = RequestIDMiddleware::getRequestId($request);

        return array_merge([
            'success' => false,
            'error' => [
                'message' => $message,
                'request_id' => $requestId,
                'timestamp' => now()->toISOString(),
            ],
        ], $data);
    }

    /**
     * Create success response with request ID
     */
    public static function createSuccessResponse(
        mixed $data = null,
        string $message = 'Success',
        ?Request $request = null
    ): array {
        $request = $request ?? request();
        $requestId = RequestIDMiddleware::getRequestId($request);

        return [
            'success' => true,
            'message' => $message,
            'data' => $data,
            'request_id' => $requestId,
            'timestamp' => now()->toISOString(),
        ];
    }

    /**
     * Get request trace information for debugging
     */
    public static function getRequestTrace(?Request $request = null): array
    {
        $request = $request ?? request();
        $requestId = RequestIDMiddleware::getRequestId($request);

        return [
            'request_id' => $requestId,
            'timestamp' => now()->toISOString(),
            'request' => [
                'method' => $request?->method(),
                'url' => $request?->fullUrl(),
                'path' => $request?->path(),
                'query' => $request?->query(),
                'headers' => self::sanitizeHeaders($request?->headers->all() ?? []),
                'ip_address' => $request?->ip(),
                'user_agent' => $request?->userAgent(),
            ],
            'user' => [
                'id' => $request?->user()?->id,
                'email' => $request?->user()?->email,
                'authenticated' => $request?->user() !== null,
            ],
            'session' => [
                'id' => $request?->session()?->getId(),
                'csrf_token' => $request?->session()?->token(),
            ],
        ];
    }

    /**
     * Sanitize headers by removing sensitive information
     */
    private static function sanitizeHeaders(array $headers): array
    {
        $sensitiveHeaders = [
            'authorization',
            'x-xsrf-token',
            'cookie',
            'set-cookie',
            'x-api-key',
            'x-auth-token',
        ];

        return array_map(function ($key, $value) use ($sensitiveHeaders) {
            if (in_array(strtolower($key), $sensitiveHeaders)) {
                return '[REDACTED]';
            }
            return is_array($value) ? $value : [$value];
        }, array_keys($headers), $headers);
    }

    /**
     * Create request correlation data for external services
     */
    public static function getCorrelationHeaders(?Request $request = null): array
    {
        $request = $request ?? request();
        $requestId = RequestIDMiddleware::getRequestId($request);

        return [
            RequestIDMiddleware::REQUEST_ID_HEADER => $requestId,
            'X-Correlation-ID' => $requestId, // Alternative header name
            'X-Trace-ID' => $requestId, // For OpenTelemetry compatibility
            'X-User-ID' => $request?->user()?->id,
            'X-Session-ID' => $request?->session()?->getId(),
        ];
    }

    /**
     * Get request metrics for monitoring
     */
    public static function getRequestMetrics(?Request $request = null): array
    {
        $request = $request ?? request();

        return [
            'request_id' => RequestIDMiddleware::getRequestId($request),
            'timestamp' => now()->toISOString(),
            'metrics' => [
                'memory_usage' => memory_get_usage(true),
                'memory_peak' => memory_get_peak_usage(true),
                'execution_time' => defined('LARAVEL_START') ? microtime(true) - LARAVEL_START : null,
            ],
        ];
    }
}