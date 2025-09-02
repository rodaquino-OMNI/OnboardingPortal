<?php

namespace App\Listeners;

use App\Events\SessionFingerprintMismatch;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use App\Mail\SecurityAlert;

/**
 * Session Fingerprint Mismatch Listener
 * 
 * Handles security responses to fingerprint mismatches including:
 * - Detailed security logging
 * - Rate limiting suspicious IPs
 * - Alerting administrators to potential threats
 * - Triggering additional security measures
 */
class LogSessionFingerprintMismatch
{
    /**
     * Handle the event.
     */
    public function handle(SessionFingerprintMismatch $event): void
    {
        // Log detailed security event
        $this->logSecurityEvent($event);

        // Track suspicious IP addresses
        $this->trackSuspiciousActivity($event);

        // Send alerts for high-risk situations
        $this->handleSecurityAlerts($event);

        // Update security metrics
        $this->updateSecurityMetrics($event);
    }

    /**
     * Log comprehensive security event
     */
    protected function logSecurityEvent(SessionFingerprintMismatch $event): void
    {
        Log::warning('Session fingerprint mismatch detected', [
            'security_event' => 'fingerprint_mismatch',
            'user_id' => $event->userId,
            'ip_address' => $event->ipAddress,
            'user_agent' => $event->userAgent,
            'reason' => $event->reason,
            'mismatch_count' => $event->mismatchCount,
            'request_path' => $event->requestPath,
            'fingerprint_created_at' => $event->fingerprintData['created_at'] ?? null,
            'fingerprint_mode' => $event->fingerprintData['mode'] ?? null,
            'verification_count' => $event->fingerprintData['verification_count'] ?? 0,
            'additional_context' => $event->additionalContext,
            'severity' => $this->calculateSeverity($event),
            'timestamp' => now()->toISOString(),
        ]);
    }

    /**
     * Track suspicious activity patterns
     */
    protected function trackSuspiciousActivity(SessionFingerprintMismatch $event): void
    {
        $ipKey = 'suspicious_ip:' . hash('sha256', $event->ipAddress);
        $userKey = 'suspicious_user:' . $event->userId;

        // Increment IP-based tracking
        $ipCount = Cache::increment($ipKey, 1);
        Cache::expire($ipKey, now()->addHours(24));

        // Increment user-based tracking
        $userCount = Cache::increment($userKey, 1);
        Cache::expire($userKey, now()->addHours(6));

        // Log pattern if suspicious activity is detected
        if ($ipCount >= 5 || $userCount >= 3) {
            Log::alert('Suspicious fingerprint activity pattern detected', [
                'pattern_type' => $ipCount >= 5 ? 'ip_based' : 'user_based',
                'ip_violations' => $ipCount,
                'user_violations' => $userCount,
                'user_id' => $event->userId,
                'ip_address' => $event->ipAddress,
                'last_violation_reason' => $event->reason,
            ]);
        }
    }

    /**
     * Handle security alerts for high-risk situations
     */
    protected function handleSecurityAlerts(SessionFingerprintMismatch $event): void
    {
        $severity = $this->calculateSeverity($event);

        // Send immediate alerts for critical situations
        if ($severity === 'critical') {
            $this->sendSecurityAlert($event);
        }

        // Set rate limiting for suspicious IPs
        if ($event->mismatchCount >= 3) {
            $this->implementAdditionalRateLimit($event);
        }
    }

    /**
     * Update security metrics for monitoring
     */
    protected function updateSecurityMetrics(SessionFingerprintMismatch $event): void
    {
        $metricsKey = 'fingerprint_metrics:' . now()->format('Y-m-d-H');
        
        $metrics = Cache::get($metricsKey, [
            'total_mismatches' => 0,
            'unique_users' => [],
            'unique_ips' => [],
            'reasons' => [],
        ]);

        $metrics['total_mismatches']++;
        $metrics['unique_users'][$event->userId] = true;
        $metrics['unique_ips'][hash('sha256', $event->ipAddress)] = true;
        
        if (!isset($metrics['reasons'][$event->reason])) {
            $metrics['reasons'][$event->reason] = 0;
        }
        $metrics['reasons'][$event->reason]++;

        Cache::put($metricsKey, $metrics, now()->addHours(48));
    }

    /**
     * Calculate event severity
     */
    protected function calculateSeverity(SessionFingerprintMismatch $event): string
    {
        // Critical: Multiple mismatches from same user
        if ($event->mismatchCount >= 5) {
            return 'critical';
        }

        // High: Rapid successive mismatches
        if ($event->mismatchCount >= 3) {
            return 'high';
        }

        // Medium: Second mismatch
        if ($event->mismatchCount >= 2) {
            return 'medium';
        }

        // Low: First mismatch
        return 'low';
    }

    /**
     * Send security alert to administrators
     */
    protected function sendSecurityAlert(SessionFingerprintMismatch $event): void
    {
        // Only send if not in testing environment and alerts are enabled
        if (app()->environment('testing') || !config('security.alerts.enabled', true)) {
            return;
        }

        try {
            $alertData = [
                'type' => 'Session Fingerprint Security Alert',
                'severity' => 'Critical',
                'user_id' => $event->userId,
                'reason' => $event->reason,
                'mismatch_count' => $event->mismatchCount,
                'ip_address' => '***.' . substr($event->ipAddress, strrpos($event->ipAddress, '.') + 1),
                'timestamp' => now()->toISOString(),
            ];

            // Queue email to security team
            $recipients = config('security.alert_recipients', []);
            foreach ($recipients as $recipient) {
                Mail::to($recipient)->queue(new SecurityAlert($alertData));
            }

        } catch (\Exception $e) {
            Log::error('Failed to send security alert', [
                'error' => $e->getMessage(),
                'event_data' => $event->toArray(),
            ]);
        }
    }

    /**
     * Implement additional rate limiting for suspicious IPs
     */
    protected function implementAdditionalRateLimit(SessionFingerprintMismatch $event): void
    {
        $rateLimitKey = 'strict_rate_limit:' . hash('sha256', $event->ipAddress);
        
        // Implement strict rate limiting for 1 hour
        Cache::put($rateLimitKey, [
            'enabled' => true,
            'max_requests' => 10, // Very low limit
            'window_minutes' => 60,
            'reason' => 'fingerprint_mismatch_pattern',
            'user_id' => $event->userId,
        ], now()->addHour());

        Log::info('Additional rate limiting implemented', [
            'ip_hash' => hash('sha256', $event->ipAddress),
            'user_id' => $event->userId,
            'trigger_reason' => 'fingerprint_mismatch_pattern',
            'duration_minutes' => 60,
        ]);
    }
}