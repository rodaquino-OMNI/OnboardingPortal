<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PriorityAccess extends Model
{
    use HasFactory;

    protected $table = 'priority_access';

    protected $fillable = [
        'beneficiary_id',
        'reward_id',
        'access_type',
        'priority_level',
        'services',
        'granted_at',
        'expires_at',
        'is_active',
        'usage_log',
        'metadata',
    ];

    protected $casts = [
        'services' => 'array',
        'usage_log' => 'array',
        'metadata' => 'array',
        'is_active' => 'boolean',
        'granted_at' => 'datetime',
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

    public function isValid(): bool
    {
        return $this->is_active && 
               (!$this->expires_at || $this->expires_at->isFuture());
    }
}