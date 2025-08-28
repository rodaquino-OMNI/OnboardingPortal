<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Session\TokenMismatchException;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use Symfony\Component\HttpFoundation\Response;

/**
 * Unified Authentication Middleware
 * 
 * Consolidates all authentication concerns into a single, performant middleware:
 * - Sanctum authentication (stateful & stateless)
 * - CSRF protection (context-aware)
 * - Security headers
 * - Rate limiting protection
 * - Activity logging
 * 
 * Design Principles:
 * - Single responsibility with unified flow
 * - Performance optimized (early returns)
 * - Security hardened
 * - Backward compatible
 * - Comprehensive logging
 */
class UnifiedAuthMiddleware
{
    /**
     * Routes that should be excluded from CSRF protection
     */
    protected $csrfExempt = [
        'api/auth/*/callback',
        'api/webhooks/*',
        'api/health*',
        'api/metrics',
    ];

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, ...$guards): Response
    {
        // Start performance tracking
        $startTime = microtime(true);
        $requestId = $this->generateRequestId($request);
        
        try {
            // 1. Early security checks
            if (!$this->validateSecurityHeaders($request)) {
                return $this->securityResponse('Invalid security headers', 400);
            }
            
            // 2. Rate limiting check
            if ($this->isRateLimited($request)) {
                return $this->securityResponse('Rate limit exceeded', 429);
            }
            
            // 3. Handle Sanctum stateful requests
            $this->ensureFrontendRequestsAreStateful($request);
            
            // 4. Authentication logic
            $authResult = $this->handleAuthentication($request, $guards);
            if ($authResult !== true) {
                return $authResult; // Return error response
            }
            
            // 5. CSRF protection (context-aware)
            if (!$this->validateCsrfProtection($request)) {
                $this->logSecurityEvent($request, 'csrf_failure');
                throw new TokenMismatchException('CSRF token mismatch');
            }
            
            // 6. Additional security validations
            if (!$this->validateAdditionalSecurity($request)) {
                return $this->securityResponse('Security validation failed', 403);
            }
            
            // 7. Add security context to request
            $this->addSecurityContext($request, $requestId);
            
            // 8. Process the request
            $response = $next($request);
            
            // 9. Post-processing
            $response = $this->addSecurityHeaders($response);
            $response = $this->addCsrfToken($request, $response);
            
            // 10. Log successful request
            $this->logSuccessfulRequest($request, $response, $startTime, $requestId);
            
            return $response;
            
        } catch (\Exception $e) {
            $this->logSecurityEvent($request, 'auth_exception', [
                'exception' => $e->getMessage(),
                'request_id' => $requestId
            ]);
            
            if ($e instanceof AuthenticationException) {
                return $this->authenticationErrorResponse($e);
            }
            
            if ($e instanceof TokenMismatchException) {
                return $this->csrfErrorResponse($e);
            }
            
            throw $e;
        }
    }

    /**
     * Ensure frontend requests are stateful (Sanctum)
     */
    protected function ensureFrontendRequestsAreStateful(Request $request): void
    {
        $sanctumMiddleware = new EnsureFrontendRequestsAreStateful();
        
        // Check if request should be stateful
        if ($this->isFromStatefulDomain($request)) {
            // Enable session-based authentication for stateful domains
            $request->headers->set('X-Sanctum-Stateful', '1');
        }
    }

    /**
     * Handle authentication logic
     */
    protected function handleAuthentication(Request $request, array $guards): mixed
    {
        // If no guards specified, use default
        if (empty($guards)) {
            $guards = ['sanctum'];
        }

        // Handle public routes
        if ($this->isPublicRoute($request)) {
            return true;
        }

        // Attempt authentication with specified guards
        foreach ($guards as $guard) {
            try {
                $user = Auth::guard($guard)->user();
                
                if ($user) {
                    // Validate user account status
                    if (!$this->validateUserAccount($user)) {
                        return $this->securityResponse('Account is not active', 403);
                    }
                    
                    // Set authenticated user context
                    Auth::setUser($user);
                    
                    $this->logAuthenticationSuccess($request, $user, $guard);
                    return true;
                }
                
            } catch (\Exception $e) {
                $this->logSecurityEvent($request, 'auth_guard_failure', [
                    'guard' => $guard,
                    'error' => $e->getMessage()
                ]);
                continue;
            }
        }

        // No successful authentication
        $this->logAuthenticationFailure($request, $guards);
        return $this->authenticationErrorResponse();
    }

    /**
     * Validate CSRF protection based on request context
     */
    protected function validateCsrfProtection(Request $request): bool
    {
        // Skip CSRF protection in testing environment
        if (app()->environment('testing')) {
            return true;
        }
        
        // Skip CSRF for read-only requests
        if ($this->isReadOnlyRequest($request)) {
            return true;
        }

        // Skip CSRF for exempt routes
        if ($this->isCsrfExempt($request)) {
            return true;
        }

        // For API routes with Bearer tokens, skip CSRF
        if ($this->hasValidBearerToken($request)) {
            return true;
        }

        // For stateful requests, validate CSRF token
        if ($this->isFromStatefulDomain($request)) {
            return $this->validateCsrfToken($request);
        }

        // For non-stateful API requests, validate double-submit cookies
        return $this->validateDoubleCsrfToken($request);
    }

    /**
     * Validate CSRF token for stateful requests
     */
    protected function validateCsrfToken(Request $request): bool
    {
        $token = $this->getCsrfTokenFromRequest($request);
        $sessionToken = session()->token();

        if (!$token || !$sessionToken) {
            return false;
        }

        return hash_equals($sessionToken, $token);
    }

    /**
     * Validate double-submit CSRF token for stateless requests
     */
    protected function validateDoubleCsrfToken(Request $request): bool
    {
        $headerToken = $request->header('X-CSRF-Token') ?? $request->header('X-XSRF-Token');
        $cookieToken = $request->cookie('XSRF-TOKEN');

        if (!$headerToken || !$cookieToken) {
            return false;
        }

        if (!hash_equals($headerToken, $cookieToken)) {
            return false;
        }

        // Validate token format
        if (!preg_match('/^[a-zA-Z0-9]{40,}$/', $headerToken)) {
            return false;
        }

        // Check for replay attacks
        $tokenKey = 'csrf_token:' . hash('sha256', $headerToken);
        if (Cache::has($tokenKey)) {
            return false;
        }

        // Mark token as used (5-minute window)
        Cache::put($tokenKey, true, now()->addMinutes(5));

        return true;
    }

    /**
     * Add CSRF token to response
     */
    protected function addCsrfToken(Request $request, Response $response): Response
    {
        if (!$this->shouldAddCsrfToken($request, $response)) {
            return $response;
        }

        $token = $this->generateCsrfToken();

        // Add to header
        $response->headers->set('X-CSRF-Token', $token);

        // Add secure cookie
        $response->headers->setCookie(
            cookie(
                'XSRF-TOKEN',
                $token,
                120, // 2 hours
                '/',
                null,
                $request->isSecure(),
                false, // Not httpOnly so JS can read it
                false,
                'strict'
            )
        );

        return $response;
    }

    /**
     * Add comprehensive security headers
     */
    protected function addSecurityHeaders(Response $response): Response
    {
        $headers = [
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'X-XSS-Protection' => '1; mode=block',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            'Permissions-Policy' => 'camera=(), microphone=(), geolocation=()',
            'Strict-Transport-Security' => 'max-age=31536000; includeSubDomains',
        ];

        foreach ($headers as $key => $value) {
            $response->headers->set($key, $value);
        }

        return $response;
    }

    /**
     * Validate security headers on incoming request
     */
    protected function validateSecurityHeaders(Request $request): bool
    {
        // Check for suspicious headers
        $suspiciousHeaders = ['X-Forwarded-Host', 'X-Original-URL', 'X-Rewrite-URL'];
        
        foreach ($suspiciousHeaders as $header) {
            if ($request->hasHeader($header)) {
                $this->logSecurityEvent($request, 'suspicious_header', [
                    'header' => $header,
                    'value' => $request->header($header)
                ]);
                return false;
            }
        }

        return true;
    }

    /**
     * Check rate limiting
     */
    protected function isRateLimited(Request $request): bool
    {
        $key = $this->getRateLimitKey($request);
        $maxAttempts = $this->getRateLimitMaxAttempts($request);
        $decayMinutes = $this->getRateLimitDecayMinutes($request);

        $attempts = Cache::get($key, 0);
        
        if ($attempts >= $maxAttempts) {
            $this->logSecurityEvent($request, 'rate_limit_exceeded', [
                'attempts' => $attempts,
                'max_attempts' => $maxAttempts,
                'key' => $key
            ]);
            return true;
        }

        // Increment attempts
        Cache::put($key, $attempts + 1, now()->addMinutes($decayMinutes));

        return false;
    }

    /**
     * Helper methods for context checking
     */
    protected function isPublicRoute(Request $request): bool
    {
        $publicRoutes = [
            'api/health',        // Health check endpoint only
            'api/health/live',   // Liveness probe
            'api/health/ready',  // Readiness probe
            'api/health/status', // Status endpoint
            'api/metrics',
            'api/auth/login',
            'api/auth/register',
            'api/auth/check-*',
            'api/auth/*/redirect',
            'api/auth/*/callback',
            'api/info',
        ];

        foreach ($publicRoutes as $pattern) {
            if ($request->is($pattern)) {
                return true;
            }
        }

        return false;
    }

    protected function isReadOnlyRequest(Request $request): bool
    {
        return in_array($request->method(), ['GET', 'HEAD', 'OPTIONS']);
    }

    protected function isCsrfExempt(Request $request): bool
    {
        foreach ($this->csrfExempt as $pattern) {
            if ($request->is($pattern)) {
                return true;
            }
        }

        return false;
    }

    protected function hasValidBearerToken(Request $request): bool
    {
        $authHeader = $request->header('Authorization');
        return $authHeader && str_starts_with($authHeader, 'Bearer ');
    }

    protected function isFromStatefulDomain(Request $request): bool
    {
        $statefulDomains = config('sanctum.stateful', []);
        $host = $request->getHost();

        return in_array($host, $statefulDomains);
    }

    protected function validateUserAccount($user): bool
    {
        // Check if user account is active
        if (method_exists($user, 'isActive') && !$user->isActive()) {
            return false;
        }

        // Check if account is locked
        if (method_exists($user, 'isLocked') && $user->isLocked()) {
            return false;
        }

        return true;
    }

    protected function validateAdditionalSecurity(Request $request): bool
    {
        // Validate origin if provided
        $origin = $request->header('Origin');
        if ($origin && !$this->isAllowedOrigin($origin)) {
            return false;
        }

        // Validate content type for POST requests
        if ($request->isMethod('POST') && !$this->isAllowedContentType($request)) {
            return false;
        }

        return true;
    }

    /**
     * Response helpers
     */
    protected function securityResponse(string $message, int $status): Response
    {
        return response()->json([
            'error' => 'Security validation failed',
            'message' => $message,
            'timestamp' => now()->toISOString(),
        ], $status);
    }

    protected function authenticationErrorResponse($exception = null): Response
    {
        return response()->json([
            'error' => 'Unauthenticated',
            'message' => 'Authentication required to access this resource',
            'timestamp' => now()->toISOString(),
        ], 401);
    }

    protected function csrfErrorResponse($exception = null): Response
    {
        return response()->json([
            'error' => 'CSRF token mismatch',
            'message' => 'Invalid or missing CSRF token',
            'timestamp' => now()->toISOString(),
        ], 419);
    }

    /**
     * Utility methods
     */
    protected function generateRequestId(Request $request): string
    {
        return hash('sha256', $request->ip() . $request->userAgent() . microtime(true));
    }

    protected function generateCsrfToken(): string
    {
        return bin2hex(random_bytes(20));
    }

    protected function getCsrfTokenFromRequest(Request $request): ?string
    {
        return $request->input('_token') ?: 
               $request->header('X-CSRF-TOKEN') ?: 
               $request->header('X-XSRF-TOKEN');
    }

    protected function getRateLimitKey(Request $request): string
    {
        return 'rate_limit:' . $request->ip() . ':' . $request->path();
    }

    protected function getRateLimitMaxAttempts(Request $request): int
    {
        // Higher limits for authenticated users
        if (Auth::check()) {
            return 120; // per hour
        }
        return 60; // per hour for anonymous users
    }

    protected function getRateLimitDecayMinutes(Request $request): int
    {
        return 60; // 1 hour window
    }

    protected function shouldAddCsrfToken(Request $request, Response $response): bool
    {
        return !$this->isReadOnlyRequest($request) && 
               $response->getStatusCode() < 400 &&
               !$this->isCsrfExempt($request);
    }

    protected function isAllowedOrigin(string $origin): bool
    {
        $allowedOrigins = config('cors.allowed_origins', []);
        return in_array($origin, $allowedOrigins) || in_array('*', $allowedOrigins);
    }

    protected function isAllowedContentType(Request $request): bool
    {
        $contentType = $request->header('Content-Type');
        $allowedTypes = [
            'application/json',
            'application/x-www-form-urlencoded',
            'multipart/form-data',
            'text/plain',
        ];

        foreach ($allowedTypes as $type) {
            if (str_starts_with($contentType ?: '', $type)) {
                return true;
            }
        }

        return false;
    }

    protected function addSecurityContext(Request $request, string $requestId): void
    {
        $request->merge([
            'security_context' => [
                'request_id' => $requestId,
                'user_id' => Auth::id(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'is_stateful' => $this->isFromStatefulDomain($request),
                'has_csrf' => !$this->isCsrfExempt($request),
                'timestamp' => now()->toISOString(),
            ]
        ]);
    }

    /**
     * Logging methods
     */
    protected function logAuthenticationSuccess(Request $request, $user, string $guard): void
    {
        Log::info('Authentication successful', [
            'user_id' => $user->id,
            'guard' => $guard,
            'ip' => $request->ip(),
            'path' => $request->path(),
            'method' => $request->method(),
        ]);
    }

    protected function logAuthenticationFailure(Request $request, array $guards): void
    {
        Log::warning('Authentication failed', [
            'guards_attempted' => $guards,
            'ip' => $request->ip(),
            'path' => $request->path(),
            'method' => $request->method(),
            'user_agent' => $request->userAgent(),
        ]);
    }

    protected function logSecurityEvent(Request $request, string $event, array $data = []): void
    {
        Log::warning("Security event: {$event}", array_merge([
            'event' => $event,
            'ip' => $request->ip(),
            'path' => $request->path(),
            'method' => $request->method(),
            'user_id' => Auth::id(),
            'timestamp' => now()->toISOString(),
        ], $data));
    }

    protected function logSuccessfulRequest(Request $request, Response $response, float $startTime, string $requestId): void
    {
        $duration = round((microtime(true) - $startTime) * 1000, 2);
        
        Log::debug('Request processed successfully', [
            'request_id' => $requestId,
            'path' => $request->path(),
            'method' => $request->method(),
            'status' => $response->getStatusCode(),
            'duration_ms' => $duration,
            'user_id' => Auth::id(),
            'ip' => $request->ip(),
        ]);
    }
}