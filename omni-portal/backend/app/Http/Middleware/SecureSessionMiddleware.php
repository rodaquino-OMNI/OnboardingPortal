<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class SecureSessionMiddleware
{
    /**
     * Handle an incoming request with enhanced session security.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        // Initialize session security
        $this->initializeSessionSecurity($request);
        
        // Validate session integrity
        if (!$this->validateSessionIntegrity($request)) {
            return $this->terminateSession($request, 'Session integrity check failed');
        }
        
        // Check for session timeout
        if ($this->isSessionExpired()) {
            return $this->terminateSession($request, 'Session expired due to inactivity');
        }
        
        // Update session activity
        $this->updateSessionActivity();
        
        // Rotate session ID for sensitive operations
        if ($this->shouldRotateSession($request)) {
            $this->rotateSession();
        }
        
        $response = $next($request);
        
        // Set security headers for session cookies
        $this->setSecurityHeaders($response);
        
        return $response;
    }
    
    /**
     * Initialize session security features.
     */
    private function initializeSessionSecurity(Request $request): void
    {
        if (!Session::has('fingerprint')) {
            Session::put('fingerprint', $this->generateFingerprint($request));
            Session::put('created_at', Carbon::now());
            Session::put('ip_address', $this->getClientIp($request));
            Session::put('user_agent', $request->userAgent());
        }
    }
    
    /**
     * Validate session integrity.
     */
    private function validateSessionIntegrity(Request $request): bool
    {
        // Validate fingerprint
        if (config('session.fingerprinting', true)) {
            $currentFingerprint = $this->generateFingerprint($request);
            $sessionFingerprint = Session::get('fingerprint');
            
            if ($sessionFingerprint && !hash_equals($sessionFingerprint, $currentFingerprint)) {
                Log::warning('Session fingerprint mismatch', [
                    'session_id' => Session::getId(),
                    'ip' => $this->getClientIp($request)
                ]);
                return false;
            }
        }
        
        // Validate IP address
        if (config('session.validate_ip', true)) {
            $sessionIp = Session::get('ip_address');
            $currentIp = $this->getClientIp($request);
            
            if ($sessionIp && !$this->isIpValid($sessionIp, $currentIp)) {
                Log::warning('Session IP mismatch', [
                    'session_ip' => $sessionIp,
                    'current_ip' => $currentIp
                ]);
                return false;
            }
        }
        
        // Validate User Agent
        if (config('session.validate_user_agent', true)) {
            $sessionAgent = Session::get('user_agent');
            $currentAgent = $request->userAgent();
            
            if ($sessionAgent && $sessionAgent !== $currentAgent) {
                Log::warning('Session User-Agent mismatch', [
                    'session_agent' => $sessionAgent,
                    'current_agent' => $currentAgent
                ]);
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Check if session has expired due to inactivity.
     */
    private function isSessionExpired(): bool
    {
        $lastActivity = Session::get('last_activity');
        
        if (!$lastActivity) {
            return false;
        }
        
        $inactiveTimeout = config('session.inactive_timeout', 60);
        $lastActivityTime = Carbon::parse($lastActivity);
        
        return $lastActivityTime->diffInMinutes(Carbon::now()) > $inactiveTimeout;
    }
    
    /**
     * Update session last activity timestamp.
     */
    private function updateSessionActivity(): void
    {
        Session::put('last_activity', Carbon::now());
    }
    
    /**
     * Determine if session should be rotated.
     */
    private function shouldRotateSession(Request $request): bool
    {
        if (!config('session.rotate_sensitive', true)) {
            return false;
        }
        
        // Rotate on sensitive operations
        $sensitiveRoutes = [
            'password.update',
            'profile.update',
            'payment.*',
            'admin.*',
            'documents.upload',
            'beneficiary.create'
        ];
        
        foreach ($sensitiveRoutes as $route) {
            if ($request->routeIs($route)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Rotate session ID while preserving data.
     */
    private function rotateSession(): void
    {
        Session::regenerate();
        Session::put('last_rotation', Carbon::now());
        
        Log::info('Session ID rotated', [
            'user_id' => auth()->id() ?? 'guest',
            'new_session_id' => Session::getId()
        ]);
    }
    
    /**
     * Generate session fingerprint.
     */
    private function generateFingerprint(Request $request): string
    {
        $components = [
            $request->userAgent(),
            $request->header('Accept'),
            $request->header('Accept-Language'),
            $request->header('Accept-Encoding'),
            $this->getClientIp($request)
        ];
        
        return hash('sha256', implode('|', $components));
    }
    
    /**
     * Get client IP address.
     */
    private function getClientIp(Request $request): string
    {
        return $request->ip() ?? '0.0.0.0';
    }
    
    /**
     * Validate IP address allowing for subnet changes.
     */
    private function isIpValid(string $sessionIp, string $currentIp): bool
    {
        // Allow exact match
        if ($sessionIp === $currentIp) {
            return true;
        }
        
        // Allow same subnet for mobile networks
        $sessionParts = explode('.', $sessionIp);
        $currentParts = explode('.', $currentIp);
        
        // Check if first 3 octets match (same /24 subnet)
        return $sessionParts[0] === $currentParts[0] &&
               $sessionParts[1] === $currentParts[1] &&
               $sessionParts[2] === $currentParts[2];
    }
    
    /**
     * Terminate session securely.
     */
    private function terminateSession(Request $request, string $reason)
    {
        Log::warning('Session terminated', [
            'reason' => $reason,
            'session_id' => Session::getId(),
            'ip' => $this->getClientIp($request),
            'user_id' => auth()->id() ?? 'guest'
        ]);
        
        Session::invalidate();
        Session::regenerateToken();
        
        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Session expired. Please login again.',
                'error' => 'session_expired'
            ], 401);
        }
        
        return redirect()->route('login')
            ->with('error', 'Your session has expired. Please login again.');
    }
    
    /**
     * Set security headers for response.
     */
    private function setSecurityHeaders($response): void
    {
        if (method_exists($response, 'header')) {
            $response->header('X-Frame-Options', 'DENY');
            $response->header('X-Content-Type-Options', 'nosniff');
            $response->header('X-XSS-Protection', '1; mode=block');
            $response->header('Referrer-Policy', 'strict-origin-when-cross-origin');
            
            if (config('session.secure', true)) {
                $response->header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
            }
        }
    }
}