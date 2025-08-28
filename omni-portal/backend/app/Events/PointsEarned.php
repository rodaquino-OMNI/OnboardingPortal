<?php

namespace App\Events;

use App\Models\Beneficiary;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PointsEarned implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $beneficiary;
    public $points;
    public $reason;

    /**
     * Create a new event instance.
     */
    public function __construct(Beneficiary $beneficiary, int $points, string $reason)
    {
        $this->beneficiary = $beneficiary;
        $this->points = $points;
        $this->reason = $reason;
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
            'points' => $this->points,
            'reason' => $this->reason,
            'total_points' => $this->beneficiary->total_points ?? 0,
            'timestamp' => now()->toISOString()
        ];
    }
}