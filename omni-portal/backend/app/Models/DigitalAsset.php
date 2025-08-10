<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\URL;

class DigitalAsset extends Model
{
    use HasFactory;

    protected $fillable = [
        'beneficiary_id',
        'reward_id',
        'asset_type',
        'asset_name',
        'asset_path',
        'access_url',
        'download_token',
        'download_count',
        'last_accessed_at',
        'expires_at',
        'regenerated_at',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
        'last_accessed_at' => 'datetime',
        'expires_at' => 'datetime',
        'regenerated_at' => 'datetime',
    ];

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }

    public function reward(): BelongsTo
    {
        return $this->belongsTo(Reward::class);
    }

    public function getDownloadUrl(): string
    {
        return route('api.rewards.download', ['token' => $this->download_token]);
    }

    public function getSignedDownloadUrl(): string
    {
        return URL::temporarySignedRoute(
            'api.rewards.download',
            now()->addHours(24),
            ['token' => $this->download_token]
        );
    }

    public function getPreviewUrl(): string
    {
        return route('api.rewards.preview', ['token' => $this->download_token]);
    }
}