<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BeneficiaryBadge extends Model
{
    use HasFactory;

    protected $table = 'beneficiary_badges';

    protected $fillable = [
        'beneficiary_id',
        'gamification_badge_id',
        'earned_at',
        'earned_count',
        'earned_context',
        'is_featured',
        'earned_by',
        'metadata',
    ];

    protected $casts = [
        'earned_at' => 'datetime',
        'earned_context' => 'array',
        'metadata' => 'array',
        'is_featured' => 'boolean',
    ];

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }

    public function gamificationBadge(): BelongsTo
    {
        return $this->belongsTo(GamificationBadge::class);
    }

    public function badge(): BelongsTo
    {
        return $this->belongsTo(GamificationBadge::class, 'gamification_badge_id');
    }
}