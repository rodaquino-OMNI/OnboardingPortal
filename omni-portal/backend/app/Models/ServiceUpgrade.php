<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServiceUpgrade extends Model
{
    use HasFactory;

    protected $fillable = [
        'beneficiary_id',
        'reward_id',
        'service_type',
        'upgrade_type',
        'features',
        'activated_at',
        'expires_at',
        'status',
        'metadata',
    ];

    protected $casts = [
        'features' => 'array',
        'metadata' => 'array',
        'activated_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }

    public function reward(): BelongsTo
    {
        return $this->belongsTo(Reward::class);
    }

    public function isActive(): bool
    {
        return $this->status === 'active' && 
               (!$this->expires_at || $this->expires_at->isFuture());
    }
}