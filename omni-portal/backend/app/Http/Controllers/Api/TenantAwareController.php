<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Base controller with tenant-aware methods for secure multi-tenant operations.
 */
abstract class TenantAwareController extends Controller
{
    /**
     * Get the current tenant ID from authenticated user.
     */
    protected function getCurrentTenantId(): ?int
    {
        return Auth::user()?->company_id;
    }

    /**
     * Check if the current user belongs to a tenant.
     */
    protected function hasTenantAccess(): bool
    {
        return $this->getCurrentTenantId() !== null;
    }

    /**
     * Ensure the current user has tenant access.
     */
    protected function ensureTenantAccess(): void
    {
        if (!$this->hasTenantAccess()) {
            abort(403, 'Tenant access required');
        }
    }

    /**
     * Apply tenant scope to a query builder.
     */
    protected function applyTenantScope($query, ?int $tenantId = null)
    {
        $tenantId = $tenantId ?? $this->getCurrentTenantId();
        
        if ($tenantId) {
            return $query->where('company_id', $tenantId);
        }
        
        return $query;
    }

    /**
     * Create a model instance with automatic tenant assignment.
     */
    protected function createTenantModel(string $modelClass, array $attributes = [])
    {
        $tenantId = $this->getCurrentTenantId();
        
        if ($tenantId) {
            $attributes['company_id'] = $tenantId;
        }
        
        return $modelClass::create($attributes);
    }

    /**
     * Validate that request data doesn't contain cross-tenant references.
     */
    protected function validateTenantData(Request $request, array $tenantFields = ['company_id']): void
    {
        $tenantId = $this->getCurrentTenantId();
        
        if (!$tenantId) {
            return; // Skip validation if no tenant
        }
        
        foreach ($tenantFields as $field) {
            if ($request->has($field) && $request->input($field) !== $tenantId) {
                abort(403, "Invalid {$field}: Cross-tenant access denied");
            }
        }
    }

    /**
     * Get paginated results with tenant filtering.
     */
    protected function getTenantPaginatedResults($query, Request $request, int $perPage = 15)
    {
        $query = $this->applyTenantScope($query);
        
        return $query->paginate(
            $perPage,
            ['*'],
            'page',
            $request->get('page', 1)
        );
    }

    /**
     * Validate model belongs to current tenant.
     */
    protected function validateTenantOwnership($model): void
    {
        $tenantId = $this->getCurrentTenantId();
        
        if (!$tenantId) {
            return; // Skip if no tenant
        }
        
        if (isset($model->company_id) && $model->company_id !== $tenantId) {
            abort(403, 'Resource belongs to different tenant');
        }
    }

    /**
     * Get tenant-scoped count.
     */
    protected function getTenantCount($query): int
    {
        return $this->applyTenantScope($query)->count();
    }

    /**
     * Check if user can manage cross-tenant resources (super admin).
     */
    protected function canManageCrossTenant(): bool
    {
        return Auth::user()?->hasRole('super-admin') ?? false;
    }

    /**
     * Apply tenant scope only if user is not a super admin.
     */
    protected function applyTenantScopeConditional($query)
    {
        if ($this->canManageCrossTenant()) {
            return $query; // Super admins see all
        }
        
        return $this->applyTenantScope($query);
    }
}