<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Reward extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'description',
        'benefits',
        'points_required',
        'type',
        'delivery_config',
        'icon',
        'color_scheme',
        'is_premium',
        'is_active',
        'is_limited',
        'quantity_available',
        'quantity_claimed',
        'valid_from',
        'valid_until',
        'sort_order',
    ];

    protected $casts = [
        'benefits' => 'array',
        'delivery_config' => 'array',
        'is_premium' => 'boolean',
        'is_active' => 'boolean',
        'is_limited' => 'boolean',
        'valid_from' => 'date',
        'valid_until' => 'date',
    ];

    /**
     * Users who have this reward
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_rewards')
            ->withPivot([
                'status',
                'unlocked_at',
                'claimed_at',
                'delivered_at',
                'expires_at',
                'delivery_details',
                'usage_data',
                'redemption_code',
                'notes'
            ])
            ->withTimestamps();
    }

    /**
     * User rewards
     */
    public function userRewards(): HasMany
    {
        return $this->hasMany(UserReward::class);
    }

    /**
     * Transactions for this reward
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(RewardTransaction::class);
    }

    /**
     * Check if reward is available for claiming
     */
    public function isAvailable(): bool
    {
        // Check if active
        if (!$this->is_active) {
            return false;
        }

        // Check validity dates
        if ($this->valid_from && now()->lt($this->valid_from)) {
            return false;
        }

        if ($this->valid_until && now()->gt($this->valid_until)) {
            return false;
        }

        // Check quantity limits
        if ($this->is_limited && $this->quantity_claimed >= $this->quantity_available) {
            return false;
        }

        return true;
    }

    /**
     * Check if user can claim this reward
     */
    public function canBeClaimed(User $user): bool
    {
        // Check if reward is available
        if (!$this->isAvailable()) {
            return false;
        }

        // Check if user has enough points
        $beneficiary = $user->beneficiary;
        if (!$beneficiary || $beneficiary->gamification_points < $this->points_required) {
            return false;
        }

        // Check if user already has this reward
        $existingReward = UserReward::where('user_id', $user->id)
            ->where('reward_id', $this->id)
            ->whereIn('status', ['claimed', 'delivered'])
            ->first();

        if ($existingReward) {
            return false;
        }

        return true;
    }

    /**
     * Get delivery handler class
     */
    public function getDeliveryHandler(): ?string
    {
        $handlers = [
            'badge' => \App\Services\Rewards\BadgeDeliveryHandler::class,
            'discount' => \App\Services\Rewards\DiscountDeliveryHandler::class,
            'service_upgrade' => \App\Services\Rewards\ServiceUpgradeDeliveryHandler::class,
            'physical_item' => \App\Services\Rewards\PhysicalItemDeliveryHandler::class,
            'digital_item' => \App\Services\Rewards\DigitalItemDeliveryHandler::class,
            'feature_unlock' => \App\Services\Rewards\FeatureUnlockDeliveryHandler::class,
            'priority_access' => \App\Services\Rewards\PriorityAccessDeliveryHandler::class,
        ];

        return $handlers[$this->type] ?? null;
    }
}