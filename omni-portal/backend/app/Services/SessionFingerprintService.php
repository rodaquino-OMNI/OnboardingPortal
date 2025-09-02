<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Session;
use App\Http\Middleware\SessionFingerprintMiddleware;

/**
 * Session Fingerprint Service
 * 
 * Provides centralized session fingerprinting functionality for the application.
 * This service is used by authentication controllers and other components that
 * need to manage session security through device fingerprinting.
 * 
 * Features:
 * - Fingerprint generation and validation
 * - Integration with authentication events
 * - Security event logging
 * - Fingerprint analysis and reporting
 */
class SessionFingerprintService
{
    /**
     * Fingerprint validation modes
     */
    public const MODE_STRICT = 'strict';
    public const MODE_BALANCED = 'balanced';
    public const MODE_PERMISSIVE = 'permissive';

    /**
     * Default fingerprint mode
     */
    protected string $defaultMode;

    public function __construct()
    {
        $this->defaultMode = config('session.fingerprint_mode', self::MODE_BALANCED);
    }

    /**
     * Generate and store a new session fingerprint on user login
     */
    public function onUserLogin(Request $request, $user, string $mode = null): void
    {
        if (!config('session.fingerprinting', false)) {
            return;
        }

        $mode = $mode ?: $this->defaultMode;

        // Clear any existing fingerprint data
        Session::forget(['fingerprint_data', 'fingerprint_mismatches', 'guest_fingerprint']);

        // Regenerate session ID for security
        Session::regenerate(true);

        // Generate new fingerprint
        SessionFingerprintMiddleware::regenerateFingerprint($request, $mode);

        $this->logSecurityEvent($request, 'fingerprint_login_generated', [
            'user_id' => $user->id,
            'mode' => $mode,
            'login_method' => $this->detectLoginMethod($request),
        ]);
    }

    /**
     * Handle user logout - clear fingerprint data
     */
    public function onUserLogout(Request $request): void
    {
        if (!config('session.fingerprinting', false)) {
            return;
        }

        $userId = Auth::id();
        $fingerprintInfo = SessionFingerprintMiddleware::getFingerprintInfo();

        // Log logout event with fingerprint stats
        $this->logSecurityEvent($request, 'fingerprint_logout', [
            'user_id' => $userId,
            'verification_count' => $fingerprintInfo['verification_count'],
            'mismatch_count' => $fingerprintInfo['mismatch_count'],
            'session_duration' => $this->calculateSessionDuration($fingerprintInfo),
        ]);

        // Clear fingerprint data
        Session::forget(['fingerprint_data', 'fingerprint_mismatches']);
    }

    /**
     * Validate current session fingerprint
     */
    public function validateFingerprint(Request $request, string $mode = null): array
    {
        if (!config('session.fingerprinting', false)) {
            return ['valid' => true, 'reason' => 'fingerprinting_disabled'];
        }

        $middleware = new SessionFingerprintMiddleware();
        $currentFingerprint = $middleware->generateFingerprint($request, $mode ?: $this->defaultMode);
        $sessionData = Session::get('fingerprint_data', []);

        if (empty($sessionData)) {
            return ['valid' => false, 'reason' => 'no_fingerprint_data'];
        }

        $storedFingerprint = $sessionData['fingerprint'] ?? '';
        $isValid = $storedFingerprint === $currentFingerprint;

        return [
            'valid' => $isValid,
            'reason' => $isValid ? 'fingerprint_match' : 'fingerprint_mismatch',
            'fingerprint_age' => $this->calculateFingerprintAge($sessionData),
            'verification_count' => $sessionData['verification_count'] ?? 0,
        ];
    }

    /**
     * Get comprehensive fingerprint status for security dashboard
     */
    public function getFingerprintStatus(): array
    {
        $fingerprintInfo = SessionFingerprintMiddleware::getFingerprintInfo();
        $isActive = config('session.fingerprinting', false);

        return [
            'enabled' => $isActive,
            'has_fingerprint' => $fingerprintInfo['has_fingerprint'],
            'created_at' => $fingerprintInfo['created_at'],
            'last_verified' => $fingerprintInfo['last_verified'],
            'verification_count' => $fingerprintInfo['verification_count'],
            'mismatch_count' => $fingerprintInfo['mismatch_count'],
            'mode' => $fingerprintInfo['mode'],
            'status' => $this->determineFingerprintStatus($fingerprintInfo),
            'risk_level' => $this->calculateRiskLevel($fingerprintInfo),
        ];
    }

    /**
     * Force fingerprint regeneration (admin action)
     */
    public function regenerateFingerprint(Request $request, string $reason = 'admin_request'): void
    {
        if (!Auth::check()) {
            throw new \Exception('User must be authenticated to regenerate fingerprint');
        }

        $oldInfo = SessionFingerprintMiddleware::getFingerprintInfo();
        
        // Generate new fingerprint
        SessionFingerprintMiddleware::regenerateFingerprint($request, $this->defaultMode);

        $this->logSecurityEvent($request, 'fingerprint_force_regenerated', [
            'user_id' => Auth::id(),
            'reason' => $reason,
            'old_verification_count' => $oldInfo['verification_count'],
            'old_mismatch_count' => $oldInfo['mismatch_count'],
        ]);
    }

