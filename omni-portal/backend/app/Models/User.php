<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
use App\Traits\BelongsToTenant;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles, BelongsToTenant;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'cpf',
        'password',
        'phone',
        'department',
        'job_title',
        'employee_id',
        'start_date',
        'status',
        'registration_step',
        'lgpd_consent',
        'lgpd_consent_explicit',
        'lgpd_consent_at',
        'lgpd_consent_ip',
        'role',
        'preferred_language',
        'preferences',
        'google_id',
        'facebook_id',
        'instagram_id',
        'avatar_url',
        'social_provider',
        'social_login',
        'is_active',
        'email_verified_at',
        'last_login_at',
        'last_login_ip',
        'failed_login_attempts',
        'locked_until',
        'company_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'start_date' => 'date',
        'lgpd_consent' => 'boolean',
        'lgpd_consent_explicit' => 'boolean',
        'lgpd_consent_at' => 'datetime',
        'last_login_at' => 'datetime',
        'locked_until' => 'datetime',
        'preferences' => 'array',
        'is_active' => 'boolean',
        'social_login' => 'boolean',
    ];

    /**
     * Check if user account is locked
     */
    public function isLocked(): bool
    {
        return $this->locked_until && $this->locked_until->isFuture();
    }

    /**
     * Lock user account for specified minutes
     */
    public function lockAccount(int $minutes = 30): void
    {
        $this->update([
            'locked_until' => now()->addMinutes($minutes)
        ]);
    }

    /**
     * Reset failed login attempts
     */
    public function resetFailedLoginAttempts(): void
    {
        $this->update([
            'failed_login_attempts' => 0,
            'locked_until' => null
        ]);
    }

    /**
     * Increment failed login attempts
     */
    public function incrementFailedLoginAttempts(): void
    {
        $this->increment('failed_login_attempts');
        
        // Lock account after 5 failed attempts
        if ($this->failed_login_attempts >= 5) {
            $this->lockAccount(30);
        }
    }

    /**
     * Record successful login
     */
    public function recordSuccessfulLogin(string $ip): void
    {
        $this->update([
            'last_login_at' => now(),
            'last_login_ip' => $ip,
            'failed_login_attempts' => 0,
            'locked_until' => null
        ]);
    }

    /**
     * Check if registration is completed
     */
    public function isRegistrationCompleted(): bool
    {
        return $this->registration_step === 'completed';
    }

    /**
     * Format CPF for display
     */
    public function getFormattedCpfAttribute(): ?string
    {
        if (!$this->cpf) {
            return null;
        }
        
        return preg_replace('/(\d{3})(\d{3})(\d{3})(\d{2})/', '$1.$2.$3-$4', $this->cpf);
    }

    /**
     * Get the company associated with the user.
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Get beneficiary relationship
     */
    public function beneficiary(): HasOne
    {
        return $this->hasOne(Beneficiary::class);
    }

    /**
     * Get gamification progress through beneficiary
     */
    public function gamificationProgress(): HasOneThrough
    {
        return $this->hasOneThrough(
            GamificationProgress::class,
            Beneficiary::class,
            'user_id',          // Foreign key on the beneficiaries table
            'beneficiary_id',   // Foreign key on the gamification_progress table
            'id',               // Local key on the users table
            'id'                // Local key on the beneficiaries table
        )->select([
            'gamification_progress.id',
            'gamification_progress.beneficiary_id',
            'gamification_progress.total_points',
            'gamification_progress.current_level',
            'gamification_progress.badges_earned'
        ]);
    }

    /**
     * Safe fallback for adminRoles relationship
     * Returns empty collection if table doesn't exist
     * This prevents crashes while maintaining backward compatibility
     */
    public function adminRoles()
    {
        // Check if custom admin system tables exist
        if (!\Schema::hasTable('admin_user_roles')) {
            // Return empty relationship to prevent errors
            // This allows code to call $user->adminRoles without crashing
            return $this->belongsToMany(
                \App\Models\Admin\AdminRole::class, 
                'non_existent_table_safe_fallback'
            )->whereRaw('1 = 0'); // Always returns empty collection
        }
        
        // Actual relationship when table exists
        return $this->belongsToMany(
            \App\Models\Admin\AdminRole::class,
            'admin_user_roles',
            'user_id',
            'admin_role_id'
        )
        ->withPivot(['assigned_at', 'expires_at', 'is_active'])
        ->wherePivot('is_active', true)
        ->where(function ($query) {
            $query->whereNull('admin_user_roles.expires_at')
                  ->orWhere('admin_user_roles.expires_at', '>', now());
        });
    }

    /**
     * Check if user has admin access using unified role system
     * This consolidates database enum, Spatie roles, and custom admin roles
     */
    public function hasAdminAccess(): bool
    {
        return $this->hasUnifiedRole(['admin', 'super-admin', 'manager', 'hr', 'moderator', 'super_admin', 'company_admin']);
    }

    /**
     * Unified role checking that considers database enum, Spatie roles, and custom admin roles
     */
    public function hasUnifiedRole($roles): bool
    {
        $roles = is_array($roles) ? $roles : [$roles];
        
        // Check database enum role
        if ($this->role && in_array($this->role, $roles)) {
            return true;
        }
        
        // Check mapped roles based on database enum
        if ($this->role) {
            $mappedRoles = $this->getMappedSpatieRoles($this->role);
            if (array_intersect($mappedRoles, $roles)) {
                return true;
            }
        }
        
        // Check Spatie roles
        try {
            if ($this->hasRole($roles)) {
                return true;
            }
        } catch (\Exception $e) {
            // Silently continue if Spatie roles not available
        }
        
        // Check custom admin roles if available
        if (\Schema::hasTable('admin_user_roles')) {
            try {
                $adminRoles = $this->adminRoles->pluck('name')->toArray();
                if (array_intersect($adminRoles, $roles)) {
                    return true;
                }
            } catch (\Exception $e) {
                // Silently continue if admin roles not available
            }
        }
        
        return false;
    }

    /**
     * Get mapped Spatie roles for a database enum role
     */
    public function getMappedSpatieRoles(string $databaseRole): array
    {
        $mapping = [
            'super_admin' => ['super-admin', 'admin', 'manager'],
            'company_admin' => ['admin', 'manager', 'hr'],
            'beneficiary' => []
        ];
        
        return $mapping[$databaseRole] ?? [];
    }

    /**
     * Get user's hierarchy level based on all role systems
     */
    public function getUnifiedHierarchyLevel(): int
    {
        $hierarchy = [
            // Database enum roles
            'super_admin' => 100,
            'company_admin' => 50,
            'beneficiary' => 10,
            
            // Spatie roles
            'super-admin' => 100,
            'admin' => 90,
            'manager' => 70,
            'hr' => 60,
            'moderator' => 40,
        ];

        $maxLevel = 0;
        
        // Check database enum role
        if ($this->role) {
            $maxLevel = max($maxLevel, $hierarchy[$this->role] ?? 0);
        }
        
        // Check Spatie roles
        try {
            if ($this->roles) {
                foreach ($this->roles as $role) {
                    $level = $hierarchy[$role->name] ?? 0;
                    $maxLevel = max($maxLevel, $level);
                }
            }
        } catch (\Exception $e) {
            // Continue silently
        }
        
        // Check custom admin roles
        if (\Schema::hasTable('admin_user_roles')) {
            try {
                foreach ($this->adminRoles as $role) {
                    $level = $role->hierarchy_level ?? 0;
                    $maxLevel = max($maxLevel, $level);
                }
            } catch (\Exception $e) {
                // Continue silently
            }
        }
        
        return $maxLevel;
    }

    /**
     * Get combined roles from both systems
     * Merges Spatie and custom admin roles for compatibility
     */
    public function getAllRoles(): array
    {
        $roles = [];
        
        // Get Spatie roles (current system)
        if ($this->roles) {
            $roles = array_merge($roles, $this->roles->pluck('name')->toArray());
        }
        
        // Get custom admin roles if available
        if (\Schema::hasTable('admin_user_roles')) {
            try {
                $adminRoles = $this->adminRoles;
                if ($adminRoles && count($adminRoles) > 0) {
                    $roles = array_merge($roles, $adminRoles->pluck('name')->toArray());
                }
            } catch (\Exception $e) {
                // Silently fail if admin roles can't be loaded
                // This ensures backward compatibility
            }
        }
        
        return array_unique($roles);
    }

    /**
     * Check if user has specific admin permission
     * Checks both Spatie and custom admin systems
     */
    public function hasAdminPermission(string $resource, string $action, string $scope = 'all'): bool
    {
        // First check Spatie permissions
        $spatiePermission = "{$resource}.{$action}";
        if ($this->hasPermissionTo($spatiePermission)) {
            return true;
        }
        
        // Then check custom admin permissions if available
        if (\Schema::hasTable('admin_user_roles')) {
            try {
                foreach ($this->adminRoles as $role) {
                    if ($role->hasPermission($resource, $action, $scope)) {
                        return true;
                    }
                }
            } catch (\Exception $e) {
                // Silently fail to maintain compatibility
            }
        }
        
        return false;
    }
}