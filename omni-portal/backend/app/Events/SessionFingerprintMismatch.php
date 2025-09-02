<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Http\Request;
use Illuminate\Queue\SerializesModels;

/**
 * Session Fingerprint Mismatch Event
 * 
 * Fired when a session fingerprint validation fails, allowing
 * other parts of the application to react to potential security threats.
 */
class SessionFingerprintMismatch
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * Create a new event instance.
     */
    public function __construct(
        public readonly string $userId,
        public readonly string $ipAddress,
        public readonly string $userAgent,
        public readonly string $reason,
        public readonly int $mismatchCount,
        public readonly array $fingerprintData,
        public readonly string $requestPath,
        public readonly array $additionalContext = []
    ) {}

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        return [];
    }

    /**
     * Get event data for logging
     */
    public function toArray(): array
    {
        return [
            'user_id' => $this->userId,
            'ip_address' => $this->ipAddress,
            'user_agent' => substr($this->userAgent, 0, 255),
            'reason' => $this->reason,
            'mismatch_count' => $this->mismatchCount,
            'fingerprint_data' => $this->fingerprintData,
            'request_path' => $this->requestPath,
            'additional_context' => $this->additionalContext,
            'timestamp' => now()->toISOString(),
        ];
    }
}