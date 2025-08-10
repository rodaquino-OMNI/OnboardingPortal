<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class UserReward extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'reward_id',
        'status',
        'unlocked_at',
        'claimed_at',
        'delivered_at',
        'expires_at',
        'delivery_details',
        'usage_data',
        'redemption_code',
        'notes',
    ];

    protected $casts = [
        'unlocked_at' => 'datetime',
        'claimed_at' => 'datetime',
        'delivered_at' => 'datetime',
        'expires_at' => 'datetime',
        'delivery_details' => 'array',
        'usage_data' => 'array',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (!$model->redemption_code) {
                $model->redemption_code = static::generateRedemptionCode();
            }
        });
    }

    /**
     * Generate unique redemption code
     */
    public static function generateRedemptionCode(): string
    {
        do {
            $code = strtoupper(Str::random(4) . '-' . Str::random(4) . '-' . Str::random(4));
        } while (static::where('redemption_code', $code)->exists());

        return $code;
    }

    /**
     * User relationship
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Reward relationship
     */
    public function reward(): BelongsTo
    {
        return $this->belongsTo(Reward::class);
    }

    /**
     * Mark as claimed
     */
    public function markAsClaimed(): void
    {
        $this->update([
            'status' => 'claimed',
            'claimed_at' => now(),
        ]);

        // Update reward claimed count
        $this->reward->increment('quantity_claimed');

        // Log transaction
        RewardTransaction::create([
            'user_id' => $this->user_id,
            'reward_id' => $this->reward_id,
            'action' => 'claim',
            'points_at_time' => $this->user->beneficiary->gamification_points ?? 0,
            'metadata' => [
                'redemption_code' => $this->redemption_code,
            ],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);
    }

    /**
     * Mark as delivered
     */
    public function markAsDelivered(array $deliveryDetails = []): void
    {
        $this->update([
            'status' => 'delivered',
            'delivered_at' => now(),
            'delivery_details' => array_merge($this->delivery_details ?? [], $deliveryDetails),
        ]);

        // Log transaction
        RewardTransaction::create([
            'user_id' => $this->user_id,
            'reward_id' => $this->reward_id,
            'action' => 'deliver',
            'points_at_time' => $this->user->beneficiary->gamification_points ?? 0,
            'metadata' => $deliveryDetails,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);
    }

    /**
     * Check if reward is expired
     */
    public function isExpired(): bool
    {
        return $this->expires_at && now()->gt($this->expires_at);
    }

    /**
     * Check if reward can be redeemed
     */
    public function canBeRedeemed(): bool
    {
        return $this->status === 'claimed' && !$this->isExpired();
    }
}