<?php

namespace App\Traits;

use App\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Auth;

trait BelongsToTenant
{
    /**
     * Boot the tenant trait.
     */
    protected static function bootBelongsToTenant(): void
    {
        // Apply global scope for tenant isolation
        static::addGlobalScope(new TenantScope);

        // Automatically set company_id when creating
        static::creating(function ($model) {
            if (Auth::check() && Auth::user()->company_id && !$model->company_id) {
                $model->company_id = Auth::user()->company_id;
            }
        });

        // Validate tenant ownership when updating
        static::updating(function ($model) {
            if (Auth::check() && Auth::user()->company_id) {
                // Prevent changing company_id to a different tenant
                if ($model->isDirty('company_id') && $model->company_id !== Auth::user()->company_id) {
                    throw new \Exception('Cannot change tenant ownership');
                }
            }
        });
    }

    /**
     * Get the company/tenant relationship.
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Company::class);
    }

    /**
     * Get the tenant ID for this model.
     */
    public function getTenantId(): ?int
    {
        return $this->company_id;
    }

    /**
     * Set the tenant ID for this model.
     */
    public function setTenantId(?int $tenantId): self
    {
        $this->company_id = $tenantId;
        return $this;
    }

    /**
     * Check if the model belongs to the current tenant.
     */
    public function belongsToCurrentTenant(): bool
    {
        if (!Auth::check() || !Auth::user()->company_id) {
            return false;
        }

        return $this->company_id === Auth::user()->company_id;
    }

    /**
     * Scope to filter by tenant.
     */
    public function scopeForTenant($query, $tenantId)
    {
        return $query->where('company_id', $tenantId);
    }

    /**
     * Scope to get records for the current tenant.
     */
    public function scopeForCurrentTenant($query)
    {
        if (Auth::check() && Auth::user()->company_id) {
            return $query->where('company_id', Auth::user()->company_id);
        }

        return $query;
    }
}