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

class SystemAlert implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $alertData;
    public string $alertId;
    public string $category;
    public string $priority;

    /**
     * Create a new event instance.
     */
    public function __construct(array $alertData)
    {
        $this->alertData = $alertData;
        $this->alertId = $alertData['id'] ?? uniqid('sys_alert_');
        $this->category = $alertData['category'] ?? 'system';
        $this->priority = $alertData['priority'] ?? 'medium';

        Log::info('SystemAlert created', [
            'alert_id' => $this->alertId,
            'category' => $this->category,
            'priority' => $this->priority
        ]);
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel('admin.system'),
            new Channel('public.system'), // For demo purposes
        ];

        // Add category-specific channels
        switch ($this->category) {
            case 'security':
                $channels[] = new PrivateChannel('admin.security');
                break;
            case 'performance':
                $channels[] = new PrivateChannel('admin.performance');
                break;
            case 'compliance':
                $channels[] = new PrivateChannel('admin.compliance');
                break;
        }

        return $channels;
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
        return 'system.alert';
    }
}