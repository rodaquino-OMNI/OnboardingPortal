<?php

namespace App\Modules\Gamification\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * PointsEarnedEvent - Emitted when user earns points
 *
 * Dispatched by PointsEngine after successful idempotent point award.
 * Listeners should be idempotent (handle duplicate events gracefully).
 *
 * Use cases:
 * - Analytics event emission (track user engagement)
 * - Push notifications (celebrate milestones)
 * - Derived stats updates (leaderboards, aggregates)
 *
 * @see App\Modules\Gamification\Listeners\EmitAnalyticsEvents
 * @see App\Modules\Gamification\Listeners\UpdateDerivedStats
 * @see docs/ANALYTICS_SPEC.md - Event taxonomy
 */
final class PointsEarnedEvent
{
    use Dispatchable, SerializesModels;

    /**
     * Create a new event instance
     *
     * @param int $userId User who earned points
     * @param int $delta Points awarded (always positive in this event)
     * @param string $action Action identifier (e.g., 'registration', 'document_approved')
     * @param array $metadata Additional context (no PHI)
     * @param string $idempotencyKey SHA-256 hash for deduplication in listeners
     * @param \DateTimeImmutable $occurredAt When the points were awarded (UTC)
     */
    public function __construct(
        public readonly int $userId,
        public readonly int $delta,
        public readonly string $action,
        public readonly array $metadata,
        public readonly string $idempotencyKey,
        public readonly \DateTimeImmutable $occurredAt
    ) {}

    /**
     * Get event payload for analytics (no PHI)
     *
     * @return array Sanitized event data
     */
    public function toAnalyticsPayload(): array
    {
        return [
            'event' => 'points_earned',
            'user_id' => $this->userId,
            'points_delta' => $this->delta,
            'action' => $this->action,
            'metadata' => $this->sanitizeMetadata($this->metadata),
            'idempotency_key' => $this->idempotencyKey,
            'occurred_at' => $this->occurredAt->format('c'), // ISO 8601
        ];
    }

    /**
     * Sanitize metadata (remove any PHI if present)
     *
     * @param array $metadata Raw metadata
     * @return array Sanitized metadata
     */
    private function sanitizeMetadata(array $metadata): array
    {
        // Remove known PHI fields (defensive - should never be in metadata)
        $piiFields = ['email', 'cpf', 'rg', 'phone', 'address', 'name'];

        return collect($metadata)
            ->except($piiFields)
            ->toArray();
    }
}
