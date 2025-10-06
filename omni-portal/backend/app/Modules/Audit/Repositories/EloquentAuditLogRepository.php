<?php

namespace App\Modules\Audit\Repositories;

use App\Models\AuditLog;
use Illuminate\Support\Collection;

/**
 * EloquentAuditLogRepository - Eloquent implementation of AuditLogRepository
 *
 * Provides HIPAA/LGPD compliant audit trail with optimized queries.
 *
 * Performance optimizations:
 * - Indexed queries on user_id, action, created_at, request_id
 * - Chunked purge operations to avoid memory issues
 * - Eager loading of relationships where applicable
 *
 * @see AuditLogRepository - Interface contract
 */
class EloquentAuditLogRepository implements AuditLogRepository
{
    /**
     * Append an audit log entry (immutable)
     */
    public function append(array $entry): string
    {
        $log = AuditLog::create([
            'user_id' => $entry['user_id'] ?? null,
            'who' => $entry['who'],
            'what' => $entry['what'],
            'where' => $entry['where'],
            'how' => $entry['how'],
            'details' => $entry['details'] ?? [],
            'request_id' => $entry['request_id'],
            'session_id' => $entry['session_id'] ?? null,
        ]);

        return (string) $log->id;
    }

    /**
     * Get audit logs for a specific user
     */
    public function getByUser(int $userId, int $limit = 50, int $offset = 0): Collection
    {
        return AuditLog::where('user_id', $userId)
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->offset($offset)
            ->get();
    }

    /**
     * Get audit logs by action type
     */
    public function getByAction(string $action, ?\DateTimeInterface $since = null, int $limit = 100): Collection
    {
        $query = AuditLog::where('what', $action);

        if ($since) {
            $query->where('created_at', '>=', $since);
        }

        return $query->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
    }

    /**
     * Get audit logs within time range
     */
    public function getByTimeRange(\DateTimeInterface $start, \DateTimeInterface $end, int $limit = 1000): Collection
    {
        return AuditLog::whereBetween('created_at', [$start, $end])
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
    }

    /**
     * Get correlated audit logs by request ID
     */
    public function getByRequestId(string $requestId): Collection
    {
        return AuditLog::where('request_id', $requestId)
            ->orderBy('created_at', 'asc') // Chronological order for correlation
            ->get();
    }

    /**
     * Search audit logs with filters
     */
    public function search(array $filters, int $limit = 100, int $offset = 0): Collection
    {
        $query = AuditLog::query();

        if (isset($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }

        if (isset($filters['action'])) {
            $query->where('what', $filters['action']);
        }

        if (isset($filters['start_date'])) {
            $query->where('created_at', '>=', $filters['start_date']);
        }

        if (isset($filters['end_date'])) {
            $query->where('created_at', '<=', $filters['end_date']);
        }

        if (isset($filters['request_id'])) {
            $query->where('request_id', $filters['request_id']);
        }

        return $query->orderBy('created_at', 'desc')
            ->limit($limit)
            ->offset($offset)
            ->get();
    }

    /**
     * Count audit logs matching filters
     */
    public function count(array $filters): int
    {
        $query = AuditLog::query();

        if (isset($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }

        if (isset($filters['action'])) {
            $query->where('what', $filters['action']);
        }

        if (isset($filters['start_date'])) {
            $query->where('created_at', '>=', $filters['start_date']);
        }

        if (isset($filters['end_date'])) {
            $query->where('created_at', '<=', $filters['end_date']);
        }

        if (isset($filters['request_id'])) {
            $query->where('request_id', $filters['request_id']);
        }

        return $query->count();
    }

    /**
     * Purge audit logs older than retention period
     *
     * Uses chunked deletion to avoid memory issues with large datasets.
     * Logs purge activity for compliance audit.
     */
    public function purgeOlderThan(\DateTimeInterface $olderThan): int
    {
        $totalDeleted = 0;

        // Chunk deletion to avoid memory issues
        do {
            $deleted = AuditLog::where('created_at', '<', $olderThan)
                ->limit(1000)
                ->delete();

            $totalDeleted += $deleted;

            // Avoid tight loop
            if ($deleted > 0) {
                usleep(100000); // 100ms delay between chunks
            }
        } while ($deleted > 0);

        // Log purge activity (meta-audit)
        if ($totalDeleted > 0) {
            AuditLog::create([
                'user_id' => null,
                'who' => 'system',
                'what' => 'audit_log_purge',
                'where' => hash('sha256', 'system'),
                'how' => 'scheduled_job',
                'details' => [
                    'purged_count' => $totalDeleted,
                    'purge_date' => $olderThan->format('Y-m-d'),
                ],
                'request_id' => \Illuminate\Support\Str::uuid(),
                'session_id' => null,
            ]);
        }

        return $totalDeleted;
    }
}