    /**
     * Analyze fingerprint patterns for security insights
     */
    public function analyzeFingerprintPatterns(int $days = 30): array
    {
        // This would typically query log data or a dedicated fingerprint events table
        // For now, return mock analysis data
        return [
            'period_days' => $days,
            'total_sessions' => 0, // Would come from actual data
            'successful_validations' => 0,
            'failed_validations' => 0,
            'forced_regenerations' => 0,
            'session_invalidations' => 0,
            'most_common_mismatch_reasons' => [],
            'risk_trends' => [],
            'recommendations' => $this->generateSecurityRecommendations(),
        ];
    }

    /**
     * Check if fingerprint validation should be bypassed
     */
    public function shouldBypassValidation(Request $request): bool
    {
        // Bypass for certain admin operations
        if ($request->hasHeader('X-Admin-Override') && Auth::user()?->hasRole('admin')) {
            $this->logSecurityEvent($request, 'fingerprint_validation_bypassed', [
                'user_id' => Auth::id(),
                'reason' => 'admin_override',
            ]);
            return true;
        }

        // Bypass for emergency recovery endpoints
        if ($request->is('api/auth/emergency-recovery/*')) {
            return true;
        }

        return false;
    }

    /**
     * Calculate session duration from fingerprint data
     */
    protected function calculateSessionDuration(array $fingerprintInfo): ?int
    {
        if (!isset($fingerprintInfo['created_at'])) {
            return null;
        }

        $createdAt = \Carbon\Carbon::parse($fingerprintInfo['created_at']);
        return $createdAt->diffInMinutes(now());
    }

    /**
     * Calculate fingerprint age in minutes
     */
    protected function calculateFingerprintAge(array $sessionData): ?int
    {
        if (!isset($sessionData['created_at'])) {
            return null;
        }

        $createdAt = \Carbon\Carbon::parse($sessionData['created_at']);
        return $createdAt->diffInMinutes(now());
    }

    /**
     * Determine overall fingerprint status
     */
    protected function determineFingerprintStatus(array $fingerprintInfo): string
    {
        if (!$fingerprintInfo['has_fingerprint']) {
            return 'inactive';
        }

        $mismatchCount = $fingerprintInfo['mismatch_count'];
        $verificationCount = $fingerprintInfo['verification_count'];

        if ($mismatchCount >= 3) {
            return 'high_risk';
        }

        if ($mismatchCount > 0) {
            return 'medium_risk';
        }

        if ($verificationCount > 10) {
            return 'trusted';
        }

        return 'active';
    }

    /**
     * Calculate risk level based on fingerprint data
     */
    protected function calculateRiskLevel(array $fingerprintInfo): string
    {
        if (!$fingerprintInfo['has_fingerprint']) {
            return 'unknown';
        }

        $mismatchCount = $fingerprintInfo['mismatch_count'];
        $verificationCount = $fingerprintInfo['verification_count'];
        $mismatchRatio = $verificationCount > 0 ? $mismatchCount / $verificationCount : 0;

        if ($mismatchRatio > 0.3 || $mismatchCount >= 5) {
            return 'high';
        }

        if ($mismatchRatio > 0.1 || $mismatchCount >= 2) {
            return 'medium';
        }

        return 'low';
    }

    /**
     * Detect login method from request
     */
    protected function detectLoginMethod(Request $request): string
    {
        if ($request->hasHeader('Authorization')) {
            return 'api_token';
        }

        if ($request->is('api/auth/*/callback')) {
            return 'oauth';
        }

        if ($request->hasCookie('remember_token')) {
            return 'remember_token';
        }

        return 'standard';
    }

    /**
     * Generate security recommendations based on patterns
     */
    protected function generateSecurityRecommendations(): array
    {
        return [
            'Consider enabling strict mode for sensitive operations',
            'Implement IP whitelisting for admin accounts',
            'Add device registration for trusted devices',
            'Enable two-factor authentication for high-risk accounts',
            'Set up automated alerts for suspicious fingerprint activity',
        ];
    }

    /**
     * Log security events with proper context
     */
    protected function logSecurityEvent(Request $request, string $event, array $data = []): void
    {
        $logData = array_merge([
            'event' => $event,
            'service' => 'SessionFingerprintService',
            'ip' => $request->ip(),
            'path' => $request->path(),
            'method' => $request->method(),
            'user_id' => Auth::id(),
            'session_id' => Session::getId(),
            'timestamp' => now()->toISOString(),
        ], $data);

        Log::info("Fingerprint service event: {$event}", $logData);
    }
}