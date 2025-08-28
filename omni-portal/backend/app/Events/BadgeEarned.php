<?php

namespace App\Events;

use App\Models\Beneficiary;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class BadgeEarned implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $beneficiary;
    public $badge;

    /**
     * Create a new event instance.
     */
    public function __construct(Beneficiary $beneficiary, string $badge)
    {
        $this->beneficiary = $beneficiary;
        $this->badge = $badge;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        return [
            new Channel('user.' . $this->beneficiary->user_id)
        ];
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'badge' => $this->badge,
            'earned_at' => now()->toISOString(),
            'message' => 'Congratulations! You earned a new badge: ' . $this->badge
        ];
    }
}