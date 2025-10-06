<?php

namespace App\Modules\Audit\Repositories;

use App\Models\AuditLog;
use Illuminate\Support\Collection;

/**
 * AuditLogRepository - Interface for HIPAA/LGPD compliant audit persistence
 *
 * Provides append-only audit trail with efficient queries.
 *
 * Compliance requirements:
 * - 7-year retention (HIPAA/LGPD)
 * - IP address hashing (LGPD privacy)
 * - Immutable records (append-only)
 * - Request correlation (X-Request-ID)
 *
 * @see docs/ARCHITECTURE_DECISIONS.md - ADR-004: Database & Privacy
 * @see App\Modules\Gamification\Services\AuditLogService - Service layer
 */
interface AuditLogRepository
{
    /**
     * Append an audit log entry (immutable)
     *
     * @param array $entry Audit entry data:
     *   - user_id: int|null (nullable for system actions)
     *   - who: string (user:123 or system)
     *   - what: string (action identifier)
     *   - where: string (hashed IP address)
     *   - how: string (HTTP method + endpoint or CLI command)
     *   - details: array (additional context, no PHI)
     *   - request_id: string (correlation ID)
     *   - session_id: string|null (session identifier)
     *
     * @return string Log entry ID
     */
    public function append(array $entry): string;

    /**
     * Get audit logs for a specific user
     *
     * @param int $userId User ID
     * @param int $limit Maximum records to return
     * @param int $offset Pagination offset
     * @return Collection<AuditLog>
     */
    public function getByUser(int $userId, int $limit = 50, int $offset = 0): Collection;

    /**
     * Get audit logs by action type
     *
     * @param string $action Action identifier
     * @param \DateTimeInterface|null $since Start date filter
     * @param int $limit Maximum records to return
     * @return Collection<AuditLog>
     */
    public function getByAction(string $action, ?\DateTimeInterface $since = null, int $limit = 100): Collection;

    /**
     * Get audit logs within time range
     *
     * @param \DateTimeInterface $start Start date
     * @param \DateTimeInterface $end End date
     * @param int $limit Maximum records to return
     * @return Collection<AuditLog>
     */
    public function getByTimeRange(\DateTimeInterface $start, \DateTimeInterface $end, int $limit = 1000): Collection;

    /**
     * Get correlated audit logs by request ID
     *
     * Retrieves all audit entries for a specific request (multi-step operations)
     *
     * @param string $requestId X-Request-ID header value
     * @return Collection<AuditLog>
     */
    public function getByRequestId(string $requestId): Collection;

    /**
     * Search audit logs with filters
     *
     * @param array $filters Search criteria:
     *   - user_id: int|null
     *   - action: string|null
     *   - start_date: \DateTimeInterface|null
     *   - end_date: \DateTimeInterface|null
     *   - request_id: string|null
     * @param int $limit Maximum records to return
     * @param int $offset Pagination offset
     * @return Collection<AuditLog>
     */
    public function search(array $filters, int $limit = 100, int $offset = 0): Collection;

    /**
     * Count audit logs matching filters
     *
     * @param array $filters Search criteria (same as search method)
     * @return int Total matching records
     */
    public function count(array $filters): int;

    /**
     * Purge audit logs older than retention period
     *
     * HIPAA/LGPD require 7-year retention. This method purges older records.
     * Should be run via scheduled job, not ad-hoc.
     *
     * @param \DateTimeInterface $olderThan Purge records before this date
     * @return int Number of records deleted
     */
    public function purgeOlderThan(\DateTimeInterface $olderThan): int;
}
