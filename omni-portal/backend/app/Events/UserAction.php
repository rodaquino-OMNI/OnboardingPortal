<?php

namespace App\Events;

use App\Models\Beneficiary;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class UserAction implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Beneficiary $beneficiary;
    public string $action;
    public array $metadata;
    public string $timestamp;

    /**
     * Create a new event instance.
     */
    public function __construct(Beneficiary $beneficiary, string $action, array $metadata = [])
    {
        $this->beneficiary = $beneficiary;
        $this->action = $action;
        $this->metadata = $metadata;
        $this->timestamp = now()->toIso8601String();
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('beneficiary.' . $this->beneficiary->id),
            new PrivateChannel('company.' . $this->beneficiary->company_id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'user.action';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'beneficiary_id' => $this->beneficiary->id,
            'action' => $this->action,
            'metadata' => $this->metadata,
            'timestamp' => $this->timestamp,
        ];
    }
}