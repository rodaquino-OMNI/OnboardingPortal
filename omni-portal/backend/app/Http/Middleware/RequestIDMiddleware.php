<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Request ID Middleware for generating and handling X-Request-ID headers
 * 
 * This middleware ensures every request has a unique identifier for:
 * - Request tracing across frontend and backend
 * - Debugging and error correlation
 * - Log aggregation and monitoring
 * - Support ticket correlation
 */
class RequestIDMiddleware
{
    /**
     * Header name for request ID
     */
    public const REQUEST_ID_HEADER = 'X-Request-ID';

    /**
     * Context key for storing request ID in logs
     */
    public const LOG_CONTEXT_KEY = 'request_id';

    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Get existing request ID or generate new one
        $requestId = $this->getOrGenerateRequestId($request);
        
        // Store request ID in request attributes for easy access
        $request->attributes->set('request_id', $requestId);
        
        // Add request ID to Laravel's logging context
        Log::shareContext([
            self::LOG_CONTEXT_KEY => $requestId,
            'user_id' => $request->user()?->id,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'method' => $request->method(),
            'url' => $request->fullUrl(),
        ]);

        // Process the request
        $response = $next($request);

        // Add request ID to response headers for client-side correlation
        $response->headers->set(self::REQUEST_ID_HEADER, $requestId);

        // Add response status to logging context
        Log::shareContext([
            'response_status' => $response->getStatusCode(),
            'response_size' => $this->getResponseSize($response),
        ]);

        return $response;
    }

    /**
     * Get existing request ID from headers or generate a new one
     */
    private function getOrGenerateRequestId(Request $request): string
    {
        // Check if request ID is provided by client (e.g., from frontend)
        $requestId = $request->header(self::REQUEST_ID_HEADER);

        // Validate existing request ID format
        if ($requestId && $this->isValidRequestId($requestId)) {
            return $requestId;
        }

        // Generate new request ID
        return $this->generateRequestId();
    }

    /**
     * Generate a unique request ID
     */
    private function generateRequestId(): string
    {
        // Use timestamp + random string for uniqueness and sortability
        $timestamp = now()->format('YmdHis');
        $random = Str::random(8);
        
        return sprintf('req_%s_%s', $timestamp, strtolower($random));
    }

    /**
     * Validate request ID format
     */
    private function isValidRequestId(string $requestId): bool
    {
        // Allow alphanumeric, dashes, underscores (max 64 chars)
        return preg_match('/^[a-zA-Z0-9_-]{1,64}$/', $requestId) === 1;
    }

    /**
     * Get response content size for logging
     */
    private function getResponseSize(Response $response): int
    {
        $content = $response->getContent();
        return $content ? strlen($content) : 0;
    }

    /**
     * Get current request ID from request attributes
     */
    public static function getCurrentRequestId(): ?string
    {
        $request = request();
        return $request?->attributes->get('request_id');
    }

    /**
     * Get request ID from any request object
     */
    public static function getRequestId(Request $request): ?string
    {
        return $request->attributes->get('request_id') ?? $request->header(self::REQUEST_ID_HEADER);
    }
}