<?php

namespace App\Models\Admin;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Casts\Attribute;
use App\Models\User;

/**
 * Admin Role Model - Hierarchical admin roles with granular permissions
 * 
 * @property int $id
 * @property string $name
 * @property string $display_name
 * @property string $description
 * @property int $hierarchy_level
 * @property bool $is_system_role
 * @property array $permissions
 * @property array $metadata
 */
class AdminRole extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'display_name',
        'description',
        'hierarchy_level',
        'is_system_role',
        'permissions',
        'metadata',
    ];

    protected $casts = [
        'permissions' => 'array',
        'metadata' => 'array',
        'is_system_role' => 'boolean',
        'hierarchy_level' => 'integer',
    ];

    protected $attributes = [
        'hierarchy_level' => 0,
        'is_system_role' => false,
    ];

    /**
     * Boot the model
     */
    protected static function boot()
    {
        parent::boot();
        
        // Prevent deletion of system roles
        static::deleting(function ($role) {
            if ($role->is_system_role) {
                throw new \Exception('System roles cannot be deleted');
            }
        });
    }

    /**
     * Get the permissions assigned to this role
     */
    public function adminPermissions(): BelongsToMany
    {
        return $this->belongsToMany(AdminPermission::class, 'admin_role_permissions')
            ->withPivot(['conditions', 'granted_at', 'granted_by'])
            ->withTimestamps();
    }

    /**
     * Get users assigned to this role
     */
    public function userAssignments(): HasMany
    {
        return $this->hasMany(AdminUserRole::class);
    }

    /**
     * Get active users with this role
     */
    public function activeUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'admin_user_roles')
            ->wherePivot('is_active', true)
            ->wherePivot('expires_at', '>', now())
            ->orWherePivotNull('expires_at')
            ->withPivot(['assigned_at', 'expires_at', 'assigned_by', 'assignment_reason'])
            ->withTimestamps();
    }

    /**
     * Check if this role has a specific permission
     */
    public function hasPermission(string $resource, string $action, string $scope = 'all'): bool
    {
        return $this->adminPermissions()
            ->where('resource', $resource)
            ->where('action', $action)
            ->where('scope', $scope)
            ->exists();
    }

    /**
     * Get all permissions for this role (including inherited)
     */
    public function getAllPermissions(): \Illuminate\Support\Collection
    {
        $permissions = $this->adminPermissions;
        
        // Add direct permissions from the role
        if ($this->permissions) {
            foreach ($this->permissions as $permission) {
                $permissions->push((object) $permission);
            }
        }
        
        return $permissions->unique(function ($permission) {
            return $permission->resource . '.' . $permission->action . '.' . $permission->scope;
        });
    }

    /**
     * Check if this role is higher in hierarchy than another role
     */
    public function isHigherThan(AdminRole $otherRole): bool
    {
        return $this->hierarchy_level > $otherRole->hierarchy_level;
    }

    /**
     * Check if this role can manage another role
     */
    public function canManage(AdminRole $otherRole): bool
    {
        return $this->isHigherThan($otherRole) && !$otherRole->is_system_role;
    }

    /**
     * Get role hierarchy level as attribute
     */
    protected function hierarchyDescription(): Attribute
    {
        return Attribute::make(
            get: fn () => match($this->hierarchy_level) {
                100 => 'Super Administrator',
                80 => 'Administrator',
                60 => 'Manager',
                40 => 'Analyst',
                20 => 'Support',
                default => 'Custom Level ' . $this->hierarchy_level,
            }
        );
    }

    /**
     * Scope query to system roles
     */
    public function scopeSystemRoles($query)
    {
        return $query->where('is_system_role', true);
    }

    /**
     * Scope query to custom roles
     */
    public function scopeCustomRoles($query)
    {
        return $query->where('is_system_role', false);
    }

    /**
     * Scope query by minimum hierarchy level
     */
    public function scopeMinHierarchy($query, int $level)
    {
        return $query->where('hierarchy_level', '>=', $level);
    }

    /**
     * Scope query by maximum hierarchy level
     */
    public function scopeMaxHierarchy($query, int $level)
    {
        return $query->where('hierarchy_level', '<=', $level);
    }

    /**
     * Get roles that can be managed by the given role
     */
    public function scopeManageableBy($query, AdminRole $role)
    {
        return $query->where('hierarchy_level', '<', $role->hierarchy_level)
            ->where('is_system_role', false);
    }

    /**
     * Create a new system role (protected method)
     */
    public static function createSystemRole(array $attributes): self
    {
        $attributes['is_system_role'] = true;
        return static::create($attributes);
    }

    /**
     * Get the display name with hierarchy indicator
     */
    public function getFullDisplayNameAttribute(): string
    {
        $indicator = str_repeat('★', min(5, $this->hierarchy_level / 20));
        return $this->display_name . ($indicator ? " ({$indicator})" : '');
    }

    /**
     * Check if role has sensitive permissions
     */
    public function hasSensitivePermissions(): bool
    {
        return $this->adminPermissions()
            ->where('is_sensitive', true)
            ->exists();
    }

    /**
     * Get role color based on hierarchy level
     */
    public function getColorAttribute(): string
    {
        return match(true) {
            $this->hierarchy_level >= 80 => '#dc2626', // red-600
            $this->hierarchy_level >= 60 => '#ea580c', // orange-600
            $this->hierarchy_level >= 40 => '#ca8a04', // yellow-600
            $this->hierarchy_level >= 20 => '#16a34a', // green-600
            default => '#6b7280', // gray-700
        };
    }
}