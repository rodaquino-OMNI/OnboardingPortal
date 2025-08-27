<?php

namespace App\Helpers;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

class RequestHelper
{
    /**
     * Generate a unique request ID based on request attributes
     * This replaces session()->getId() for stateless API operations
     */
    public static function generateRequestId(Request $request): string
    {
        // Use existing request ID header if available
        if ($requestId = $request->header('X-Request-ID')) {
            return $requestId;
        }

        // Generate based on request attributes for consistency
        $components = [
            $request->ip(),
            $request->userAgent(),
            microtime(true),
            Str::random(8)
        ];

        // Create deterministic but unique ID
        return 'req_' . substr(hash('sha256', implode('|', $components)), 0, 16);
    }

    /**
     * Generate a unique tracking ID for operations that need persistence
     */
    public static function generateTrackingId(): string
    {
        return 'trk_' . Str::random(16) . '_' . time();
    }

    /**
     * Extract client information for tracking purposes
     */
    public static function getClientFingerprint(Request $request): string
    {
        $components = [
            $request->ip(),
            $request->userAgent(),
            $request->header('Accept-Language'),
            $request->header('Accept-Encoding')
        ];

        return hash('sha256', implode('|', array_filter($components)));
    }

    /**
     * Get a consistent operation ID for a user and operation type
     * Useful for idempotent operations
     */
    public static function getOperationId(int $userId, string $operation): string
    {
        return "op_{$operation}_{$userId}_" . date('Ymd');
    }

    /**
     * Check if request has valid tracking headers
     */
    public static function hasValidRequestId(Request $request): bool
    {
        $requestId = $request->header('X-Request-ID');
        return !empty($requestId) && preg_match('/^[a-zA-Z0-9_-]+$/', $requestId);
    }
}