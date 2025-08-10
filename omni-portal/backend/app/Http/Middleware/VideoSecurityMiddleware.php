<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use App\Models\VideoSession;

class VideoSecurityMiddleware
{
    /**
     * Handle incoming video conferencing requests with HIPAA compliance
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Validate session token for video endpoints
        if (!$this->validateSessionToken($request)) {
            return response()->json(['error' => 'Invalid session token'], 401);
        }

        // Check HIPAA compliance requirements
        if (!$this->checkHIPAACompliance($request)) {
            return response()->json(['error' => 'HIPAA compliance requirements not met'], 403);
        }

        // Log access attempt for audit trail
        Log::info('Video conferencing access attempt', [
            'user_id' => Auth::id(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'endpoint' => $request->path(),
            'timestamp' => now(),
            'session_token' => $request->header('X-Video-Session-Token') ? 'present' : 'missing'
        ]);

        // Check if user is authenticated
        if (!Auth::check()) {
            Log::warning('Unauthenticated video access attempt', [
                'ip_address' => $request->ip(),
                'endpoint' => $request->path()
            ]);
            
            return response()->json([
                'message' => 'Authentication required for video services'
            ], 401);
        }

        $user = Auth::user();

        // Validate user account status
        if (!$user->is_active) {
            Log::warning('Inactive user attempted video access', [
                'user_id' => $user->id,
                'ip_address' => $request->ip()
            ]);
            
            return response()->json([
                'message' => 'Account is inactive'
            ], 403);
        }

        // Check if registration is completed
        if (!$user->isRegistrationCompleted()) {
            Log::warning('Incomplete registration user attempted video access', [
                'user_id' => $user->id,
                'registration_step' => $user->registration_step
            ]);
            
            return response()->json([
                'message' => 'Complete registration required for video services'
            ], 403);
        }

        // Validate HIPAA consent for healthcare-related video calls
        if (!$this->hasValidHipaaConsent($user)) {
            Log::warning('User without HIPAA consent attempted video access', [
                'user_id' => $user->id
            ]);
            
            return response()->json([
                'message' => 'HIPAA consent required for telehealth services'
            ], 403);
        }

        // Check IP whitelist for admin operations
        if ($this->isAdminOperation($request) && !$this->isIPWhitelisted($request->ip())) {
            Log::warning('Admin operation attempted from non-whitelisted IP', [
                'user_id' => $user->id,
                'ip_address' => $request->ip(),
                'operation' => $request->path()
            ]);
            
            return response()->json([
                'message' => 'Access denied from this IP address'
            ], 403);
        }

        // Enhanced rate limiting for different operations
        if (!$this->checkRateLimit($request, $user)) {
            Log::warning('Rate limit exceeded for video access', [
                'user_id' => $user->id,
                'ip_address' => $request->ip(),
                'operation' => $request->path()
            ]);
            
            return response()->json([
                'message' => 'Too many video session requests. Please wait before trying again.',
                'retry_after' => $this->getRetryAfter($request, $user)
            ], 429);
        }

        // Validate request integrity
        if (!$this->validateRequestIntegrity($request)) {
            Log::warning('Invalid video request detected', [
                'user_id' => $user->id,
                'ip_address' => $request->ip(),
                'endpoint' => $request->path()
            ]);
            
            return response()->json([
                'message' => 'Invalid request format'
            ], 400);
        }

        // Add security headers to response
        $response = $next($request);
        
        // Log successful access for audit
        $this->logSuccessfulAccess($request, $response);
        
        return $this->addSecurityHeaders($response);
    }

    /**
     * Validate session token
     */
    protected function validateSessionToken(Request $request): bool
    {
        $token = $request->header('X-Video-Session-Token');
        
        if (!$token) {
            // Allow token-less requests for initial session creation
            return $request->routeIs('video.sessions.create');
        }

        // Verify token signature and expiration
        try {
            $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));
            
            // Check expiration
            if ($payload->exp < time()) {
                return false;
            }

            // Validate session exists and is active
            $session = VideoSession::where('session_id', $payload->session_id)
                ->where('status', 'active')
                ->first();

