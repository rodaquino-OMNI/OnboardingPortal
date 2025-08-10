<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DiscountCode extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'user_id',
        'reward_id',
        'discount_type',
        'discount_value',
        'applicable_to',
        'minimum_amount',
        'valid_from',
        'valid_until',
        'max_uses',
        'used_count',
        'last_used_at',
        'usage_details',
        'metadata',
    ];

    protected $casts = [
        'usage_details' => 'array',
        'metadata' => 'array',
        'valid_from' => 'datetime',
        'valid_until' => 'datetime',
        'last_used_at' => 'datetime',
        'discount_value' => 'decimal:2',
        'minimum_amount' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reward(): BelongsTo
    {
        return $this->belongsTo(Reward::class);
    }

    public function isValid(): bool
    {
        return $this->valid_from->isPast() &&
               $this->valid_until->isFuture() &&
               $this->used_count < $this->max_uses;
    }
}