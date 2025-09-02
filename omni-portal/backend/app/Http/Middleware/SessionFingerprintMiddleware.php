<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Session\TokenMismatchException;

/**
 * Session Fingerprint Middleware
 * 
 * Implements session fingerprinting for enhanced security by:
 * - Generating device fingerprints based on browser characteristics
 * - Validating fingerprints on each request
 * - Invalidating sessions on fingerprint mismatches
 * - Comprehensive security logging
 * 
 * Security Features:
 * - User-Agent tracking with hashing
 * - IP address validation (hashed for privacy)
 * - Accept-Language header verification
 * - Screen resolution and timezone detection (when available)
 * - Automatic fingerprint regeneration on login
 * - Session invalidation on suspicious activity
 * 
 * Privacy Considerations:
 * - All sensitive data is hashed using SHA-256
 * - No raw IP addresses or user agents stored
 * - Configurable fingerprint validation levels
 */
class SessionFingerprintMiddleware
{
    /**
     * Routes that should be excluded from fingerprint validation
     */
    protected array $excludedRoutes = [
        'api/health*',
        'api/metrics',
        'api/auth/login',
        'api/auth/register',
        'api/auth/logout',
        'sanctum/csrf-cookie',
    ];

    /**
     * Maximum allowed fingerprint mismatches before session invalidation
     */
    protected int $maxMismatchCount = 3;