            return $session !== null;
        } catch (\Exception $e) {
            Log::warning('Invalid video session token', [
                'error' => $e->getMessage(),
                'token' => substr($token, 0, 20) . '...'
            ]);
            return false;
        }
    }

    /**
     * Check HIPAA compliance requirements
     */
    protected function checkHIPAACompliance(Request $request): bool
    {
        // Verify SSL/TLS
        if (!$request->secure() && !app()->environment('local')) {
            return false;
        }

        // Check user agent for known secure clients
        $userAgent = $request->userAgent();
        if ($this->isBlockedUserAgent($userAgent)) {
            return false;
        }

        return true;
    }

    /**
     * Check if user has valid HIPAA consent
     */
    protected function hasValidHipaaConsent($user): bool
    {
        // Check if user has accepted HIPAA terms
        $consent = $user->lgpdConsents()
            ->where('consent_type', 'hipaa_telehealth')
            ->where('status', 'accepted')
            ->where('expires_at', '>', now())
            ->first();

        return $consent !== null;
    }

    /**
     * Enhanced rate limiting for different operations
     */
    protected function checkRateLimit(Request $request, $user): bool
    {
        $operation = $this->getOperationType($request);
        $limits = [
            'create_session' => ['max' => 10, 'window' => 3600], // 10 per hour
            'start_recording' => ['max' => 20, 'window' => 3600], // 20 per hour
            'join_session' => ['max' => 30, 'window' => 3600], // 30 per hour
            'default' => ['max' => 60, 'window' => 3600], // 60 per hour
        ];

        $limit = $limits[$operation] ?? $limits['default'];
        $key = "video_rate_limit:{$operation}:{$user->id}";
        
        $attempts = Cache::get($key, 0);
        
        if ($attempts >= $limit['max']) {
            return false;
        }

        // Increment with expiration
        $newCount = Cache::increment($key);
        Cache::put($key, $newCount, $limit['window']);
        
        return true;
    }

    /**
     * Get retry after time in seconds
     */
    protected function getRetryAfter(Request $request, $user): int
    {
        $operation = $this->getOperationType($request);
        $key = "video_rate_limit:{$operation}:{$user->id}";
        
        return Cache::ttl($key) ?: 3600;
    }

    /**
     * Determine operation type from request
     */
    protected function getOperationType(Request $request): string
    {
        if ($request->routeIs('video.sessions.create')) {
            return 'create_session';
        } elseif ($request->routeIs('video.sessions.recording.start')) {
            return 'start_recording';
        } elseif ($request->routeIs('video.sessions.join')) {
            return 'join_session';
        }
        
        return 'default';
    }

    /**
     * Validate request integrity
     */
    protected function validateRequestIntegrity(Request $request): bool
    {
        // Validate Content-Type for POST requests
        if ($request->isMethod('POST') && !$request->isJson()) {
            return false;
        }

        // Validate required fields for session creation
        if ($request->routeIs('video.sessions.create')) {
            $required = ['interview_id', 'participants'];
            foreach ($required as $field) {
                if (!$request->has($field)) {
                    return false;
                }
            }
        }

        // Validate session ID format
        if ($request->route('sessionId')) {
            $sessionId = $request->route('sessionId');
            if (!$this->isValidSessionId($sessionId)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Validate session ID format
     */
    protected function isValidSessionId(string $sessionId): bool
    {
        // Session ID should be alphanumeric with underscores/hyphens, 10-50 chars
        return preg_match('/^[a-zA-Z0-9_-]{10,50}$/', $sessionId);
    }

    /**
     * Check if request is an admin operation
     */
    protected function isAdminOperation(Request $request): bool
    {
        $adminOperations = [
            'video.sessions.forceEnd',
            'video.sessions.deleteRecording',
            'video.sessions.exportAll',
            'video.sessions.audit',
        ];
        
        return $request->routeIs($adminOperations);
    }

    /**
     * Check if IP is whitelisted for admin operations
     */
    protected function isIPWhitelisted(string $ip): bool
    {
        $whitelist = config('video.admin_ip_whitelist', []);
        
        // Always allow localhost in development
        if (app()->environment('local') && in_array($ip, ['127.0.0.1', '::1'])) {
            return true;
        }
        
        // Check exact match
        if (in_array($ip, $whitelist)) {
            return true;
        }
        
        // Check CIDR ranges
        foreach ($whitelist as $range) {
            if (strpos($range, '/') !== false && $this->ipInRange($ip, $range)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Check if IP is in CIDR range
     */
    protected function ipInRange(string $ip, string $range): bool
    {
        list($subnet, $bits) = explode('/', $range);
        if ($bits === null) {
            $bits = 32;
        }
        
        $ip = ip2long($ip);
        $subnet = ip2long($subnet);
        $mask = -1 << (32 - $bits);
        $subnet &= $mask;
        
        return ($ip & $mask) == $subnet;
    }

    /**
     * Check if user agent is blocked
     */
    protected function isBlockedUserAgent(?string $userAgent): bool
    {
        if (!$userAgent) {
            return true;
        }
        
        $blockedPatterns = [
            '/bot/i',
            '/crawler/i',
            '/spider/i',
            '/scraper/i',
            '/curl/i',
            '/wget/i',
        ];
        
        foreach ($blockedPatterns as $pattern) {
            if (preg_match($pattern, $userAgent)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Log successful access for audit
     */
    protected function logSuccessfulAccess(Request $request, Response $response): void
    {
        if ($response->getStatusCode() < 400) {
            Log::info('Video conferencing access granted', [
                'user_id' => Auth::id(),
                'ip_address' => $request->ip(),
                'endpoint' => $request->path(),
                'method' => $request->method(),
                'response_code' => $response->getStatusCode(),
                'timestamp' => now()
            ]);
        }
    }

    /**
     * Add security headers to response
     */
    protected function addSecurityHeaders(Response $response): Response
    {
        $headers = [
            // Prevent clickjacking
            'X-Frame-Options' => 'DENY',
            
            // Prevent MIME type sniffing
            'X-Content-Type-Options' => 'nosniff',
            
            // Enable XSS protection
            'X-XSS-Protection' => '1; mode=block',
            
            // Enforce HTTPS
            'Strict-Transport-Security' => 'max-age=31536000; includeSubDomains',
            
            // Control referrer information
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            
            // Content Security Policy for video content
            'Content-Security-Policy' => implode('; ', [
                "default-src 'self'",
                "media-src 'self' blob: data: https://*.vonage.com https://*.opentok.com",
                "script-src 'self' 'unsafe-inline' https://*.vonage.com https://*.opentok.com",
                "style-src 'self' 'unsafe-inline'",
                "connect-src 'self' wss: https://*.vonage.com https://*.opentok.com",
                "img-src 'self' data: blob:",
                "font-src 'self'",
                "object-src 'none'",
                "base-uri 'self'",
                "form-action 'self'"
            ]),
            
            // Permissions Policy for camera and microphone
            'Permissions-Policy' => implode(', ', [
                'camera=(*)',
                'microphone=(*)',
                'geolocation=()',
                'payment=()',
                'usb=()'
            ])
        ];

        foreach ($headers as $key => $value) {
            $response->headers->set($key, $value);
        }

        return $response;
    }
}