<?php

namespace App\Models\Admin;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Casts\Attribute;

/**
 * Admin Permission Model - Granular resource-based permissions
 * 
 * @property int $id
 * @property string $resource
 * @property string $action
 * @property string $scope
 * @property string $conditions
 * @property string $display_name
 * @property string $description
 * @property bool $is_sensitive
 * @property array $metadata
 */
class AdminPermission extends Model
{
    use HasFactory;

    protected $fillable = [
        'resource',
        'action',
        'scope',
        'conditions',
        'display_name',
        'description',
        'is_sensitive',
        'metadata',
    ];

    protected $casts = [
        'is_sensitive' => 'boolean',
        'metadata' => 'array',
        'conditions' => 'array',
    ];

    protected $attributes = [
        'scope' => 'all',
        'is_sensitive' => false,
    ];

    /**
     * Get the roles that have this permission
     */
    public function adminRoles(): BelongsToMany
    {
        return $this->belongsToMany(AdminRole::class, 'admin_role_permissions')
            ->withPivot(['conditions', 'granted_at', 'granted_by'])
            ->withTimestamps();
    }

    /**
     * Get the full permission identifier
     */
    protected function identifier(): Attribute
    {
        return Attribute::make(
            get: fn () => "{$this->resource}.{$this->action}.{$this->scope}"
        );
    }

    /**
     * Get permission category based on resource
     */
    protected function category(): Attribute
    {
        return Attribute::make(
            get: fn () => match($this->resource) {
                'users', 'beneficiaries', 'companies' => 'User Management',
                'documents', 'questionnaires', 'interviews' => 'Content Management',
                'analytics', 'reports', 'metrics' => 'Analytics & Reporting',
                'system', 'settings', 'logs' => 'System Administration',
                'security', 'audit', 'permissions' => 'Security & Compliance',
                default => 'General',
            }
        );
    }

    /**
     * Get permission icon based on action
     */
    protected function icon(): Attribute
    {
        return Attribute::make(
            get: fn () => match($this->action) {
                'view', 'read' => 'eye',
                'create', 'add' => 'plus',
                'edit', 'update' => 'pencil',
                'delete', 'remove' => 'trash',
                'export' => 'download',
                'import' => 'upload',
                'approve' => 'check',
                'reject' => 'x',
                'manage' => 'cog',
                default => 'shield',
            }
        );
    }

    /**
     * Get permission color based on sensitivity and action
     */
    protected function color(): Attribute
    {
        return Attribute::make(
            get: fn () => match(true) {
                $this->is_sensitive => '#dc2626', // red-600
                in_array($this->action, ['delete', 'remove']) => '#ea580c', // orange-600
                in_array($this->action, ['edit', 'update', 'approve']) => '#ca8a04', // yellow-600
                in_array($this->action, ['create', 'add']) => '#16a34a', // green-600
                default => '#3b82f6', // blue-500
            }
        );
    }

    /**
     * Check if permission applies to a given resource and context
     */
    public function appliesTo(string $resource, string $action, string $scope = 'all', array $context = []): bool
    {
        // Basic matching
        if ($this->resource !== $resource || $this->action !== $action) {
            return false;
        }

        // Scope matching
        if (!$this->scopeMatches($scope)) {
            return false;
        }

        // Condition matching if conditions exist
        if ($this->conditions && !$this->conditionsMatch($context)) {
            return false;
        }

        return true;
    }

    /**
     * Check if scope matches
     */
    protected function scopeMatches(string $targetScope): bool
    {
        // 'all' scope matches everything
        if ($this->scope === 'all') {
            return true;
        }

        // Exact scope match
        if ($this->scope === $targetScope) {
            return true;
        }

        // Hierarchical scope matching
        $scopeHierarchy = ['own', 'team', 'department', 'all'];
        $thisIndex = array_search($this->scope, $scopeHierarchy);
        $targetIndex = array_search($targetScope, $scopeHierarchy);

        return $thisIndex !== false && $targetIndex !== false && $thisIndex >= $targetIndex;
    }