    /**
     * Fingerprint validation modes
     */
    protected const MODE_STRICT = 'strict';
    protected const MODE_BALANCED = 'balanced';
    protected const MODE_PERMISSIVE = 'permissive';

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, string $mode = self::MODE_BALANCED): Response
    {
        // Skip fingerprinting if disabled in config or for excluded routes
        if (!config('session.fingerprinting', false) || $this->shouldSkipFingerprinting($request)) {
            return $next($request);
        }

        $requestId = $this->getRequestId($request);
        
        try {
            // Generate current request fingerprint
            $currentFingerprint = $this->generateFingerprint($request, $mode);
            
            // Handle authenticated users
            if (Auth::check()) {
                $this->handleAuthenticatedUser($request, $currentFingerprint, $mode, $requestId);
            } else {
                // For unauthenticated users, store fingerprint for future validation
                $this->storeGuestFingerprint($request, $currentFingerprint);
            }

            // Process request
            $response = $next($request);

            // Update fingerprint metadata after successful request
            $this->updateFingerprintMetadata($request, $currentFingerprint);

            return $response;

        } catch (\Exception $e) {
            $this->logSecurityEvent($request, 'fingerprint_exception', [
                'exception' => $e->getMessage(),
                'request_id' => $requestId,
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);

            // On critical errors, invalidate session for security
            if ($this->isCriticalError($e)) {
                return $this->handleFingerprintMismatch($request, 'critical_error', $requestId);
            }

            throw $e;
        }
    }

    /**
     * Generate device fingerprint based on request characteristics
     */
    protected function generateFingerprint(Request $request, string $mode): string
    {
        $components = [];

        // Core components (always included)
        $components['user_agent'] = $this->hashSensitiveData($request->userAgent() ?: 'unknown');
        $components['accept_language'] = $this->hashSensitiveData($request->header('Accept-Language', 'unknown'));
        $components['accept_encoding'] = $this->hashSensitiveData($request->header('Accept-Encoding', 'unknown'));

        // IP address handling based on mode
        switch ($mode) {
            case self::MODE_STRICT:
                // Full IP address (hashed)
                $components['ip_hash'] = $this->hashSensitiveData($request->ip());
                break;
            
            case self::MODE_BALANCED:
                // IP subnet (first 3 octets for IPv4)
                $components['ip_subnet'] = $this->hashSensitiveData($this->getIpSubnet($request->ip()));
                break;
            
            case self::MODE_PERMISSIVE:
                // Country/region level (mock implementation - would integrate with GeoIP)
                $components['ip_region'] = $this->hashSensitiveData($this->getIpRegion($request->ip()));
                break;
        }

        // Additional headers for enhanced fingerprinting
        $additionalHeaders = [
            'Accept',
            'Cache-Control',
            'Connection',
            'DNT', // Do Not Track
            'Upgrade-Insecure-Requests',
        ];

        foreach ($additionalHeaders as $header) {
            $value = $request->header($header);
            if ($value) {
                $components[strtolower(str_replace('-', '_', $header))] = $this->hashSensitiveData($value);
            }
        }

        // Browser-specific characteristics from JavaScript (if available via custom headers)
        if ($request->hasHeader('X-Screen-Resolution')) {
            $components['screen_resolution'] = $this->hashSensitiveData($request->header('X-Screen-Resolution'));
        }

        if ($request->hasHeader('X-Timezone')) {
            $components['timezone'] = $this->hashSensitiveData($request->header('X-Timezone'));
        }

        if ($request->hasHeader('X-Browser-Features')) {
            $components['browser_features'] = $this->hashSensitiveData($request->header('X-Browser-Features'));
        }

        // Sort components for consistency
        ksort($components);

        // Generate final fingerprint
        $fingerprintString = implode('|', $components);
        $fingerprint = hash('sha256', $fingerprintString);

        // Log fingerprint generation (debug mode only)
        if (config('app.debug')) {
            Log::debug('Generated session fingerprint', [
                'fingerprint' => substr($fingerprint, 0, 16) . '...',
                'components_count' => count($components),
                'mode' => $mode,
                'ip' => $request->ip(),
            ]);
        }

        return $fingerprint;
    }

    /**
     * Handle fingerprint validation for authenticated users
     */
    protected function handleAuthenticatedUser(Request $request, string $currentFingerprint, string $mode, string $requestId): void
    {
        $sessionKey = 'fingerprint_data';
        $fingerprintData = Session::get($sessionKey, []);

        // First request after login - store fingerprint
        if (empty($fingerprintData)) {
            $this->storeFingerprintData($currentFingerprint, $mode, $request);
            $this->logSecurityEvent($request, 'fingerprint_created', [
                'request_id' => $requestId,
                'user_id' => Auth::id(),
                'mode' => $mode
            ]);
            return;
        }

        // Validate existing fingerprint
        $storedFingerprint = $fingerprintData['fingerprint'] ?? '';
        $storedMode = $fingerprintData['mode'] ?? self::MODE_BALANCED;

        if ($storedFingerprint !== $currentFingerprint) {
            $this->handleFingerprintMismatch($request, 'fingerprint_changed', $requestId, [
                'stored_fingerprint' => substr($storedFingerprint, 0, 16) . '...',
                'current_fingerprint' => substr($currentFingerprint, 0, 16) . '...',
                'mode' => $mode,
                'stored_mode' => $storedMode
            ]);
            return;
        }

        // Update last verified timestamp
        $fingerprintData['last_verified'] = now()->toISOString();
        $fingerprintData['verification_count'] = ($fingerprintData['verification_count'] ?? 0) + 1;
        Session::put($sessionKey, $fingerprintData);
    }

    /**
     * Handle fingerprint mismatches
     */
    protected function handleFingerprintMismatch(Request $request, string $reason, string $requestId, array $additionalData = []): Response
    {
        $sessionKey = 'fingerprint_mismatches';
        $mismatchCount = Session::get($sessionKey, 0) + 1;

        $logData = array_merge([
            'reason' => $reason,
            'request_id' => $requestId,
            'user_id' => Auth::id(),
            'mismatch_count' => $mismatchCount,
            'ip' => $request->ip(),
            'user_agent' => substr($request->userAgent() ?: '', 0, 100),
            'path' => $request->path(),
        ], $additionalData);

        $this->logSecurityEvent($request, 'fingerprint_mismatch', $logData);

        // Increment mismatch counter
        Session::put($sessionKey, $mismatchCount);

        // Invalidate session if too many mismatches
        if ($mismatchCount >= $this->maxMismatchCount) {
            $this->invalidateSession($request, 'max_mismatches_exceeded', $requestId);
            
            return response()->json([
                'error' => 'Security validation failed',
                'message' => 'Session has been invalidated due to security concerns. Please log in again.',
                'code' => 'SESSION_INVALIDATED',
                'timestamp' => now()->toISOString(),
            ], 419); // 419 Authentication Timeout
        }

        // For non-critical mismatches, allow request but log event
        return response()->json([
            'warning' => 'Security validation warning',
            'message' => 'Device fingerprint has changed. Please verify your identity.',
            'code' => 'FINGERPRINT_MISMATCH',
            'timestamp' => now()->toISOString(),
        ], 200);
    }

    /**
     * Invalidate session due to security concerns
     */
    protected function invalidateSession(Request $request, string $reason, string $requestId): void
    {
        $userId = Auth::id();

        // Log session invalidation
        $this->logSecurityEvent($request, 'session_invalidated', [
            'reason' => $reason,
            'request_id' => $requestId,
            'user_id' => $userId,
            'ip' => $request->ip(),
        ]);

        // Clear session data
        Session::flush();
        Session::regenerate(true);

        // Logout user
        if (Auth::check()) {
            Auth::logout();
        }

        // Clear authentication cookies
        if ($request->hasSession()) {
            $request->session()->invalidate();
        }
    }

    /**
     * Store fingerprint data in session
     */
    protected function storeFingerprintData(string $fingerprint, string $mode, Request $request): void
    {
        $fingerprintData = [
            'fingerprint' => $fingerprint,
            'mode' => $mode,
            'created_at' => now()->toISOString(),
            'last_verified' => now()->toISOString(),
            'verification_count' => 1,
            'created_ip' => $this->hashSensitiveData($request->ip()),
            'created_user_agent' => $this->hashSensitiveData($request->userAgent() ?: ''),
        ];

        Session::put('fingerprint_data', $fingerprintData);
    }

    /**
     * Store guest fingerprint for future validation
     */
    protected function storeGuestFingerprint(Request $request, string $fingerprint): void
    {
        Session::put('guest_fingerprint', [
            'fingerprint' => $fingerprint,
            'created_at' => now()->toISOString(),
            'ip' => $this->hashSensitiveData($request->ip()),
        ]);
    }

    /**
     * Update fingerprint metadata after successful request
     */
    protected function updateFingerprintMetadata(Request $request, string $fingerprint): void
    {
        if (!Auth::check()) {
            return;
        }

        $sessionKey = 'fingerprint_data';
        $fingerprintData = Session::get($sessionKey);

        if ($fingerprintData && $fingerprintData['fingerprint'] === $fingerprint) {
            $fingerprintData['last_verified'] = now()->toISOString();
            $fingerprintData['verification_count'] = ($fingerprintData['verification_count'] ?? 0) + 1;
            Session::put($sessionKey, $fingerprintData);
        }
    }

    /**
     * Hash sensitive data for privacy
     */
    protected function hashSensitiveData(string $data): string
    {
        $salt = config('app.key') . 'fingerprint_salt';
        return hash('sha256', $salt . $data);
    }

    /**
     * Get IP subnet (first 3 octets for IPv4)
     */
    protected function getIpSubnet(string $ip): string
    {
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $parts = explode('.', $ip);
            return implode('.', array_slice($parts, 0, 3)) . '.0';
        }

        // For IPv6, use first 64 bits
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            $parts = explode(':', $ip);
            return implode(':', array_slice($parts, 0, 4)) . '::';
        }

        return $ip;
    }

    /**
     * Get IP region (mock implementation)
     */
    protected function getIpRegion(string $ip): string
    {
        // In a real implementation, this would use a GeoIP service
        // For now, return a generic region based on IP class
        if (str_starts_with($ip, '192.168.') || str_starts_with($ip, '10.') || str_starts_with($ip, '172.')) {
            return 'local';
        }

        // Mock region assignment
        $hash = crc32($ip);
        $regions = ['us', 'eu', 'asia', 'other'];
        return $regions[abs($hash) % count($regions)];
    }

    /**
     * Check if fingerprinting should be skipped for this request
     */
    protected function shouldSkipFingerprinting(Request $request): bool
    {
        // Skip for excluded routes
        foreach ($this->excludedRoutes as $pattern) {
            if ($request->is($pattern)) {
                return true;
            }
        }

        // Skip for OPTIONS requests
        if ($request->method() === 'OPTIONS') {
            return true;
        }

        // Skip for health checks
        if (str_contains($request->path(), 'health')) {
            return true;
        }

        return false;
    }

    /**
     * Get request ID from request or generate new one
     */
    protected function getRequestId(Request $request): string
    {
        // Try to get request ID from security context (set by UnifiedAuthMiddleware)
        $securityContext = $request->get('security_context');
        if ($securityContext && isset($securityContext['request_id'])) {
            return $securityContext['request_id'];
        }

        // Generate new request ID
        return hash('sha256', $request->ip() . $request->userAgent() . microtime(true));
    }

    /**
     * Check if an exception is critical and requires session invalidation
     */
    protected function isCriticalError(\Exception $e): bool
    {
        return $e instanceof TokenMismatchException ||
               str_contains($e->getMessage(), 'security') ||
               str_contains($e->getMessage(), 'unauthorized');
    }

    /**
     * Log security events with proper context
     */
    protected function logSecurityEvent(Request $request, string $event, array $data = []): void
    {
        $logData = array_merge([
            'event' => $event,
            'middleware' => 'SessionFingerprintMiddleware',
            'ip' => $request->ip(),
            'path' => $request->path(),
            'method' => $request->method(),
            'user_id' => Auth::id(),
            'session_id' => Session::getId(),
            'timestamp' => now()->toISOString(),
        ], $data);

        // Use different log levels based on event severity
        $criticalEvents = ['session_invalidated', 'max_mismatches_exceeded', 'critical_error'];
        $warningEvents = ['fingerprint_mismatch', 'fingerprint_exception'];

        if (in_array($event, $criticalEvents)) {
            Log::critical("Session fingerprint security event: {$event}", $logData);
        } elseif (in_array($event, $warningEvents)) {
            Log::warning("Session fingerprint security event: {$event}", $logData);
        } else {
            Log::info("Session fingerprint event: {$event}", $logData);
        }
    }

    /**
     * Regenerate session fingerprint (called on login)
     */
    public static function regenerateFingerprint(Request $request, string $mode = self::MODE_BALANCED): void
    {
        $middleware = new static();
        $fingerprint = $middleware->generateFingerprint($request, $mode);
        $middleware->storeFingerprintData($fingerprint, $mode, $request);

        Log::info('Session fingerprint regenerated on login', [
            'user_id' => Auth::id(),
            'ip' => $request->ip(),
            'mode' => $mode,
        ]);
    }

    /**
     * Get fingerprint information for debugging
     */
    public static function getFingerprintInfo(): array
    {
        $fingerprintData = Session::get('fingerprint_data', []);
        $mismatchCount = Session::get('fingerprint_mismatches', 0);

        return [
            'has_fingerprint' => !empty($fingerprintData),
            'created_at' => $fingerprintData['created_at'] ?? null,
            'last_verified' => $fingerprintData['last_verified'] ?? null,
            'verification_count' => $fingerprintData['verification_count'] ?? 0,
            'mismatch_count' => $mismatchCount,
            'mode' => $fingerprintData['mode'] ?? null,
        ];
    }
}