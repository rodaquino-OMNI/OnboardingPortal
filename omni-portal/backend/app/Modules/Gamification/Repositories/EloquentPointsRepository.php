<?php

namespace App\Modules\Gamification\Repositories;

use App\Modules\Gamification\Models\PointsTransaction;
use App\Exceptions\StaleVersionException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * EloquentPointsRepository - Eloquent implementation of PointsRepository
 *
 * Provides idempotent, concurrency-safe points transaction management.
 *
 * Key features:
 * - Unique constraint on idempotency_key prevents duplicates
 * - Optimistic locking via version field (future enhancement)
 * - Indexed queries for performance (user_id, action, created_at)
 *
 * @see PointsRepository - Interface contract
 */
class EloquentPointsRepository implements PointsRepository
{
    /**
     * Record a points transaction (idempotent)
     *
     * @throws \Illuminate\Database\QueryException If duplicate idempotency_key
     */
    public function recordTransaction(
        int $userId,
        string $action,
        array $metadata,
        int $points,
        string $idempotencyKey
    ): string {
        $transaction = PointsTransaction::create([
            'user_id' => $userId,
            'action' => $action,
            'metadata' => $metadata,
            'points' => $points,
            'idempotency_key' => $idempotencyKey,
            'source' => 'system',
            'processed_at' => now(),
        ]);

        return (string) $transaction->id;
    }

    /**
     * Check if transaction exists (idempotency check)
     */
    public function transactionExists(string $idempotencyKey): bool
    {
        return PointsTransaction::where('idempotency_key', $idempotencyKey)->exists();
    }

    /**
     * Get user's current points balance
     *
     * Note: We maintain a denormalized balance in users.points_balance
     * This method calculates from transactions (useful for reconciliation)
     */
    public function getBalance(int $userId): int
    {
        return PointsTransaction::where('user_id', $userId)
            ->sum('points');
    }

    /**
     * Increment user balance with optimistic locking
     *
     * Current implementation uses database-level locking.
     * Future: Add version field to users table for optimistic locking.
     *
     * @throws StaleVersionException If version mismatch (not yet implemented)
     */
    public function incrementBalance(int $userId, int $delta, int $expectedVersion): array
    {
        // Note: Optimistic locking with version field is a future enhancement
        // For now, we rely on database row-level locking within transactions

        $user = DB::table('users')
            ->where('id', $userId)
            ->lockForUpdate()
            ->first();

        if (!$user) {
            throw new \RuntimeException("User {$userId} not found");
        }

        $newBalance = $user->points_balance + $delta;

        DB::table('users')
            ->where('id', $userId)
            ->update(['points_balance' => $newBalance]);

        return [
            'balance' => $newBalance,
            'version' => 1, // Placeholder until version field added
        ];
    }

    /**
     * Get transaction history for user
     */
    public function getTransactionHistory(int $userId, int $limit = 50, int $offset = 0): Collection
    {
        return PointsTransaction::where('user_id', $userId)
            ->orderBy('processed_at', 'desc')
            ->limit($limit)
            ->offset($offset)
            ->get();
    }

    /**
     * Get transactions by action type (for analytics)
     */
    public function getTransactionsByAction(
        string $action,
        ?\DateTimeInterface $since = null,
        int $limit = 100
    ): Collection {
        $query = PointsTransaction::where('action', $action);

        if ($since) {
            $query->where('processed_at', '>=', $since);
        }

        return $query->orderBy('processed_at', 'desc')
            ->limit($limit)
            ->get();
    }
}