    /**
     * Check if conditions match the given context
     */
    protected function conditionsMatch(array $context): bool
    {
        if (!$this->conditions) {
            return true;
        }

        foreach ($this->conditions as $condition) {
            if (!$this->evaluateCondition($condition, $context)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Evaluate a single condition
     */
    protected function evaluateCondition(array $condition, array $context): bool
    {
        $field = $condition['field'] ?? null;
        $operator = $condition['operator'] ?? 'eq';
        $value = $condition['value'] ?? null;

        if (!$field || !isset($context[$field])) {
            return false;
        }

        $contextValue = $context[$field];

        return match($operator) {
            'eq' => $contextValue == $value,
            'ne' => $contextValue != $value,
            'gt' => $contextValue > $value,
            'gte' => $contextValue >= $value,
            'lt' => $contextValue < $value,
            'lte' => $contextValue <= $value,
            'in' => in_array($contextValue, (array) $value),
            'not_in' => !in_array($contextValue, (array) $value),
            'contains' => str_contains($contextValue, $value),
            'starts_with' => str_starts_with($contextValue, $value),
            'ends_with' => str_ends_with($contextValue, $value),
            'regex' => preg_match($value, $contextValue),
            default => false,
        };
    }

    /**
     * Scope query by resource
     */
    public function scopeForResource($query, string $resource)
    {
        return $query->where('resource', $resource);
    }

    /**
     * Scope query by action
     */
    public function scopeForAction($query, string $action)
    {
        return $query->where('action', $action);
    }

    /**
     * Scope query by scope
     */
    public function scopeForScope($query, string $scope)
    {
        return $query->where('scope', $scope);
    }

    /**
     * Scope query for sensitive permissions
     */
    public function scopeSensitive($query)
    {
        return $query->where('is_sensitive', true);
    }

    /**
     * Scope query for non-sensitive permissions
     */
    public function scopeRegular($query)
    {
        return $query->where('is_sensitive', false);
    }

    /**
     * Scope query by category
     */
    public function scopeByCategory($query, string $category)
    {
        $resources = match($category) {
            'User Management' => ['users', 'beneficiaries', 'companies'],
            'Content Management' => ['documents', 'questionnaires', 'interviews'],
            'Analytics & Reporting' => ['analytics', 'reports', 'metrics'],
            'System Administration' => ['system', 'settings', 'logs'],
            'Security & Compliance' => ['security', 'audit', 'permissions'],
            default => [],
        };

        return $query->whereIn('resource', $resources);
    }

    /**
     * Get grouped permissions by category
     */
    public static function getGroupedByCategory(): \Illuminate\Support\Collection
    {
        return static::all()->groupBy('category');
    }

    /**
     * Get permissions for a specific resource
     */
    public static function getForResource(string $resource): \Illuminate\Support\Collection
    {
        return static::forResource($resource)->get();
    }

    /**
     * Create standard CRUD permissions for a resource
     */
    public static function createCrudPermissions(string $resource, string $displayName, bool $includeSensitive = false): void
    {
        $permissions = [
            ['action' => 'view', 'display_name' => "View {$displayName}", 'is_sensitive' => false],
            ['action' => 'create', 'display_name' => "Create {$displayName}", 'is_sensitive' => false],
            ['action' => 'edit', 'display_name' => "Edit {$displayName}", 'is_sensitive' => false],
            ['action' => 'delete', 'display_name' => "Delete {$displayName}", 'is_sensitive' => true],
        ];

        if ($includeSensitive) {
            $permissions[] = ['action' => 'export', 'display_name' => "Export {$displayName}", 'is_sensitive' => true];
            $permissions[] = ['action' => 'manage', 'display_name' => "Manage {$displayName}", 'is_sensitive' => true];
        }

        foreach ($permissions as $permission) {
            static::create(array_merge([
                'resource' => $resource,
                'scope' => 'all',
                'description' => $permission['display_name'] . ' records',
            ], $permission));
        }
    }

    /**
     * Check if user has this permission through any role
     */
    public function isGrantedToUser(\App\Models\User $user): bool
    {
        return $this->adminRoles()
            ->whereHas('activeUsers', function ($query) use ($user) {
                $query->where('users.id', $user->id);
            })
            ->exists();
    }
}