<?php

namespace App\Modules\Gamification\Repositories;

/**
 * PointsRepository - Interface for points transaction persistence
 *
 * Defines contract for idempotent points recording and balance management.
 * Implementations MUST ensure:
 * - Idempotency via unique constraint on idempotency_key
 * - Concurrency safety via optimistic locking (version field)
 * - Transactional integrity for all mutations
 *
 * @see App\Modules\Gamification\Services\PointsEngine - Primary consumer
 * @see docs/GAMIFICATION_SPEC.md - Business rules
 */
interface PointsRepository
{
    /**
     * Record a points transaction (idempotent)
     *
     * @param int $userId User receiving points
     * @param string $action Action identifier (e.g., 'registration', 'document_approved')
     * @param array $metadata Additional context (no PHI)
     * @param int $points Point value (can be negative for deductions)
     * @param string $idempotencyKey SHA-256 hash for duplicate prevention
     * @return string Transaction ID (UUID or database primary key)
     * @throws \Illuminate\Database\QueryException If idempotency key collision
     */
    public function recordTransaction(
        int $userId,
        string $action,
        array $metadata,
        int $points,
        string $idempotencyKey
    ): string;

    /**
     * Check if transaction exists (idempotency check)
     *
     * @param string $idempotencyKey SHA-256 hash
     * @return bool True if transaction already recorded
     */
    public function transactionExists(string $idempotencyKey): bool;

    /**
     * Get user's current points balance
     *
     * @param int $userId User ID
     * @return int Current balance (sum of all transactions)
     */
    public function getBalance(int $userId): int;

    /**
     * Increment user balance with optimistic locking
     *
     * Uses version field to prevent lost updates in concurrent scenarios.
     *
     * @param int $userId User ID
     * @param int $delta Points to add (negative for deduction)
     * @param int $expectedVersion Expected version for optimistic lock
     * @return array ['balance' => int, 'version' => int]
     * @throws \App\Exceptions\StaleVersionException If version mismatch (retry needed)
     */
    public function incrementBalance(int $userId, int $delta, int $expectedVersion): array;

    /**
     * Get transaction history for user
     *
     * @param int $userId User ID
     * @param int $limit Max results
     * @param int $offset Pagination offset
     * @return \Illuminate\Support\Collection<PointsTransaction>
     */
    public function getTransactionHistory(int $userId, int $limit = 50, int $offset = 0);

    /**
     * Get transactions by action type (for analytics)
     *
     * @param string $action Action identifier
     * @param \DateTimeInterface|null $since Filter by created_at >= since
     * @param int $limit Max results
     * @return \Illuminate\Support\Collection<PointsTransaction>
     */
    public function getTransactionsByAction(string $action, ?\DateTimeInterface $since = null, int $limit = 100);
}
