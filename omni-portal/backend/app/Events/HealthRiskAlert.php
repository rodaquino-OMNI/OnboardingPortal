<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class HealthRiskAlert implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $alertData;
    public string $alertId;
    public string $alertType;
    public string $category;
    public string $priority;

    /**
     * Create a new event instance.
     */
    public function __construct(array $alertData)
    {
        $this->alertData = $alertData;
        $this->alertId = $alertData['id'] ?? uniqid('alert_');
        $this->alertType = $alertData['type'] ?? 'info';
        $this->category = $alertData['category'] ?? 'health';
        $this->priority = $alertData['priority'] ?? 'medium';

        Log::info('HealthRiskAlert created', [
            'alert_id' => $this->alertId,
            'type' => $this->alertType,
            'category' => $this->category,
            'priority' => $this->priority
        ]);
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('admin.alerts'),
            new PrivateChannel('health.alerts'),
            new Channel('public.alerts'), // For demo purposes
        ];
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'alert' => $this->alertData,
            'timestamp' => now()->toISOString(),
            'server_time' => time(),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'health.risk.alert';
    }
}