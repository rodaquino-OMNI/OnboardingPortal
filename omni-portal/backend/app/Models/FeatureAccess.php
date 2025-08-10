<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeatureAccess extends Model
{
    use HasFactory;

    protected $table = 'feature_access';

    protected $fillable = [
        'beneficiary_id',
        'feature_key',
        'enabled',
        'unlocked_at',
        'unlocked_by',
        'expires_at',
        'metadata',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'metadata' => 'array',
        'unlocked_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }

    public function isActive(): bool
    {
        return $this->enabled && 
               (!$this->expires_at || $this->expires_at->isFuture());
    }
}