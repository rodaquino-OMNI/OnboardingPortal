<?php

namespace App\Modules\Gamification\Services;

use App\Models\User;
use App\Models\AuditLog;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Str;

/**
 * AuditLogService - WHO-WHAT-WHEN-WHERE-HOW tracking
 *
 * Implements audit logging per SECURITY_CHECKLIST.md with:
 * - WHO: User ID or system identifier
 * - WHAT: Action name (verb + noun)
 * - WHEN: Timestamp (UTC)
 * - WHERE: IP address (hashed for privacy)
 * - HOW: HTTP method + endpoint or CLI command
 *
 * Retention: 7 years for HIPAA compliance
 * Privacy: IP addresses hashed, no PHI in details
 *
 * @see docs/SECURITY_CHECKLIST.md - Audit log requirements
 * @see docs/THREAT_MODEL.md - Audit trail analysis
 */
class AuditLogService
{
    /**
     * Log an audit event
     *
     * @param User|null $user User who performed action (null for system)
     * @param string $what Action identifier (e.g., 'points_awarded', 'login_success')
     * @param array $details Additional context (NO PHI - will be logged as-is)
     * @param string|null $requestId Optional request ID for correlation
     * @return AuditLog Created audit log entry
     */
    public function log(
        ?User $user,
        string $what,
        array $details = [],
        ?string $requestId = null
    ): AuditLog {
        // WHO: User ID or 'system'
        $who = $user ? "user:{$user->id}" : 'system';

        // WHEN: Current timestamp (auto-set by database)

        // WHERE: IP address (hashed for privacy per LGPD)
        $ipAddress = Request::ip();
        $where = $this->hashIpAddress($ipAddress);

        // HOW: HTTP method + endpoint or CLI context
        $how = $this->captureHow();

        // Request ID for correlation across logs
        $requestId = $requestId ?? Request::header('X-Request-ID') ?? Str::uuid()->toString();

        // Session fingerprint (if available)
        $sessionId = session()->getId() ? hash('sha256', session()->getId()) : null;

        return AuditLog::create([
            'user_id' => $user?->id,
            'who' => $who,
            'what' => $what,
            'where' => $where,
            'how' => $how,
            'details' => $details,
            'request_id' => $requestId,
            'session_id' => $sessionId,
        ]);
    }

    /**
     * Hash IP address for privacy compliance
     *
     * Per LGPD and HIPAA, IP addresses are PII and must be protected.
     * We hash them to enable correlation while protecting privacy.
     *
     * @param string $ipAddress IP address
     * @return string SHA-256 hash (first 16 chars for storage efficiency)
     */
    private function hashIpAddress(string $ipAddress): string
    {
        // SHA-256 hash + truncate to 16 chars (collision probability negligible)
        return substr(hash('sha256', $ipAddress), 0, 16);
    }

    /**
     * Capture HOW the action was performed
     *
     * @return string HTTP method + endpoint or CLI command
     */
    private function captureHow(): string
    {
        if (app()->runningInConsole()) {
            // CLI context
            $command = $_SERVER['argv'][1] ?? 'artisan';
            return "CLI: {$command}";
        }

        // HTTP context
        $method = Request::method();
        $path = Request::path();

        return "{$method} /{$path}";
    }

    /**
     * Query audit logs for a user
     *
     * @param User $user User to query
     * @param string|null $action Optional action filter
     * @param int $limit Max results
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getUserLogs(User $user, ?string $action = null, int $limit = 100)
    {
        $query = AuditLog::where('user_id', $user->id)
            ->orderBy('when', 'desc')
            ->limit($limit);

        if ($action) {
            $query->where('what', $action);
        }

        return $query->get();
    }

    /**
     * Get logs by request ID (for debugging and correlation)
     *
     * @param string $requestId Request UUID
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getLogsByRequestId(string $requestId)
    {
        return AuditLog::where('request_id', $requestId)
            ->orderBy('when', 'asc')
            ->get();
    }

    /**
     * Cleanup old audit logs (retention policy)
     *
     * Per SECURITY_CHECKLIST.md: 7-year retention for HIPAA
     * This should be run as a scheduled job monthly
     *
     * @param int $retentionYears Years to retain (default 7)
     * @return int Number of deleted records
     */
    public function cleanupOldLogs(int $retentionYears = 7): int
    {
        $cutoffDate = now()->subYears($retentionYears);

        return AuditLog::where('when', '<', $cutoffDate)->delete();
    }
}
