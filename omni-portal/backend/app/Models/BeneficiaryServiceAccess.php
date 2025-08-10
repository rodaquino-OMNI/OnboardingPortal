<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BeneficiaryServiceAccess extends Model
{
    use HasFactory;

    protected $table = 'beneficiary_service_access';

    protected $fillable = [
        'beneficiary_id',
        'service_type',
        'access_level',
        'features',
        'granted_at',
        'expires_at',
        'source',
        'source_reference',
    ];

    protected $casts = [
        'features' => 'array',
        'granted_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }
}