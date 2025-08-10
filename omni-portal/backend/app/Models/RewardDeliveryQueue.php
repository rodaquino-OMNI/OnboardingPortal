<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RewardDeliveryQueue extends Model
{
    use HasFactory;

    protected $table = 'reward_delivery_queue';

    protected $fillable = [
        'user_reward_id',
        'status',
        'attempts',
        'delivery_payload',
        'error_message',
        'scheduled_at',
        'processed_at',
    ];

    protected $casts = [
        'delivery_payload' => 'array',
        'scheduled_at' => 'datetime',
        'processed_at' => 'datetime',
    ];

    public function userReward(): BelongsTo
    {
        return $this->belongsTo(UserReward::class);
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function canRetry(): bool
    {
        return $this->attempts < 5 && $this->status === 'failed';
    }
}