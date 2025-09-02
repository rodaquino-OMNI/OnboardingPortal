<?php

namespace App\Services;

use App\Models\User;
use App\Models\Company;
use App\Models\Beneficiary;
use App\Models\Document;
use App\Models\HealthQuestionnaire;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;

class TenantService
{
    /**
     * Get current tenant ID from authenticated user.
     */
    public function getCurrentTenantId(): ?int
    {
        return Auth::user()?->company_id;
    }

    /**
     * Get current tenant company.
     */
    public function getCurrentTenant(): ?Company
    {
        $tenantId = $this->getCurrentTenantId();
        return $tenantId ? Company::find($tenantId) : null;
    }

    /**
     * Check if current user belongs to a tenant.
     */
    public function hasCurrentTenant(): bool
    {
        return $this->getCurrentTenantId() !== null;
    }

    /**
     * Check if user is a super admin who can access cross-tenant data.
     */
    public function isSuperAdmin(?User $user = null): bool
    {
        $user = $user ?? Auth::user();
        return $user?->hasRole('super-admin') ?? false;
    }

    /**
     * Get tenant statistics for dashboard.
     */
    public function getTenantStatistics(?int $tenantId = null): array
    {
        $tenantId = $tenantId ?? $this->getCurrentTenantId();
        
        if (!$tenantId) {
            return [];
        }

        return [
            'users_count' => User::where('company_id', $tenantId)->count(),
            'beneficiaries_count' => Beneficiary::where('company_id', $tenantId)->count(),
            'documents_count' => Document::where('company_id', $tenantId)->count(),
            'questionnaires_count' => HealthQuestionnaire::where('company_id', $tenantId)->count(),
            'active_users' => User::where('company_id', $tenantId)->where('is_active', true)->count(),
            'completed_onboarding' => Beneficiary::where('company_id', $tenantId)
                ->where('onboarding_status', 'completed')->count(),
        ];
    }

    /**
     * Get tenant activity summary.
     */
    public function getTenantActivity(?int $tenantId = null, int $days = 30): array
    {
        $tenantId = $tenantId ?? $this->getCurrentTenantId();
        
        if (!$tenantId) {
            return [];
        }

        $startDate = now()->subDays($days);

        return [
            'new_beneficiaries' => Beneficiary::where('company_id', $tenantId)
                ->where('created_at', '>=', $startDate)->count(),
            'documents_uploaded' => Document::where('company_id', $tenantId)
                ->where('created_at', '>=', $startDate)->count(),
            'questionnaires_completed' => HealthQuestionnaire::where('company_id', $tenantId)
                ->whereNotNull('completed_at')
                ->where('completed_at', '>=', $startDate)->count(),
            'user_logins' => User::where('company_id', $tenantId)
                ->where('last_login_at', '>=', $startDate)->count(),
        ];
    }

    /**
     * Migrate user to different tenant (admin only).
     */
    public function migrateUserToTenant(User $user, int $newTenantId): bool
    {
        if (!$this->isSuperAdmin()) {
            throw new \Exception('Only super admins can migrate users between tenants');
        }

        if (!Company::find($newTenantId)) {
            throw new \Exception('Target company does not exist');
        }

        return DB::transaction(function () use ($user, $newTenantId) {
            $oldTenantId = $user->company_id;
            
            // Update user
            $user->update(['company_id' => $newTenantId]);
            
            // Update beneficiary if exists
            if ($user->beneficiary) {
                $user->beneficiary->update(['company_id' => $newTenantId]);
                
                // Update related records
                Document::where('beneficiary_id', $user->beneficiary->id)
                    ->update(['company_id' => $newTenantId]);
                
                HealthQuestionnaire::where('beneficiary_id', $user->beneficiary->id)
                    ->update(['company_id' => $newTenantId]);
                
                if (class_exists('App\Models\Interview')) {
                    \App\Models\Interview::where('beneficiary_id', $user->beneficiary->id)
                        ->update(['company_id' => $newTenantId]);
                }
                
                if (class_exists('App\Models\GamificationProgress')) {
                    \App\Models\GamificationProgress::where('beneficiary_id', $user->beneficiary->id)
                        ->update(['company_id' => $newTenantId]);
                }
            }
            
            // Log the migration
            \Log::info("User {$user->id} migrated from tenant {$oldTenantId} to {$newTenantId}");
            
            return true;
        });
    }

    /**
     * Get all users for current tenant.
     */
    public function getTenantUsers(?int $tenantId = null): Collection
    {
        $tenantId = $tenantId ?? $this->getCurrentTenantId();
        
        if (!$tenantId) {
            return collect([]);
        }

        return User::where('company_id', $tenantId)->get();
    }

    /**
     * Check if a model belongs to current tenant.
     */
    public function belongsToCurrentTenant($model): bool
    {
        $currentTenantId = $this->getCurrentTenantId();
        
        if (!$currentTenantId) {
            return false;
        }

        return isset($model->company_id) && $model->company_id === $currentTenantId;
    }

    /**
     * Validate tenant ownership of multiple models.
     */
    public function validateTenantOwnership(array $models): bool
    {
        foreach ($models as $model) {
            if (!$this->belongsToCurrentTenant($model)) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Get tenant-aware query for model.
     */
    public function getTenantQuery(string $modelClass, ?int $tenantId = null)
    {
        $tenantId = $tenantId ?? $this->getCurrentTenantId();
        
        $query = $modelClass::query();
        
        if ($tenantId && in_array('App\Traits\BelongsToTenant', class_uses($modelClass))) {
            $query->where('company_id', $tenantId);
        }
        
        return $query;
    }

    /**
     * Create model with automatic tenant assignment.
     */
    public function createTenantModel(string $modelClass, array $attributes): mixed
    {
        $tenantId = $this->getCurrentTenantId();
        
        if ($tenantId && in_array('App\Traits\BelongsToTenant', class_uses($modelClass))) {
            $attributes['company_id'] = $tenantId;
        }
        
        return $modelClass::create($attributes);
    }

    /**
     * Get tenant data export (admin only).
     */
    public function exportTenantData(int $tenantId): array
    {
        if (!$this->isSuperAdmin()) {
            throw new \Exception('Only super admins can export tenant data');
        }

        return [
            'company' => Company::find($tenantId),
            'users' => User::where('company_id', $tenantId)->get(),
            'beneficiaries' => Beneficiary::where('company_id', $tenantId)->get(),
            'documents' => Document::where('company_id', $tenantId)->get(['id', 'beneficiary_id', 'document_type', 'status', 'created_at']),
            'questionnaires' => HealthQuestionnaire::where('company_id', $tenantId)->get(['id', 'beneficiary_id', 'status', 'score', 'created_at']),
            'statistics' => $this->getTenantStatistics($tenantId),
            'activity' => $this->getTenantActivity($tenantId),
        ];
    }

    /**
     * Clean up orphaned tenant data (admin only).
     */
    public function cleanupOrphanedTenantData(): array
    {
        if (!$this->isSuperAdmin()) {
            throw new \Exception('Only super admins can cleanup tenant data');
        }

        $results = [];

        // Find users with invalid company_id
        $orphanedUsers = User::whereNotNull('company_id')
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('companies')
                    ->whereRaw('companies.id = users.company_id');
            })->count();

        // Find beneficiaries with invalid company_id
        $orphanedBeneficiaries = Beneficiary::whereNotNull('company_id')
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('companies')
                    ->whereRaw('companies.id = beneficiaries.company_id');
            })->count();

        $results['orphaned_users'] = $orphanedUsers;
        $results['orphaned_beneficiaries'] = $orphanedBeneficiaries;

        return $results;
    }
}