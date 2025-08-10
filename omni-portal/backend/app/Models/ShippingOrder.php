<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShippingOrder extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'beneficiary_id',
        'reward_id',
        'item_name',
        'item_description',
        'shipping_address',
        'status',
        'tracking_number',
        'carrier',
        'shipped_at',
        'delivered_at',
        'estimated_delivery',
        'shipping_updates',
        'metadata',
    ];

    protected $casts = [
        'shipping_address' => 'array',
        'shipping_updates' => 'array',
        'metadata' => 'array',
        'shipped_at' => 'datetime',
        'delivered_at' => 'datetime',
        'estimated_delivery' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }

    public function reward(): BelongsTo
    {
        return $this->belongsTo(Reward::class);
    }
}