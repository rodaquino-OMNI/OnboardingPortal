<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Admin\AdminRole;
use App\Models\Admin\AdminPermission;
use App\Models\Admin\AdminUserRole;
use App\Models\Admin\AdminSession;
use App\Models\Admin\AdminActionLog;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\Document;
use App\Models\HealthQuestionnaire;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Carbon\Carbon;

/**
 * Admin Dashboard Controller
 * 
 * Comprehensive admin management system with RBAC, analytics, and security
 */
class AdminController extends Controller
{
    /**
     * Admin Dashboard Overview
     */
    public function dashboard(): JsonResponse
    {
        $this->authorizeAction('view', 'dashboard');
        
        $user = Auth::user();
        $cacheKey = "admin.dashboard.{$user->id}";
        
        $dashboard = Cache::remember($cacheKey, 300, function () use ($user) {
            return [
                'summary' => $this->getDashboardSummary(),
                'recent_activity' => $this->getRecentActivity(),
                'alerts' => $this->getActiveAlerts(),
                'performance_metrics' => $this->getPerformanceMetrics(),
                'user_analytics' => $this->getUserAnalytics(),
                'system_status' => $this->getSystemStatus(),
            ];
        });

        $this->logAction('view', 'dashboard', null, ['cached' => Cache::has($cacheKey)]);
        
        return response()->json([
            'success' => true,
            'data' => $dashboard,
            'permissions' => $this->getUserPermissions($user),
            'role_hierarchy' => $this->getUserRoleHierarchy($user),
        ]);
    }

    /**
     * Get comprehensive system analytics
     */
    public function analytics(Request $request): JsonResponse
    {
        $this->authorizeAction('view', 'analytics');
        
        $request->validate([
            'period' => 'in:1d,7d,30d,90d,1y',
            'metrics' => 'array',
            'metrics.*' => 'in:users,documents,health,gamification,performance,security',
        ]);

        $period = $request->get('period', '30d');
        $metrics = $request->get('metrics', ['users', 'documents', 'health']);
        
        $analytics = [];
        
        foreach ($metrics as $metric) {
            $analytics[$metric] = $this->getMetricData($metric, $period);
        }

        $this->logAction('view', 'analytics', null, [
            'period' => $period,
            'metrics' => $metrics,
        ]);

        return response()->json([
            'success' => true,
            'data' => $analytics,
            'period' => $period,
            'generated_at' => now()->toISOString(),
        ]);
    }

    /**
     * User Management - List all users with advanced filtering
     */
    public function users(Request $request): JsonResponse
    {
        $this->authorizeAction('view', 'users');
        
        $request->validate([
            'page' => 'integer|min:1',
            'per_page' => 'integer|min:1|max:100',
            'search' => 'string|max:255',
            'status' => 'in:active,inactive,locked,pending',
            'role' => 'string',
            'department' => 'string',
            'registration_step' => 'in:pending,personal_info,company_info,documents,health,completed',
            'sort_by' => 'in:id,name,email,created_at,last_login_at',
            'sort_order' => 'in:asc,desc',
        ]);

        $query = User::with(['beneficiary', 'adminRoles']);
        
        // Apply filters
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('cpf', 'like', "%{$search}%")
                  ->orWhere('employee_id', 'like', "%{$search}%");
            });
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($department = $request->get('department')) {
            $query->where('department', $department);
        }

        if ($registrationStep = $request->get('registration_step')) {
            $query->where('registration_step', $registrationStep);
        }

        // Apply sorting
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $users = $query->paginate($request->get('per_page', 25));

        $this->logAction('view', 'users', null, [
            'filters' => $request->only(['search', 'status', 'role', 'department']),
            'pagination' => $request->only(['page', 'per_page']),
            'total_results' => $users->total(),
        ]);

        return response()->json([
            'success' => true,
            'data' => $users->items(),
            'pagination' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
                'from' => $users->firstItem(),
                'to' => $users->lastItem(),
            ],
            'summary' => $this->getUsersSummary($request),
        ]);
    }

    /**
     * User Details with comprehensive information
     */
    public function userDetails(User $user): JsonResponse
    {
        $this->authorizeAction('view', 'user_details');
        
        $user->load([
            'beneficiary',
            'adminRoles.adminPermissions',
            'documents',
            'healthQuestionnaires',
            'gamificationProgress',
        ]);

        $details = [
            'user' => $user,
            'activity_timeline' => $this->getUserActivityTimeline($user),
            'document_summary' => $this->getUserDocumentSummary($user),
            'health_summary' => $this->getUserHealthSummary($user),
            'security_info' => $this->getUserSecurityInfo($user),
            'admin_info' => $this->getUserAdminInfo($user),
        ];

        $this->logAction('view', 'user', $user->id, [
            'user_email' => $user->email,
            'user_status' => $user->status,
        ]);

        return response()->json([
            'success' => true,
            'data' => $details,
        ]);
    }

    /**
     * Role Management - List all admin roles
     */
    public function roles(): JsonResponse
    {
        $this->authorizeAction('view', 'roles');
        
        $roles = AdminRole::with(['adminPermissions', 'userAssignments' => function ($query) {
            $query->where('is_active', true);
        }])->orderBy('hierarchy_level', 'desc')->get();

        $this->logAction('view', 'roles');

        return response()->json([
            'success' => true,
            'data' => $roles,
            'hierarchy_levels' => $this->getHierarchyLevels(),
        ]);
    }

    /**
     * Create new admin role
     */
    public function createRole(Request $request): JsonResponse
    {
        $this->authorizeAction('create', 'roles');
        
        $request->validate([
            'name' => 'required|string|max:255|unique:admin_roles',
            'display_name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'hierarchy_level' => 'required|integer|min:0|max:99',
            'permissions' => 'array',
            'permissions.*' => 'exists:admin_permissions,id',
        ]);

        DB::beginTransaction();
        
        try {
            $role = AdminRole::create([
                'name' => $request->name,
                'display_name' => $request->display_name,
                'description' => $request->description,
                'hierarchy_level' => $request->hierarchy_level,
                'is_system_role' => false,
            ]);

            // Attach permissions
            if ($request->has('permissions')) {
                $role->adminPermissions()->attach($request->permissions, [
                    'granted_at' => now(),
                    'granted_by' => Auth::id(),
                ]);
            }

            DB::commit();

            $this->logAction('create', 'role', $role->id, [
                'role_name' => $role->name,
                'permissions_count' => count($request->get('permissions', [])),
            ]);

            return response()->json([
                'success' => true,
                'data' => $role->load('adminPermissions'),
                'message' => 'Role created successfully',
            ], 201);
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create admin role', [
                'error' => $e->getMessage(),
                'request' => $request->all(),
                'user_id' => Auth::id(),
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to create role',
            ], 500);
        }
    }

    /**
     * Assign role to user
     */
    public function assignRole(Request $request): JsonResponse
    {
        $this->authorizeAction('manage', 'user_roles');
        
        $request->validate([
            'user_id' => 'required|exists:users,id',
            'role_id' => 'required|exists:admin_roles,id',
            'expires_at' => 'nullable|date_format:Y-m-d H:i:s|after:now',
            'assignment_reason' => 'nullable|string|max:500',
        ]);

        $user = User::findOrFail($request->user_id);
        $role = AdminRole::findOrFail($request->role_id);

        // Check if current user can assign this role
        if (!$this->canAssignRole($role)) {
            return response()->json([
                'success' => false,
                'message' => 'Insufficient permissions to assign this role',
            ], 403);
        }

        // Check if assignment already exists
        $existingAssignment = AdminUserRole::where('user_id', $user->id)
            ->where('admin_role_id', $role->id)
            ->where('is_active', true)
            ->first();

        if ($existingAssignment) {
            return response()->json([
                'success' => false,
                'message' => 'User already has this role',
            ], 409);
        }

        $assignment = AdminUserRole::create([
            'user_id' => $user->id,
            'admin_role_id' => $role->id,
            'assigned_at' => now(),
            'expires_at' => $request->expires_at,
            'assigned_by' => Auth::id(),
            'assignment_reason' => $request->assignment_reason,
            'is_active' => true,
        ]);

        $this->logAction('assign', 'user_role', $assignment->id, [
            'user_email' => $user->email,
            'role_name' => $role->name,
            'expires_at' => $request->expires_at,
        ]);

        return response()->json([
            'success' => true,
            'data' => $assignment->load(['user', 'adminRole']),
            'message' => 'Role assigned successfully',
        ]);
    }

    /**
     * Security Audit - List security events and logs
     */
    public function securityAudit(Request $request): JsonResponse
    {
        $this->authorizeAction('view', 'security_audit');
        
        $request->validate([
            'start_date' => 'date_format:Y-m-d',
            'end_date' => 'date_format:Y-m-d|after_or_equal:start_date',
            'event_type' => 'string',
            'user_id' => 'exists:users,id',
            'risk_level' => 'in:low,medium,high,critical',
            'page' => 'integer|min:1',
            'per_page' => 'integer|min:1|max:100',
        ]);

        $query = AdminActionLog::with('user')
            ->where('created_at', '>=', $request->get('start_date', now()->subDays(30)))
            ->where('created_at', '<=', $request->get('end_date', now()));

        if ($eventType = $request->get('event_type')) {
            $query->where('action_type', $eventType);
        }

        if ($userId = $request->get('user_id')) {
            $query->where('user_id', $userId);
        }

        if ($riskLevel = $request->get('risk_level')) {
            $query->where('risk_level', $riskLevel);
        }

        $logs = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 50));

        $this->logAction('view', 'security_audit', null, [
            'filters' => $request->only(['start_date', 'end_date', 'event_type', 'user_id', 'risk_level']),
            'total_results' => $logs->total(),
        ]);

        return response()->json([
            'success' => true,
            'data' => $logs->items(),
            'pagination' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
            'summary' => $this->getSecuritySummary($request),
        ]);
    }

    /**
     * System Settings Management
     */
    public function systemSettings(): JsonResponse
    {
        $this->authorizeAction('view', 'system_settings');
        
        $settings = \DB::table('admin_system_settings')
            ->select(['id', 'category', 'key', 'value', 'type', 'description', 'is_sensitive'])
            ->orderBy('category')
            ->orderBy('key')
            ->get()
            ->groupBy('category');

        $this->logAction('view', 'system_settings');

        return response()->json([
            'success' => true,
            'data' => $settings,
        ]);
    }

    /**
     * Update system setting
     */
    public function updateSystemSetting(Request $request): JsonResponse
    {
        $this->authorizeAction('edit', 'system_settings');
        
        $request->validate([
            'key' => 'required|exists:admin_system_settings,key',
            'value' => 'required',
        ]);

        $setting = \DB::table('admin_system_settings')->where('key', $request->key)->first();
        
        if (!$setting) {
            return response()->json([
                'success' => false,
                'message' => 'Setting not found',
            ], 404);
        }

        // Validate value based on type
        $validatedValue = $this->validateSettingValue($setting, $request->value);
        
        if ($validatedValue === false) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid value for setting type',
            ], 422);
        }

        \DB::table('admin_system_settings')
            ->where('key', $request->key)
            ->update([
                'value' => $validatedValue,
                'last_modified_by' => Auth::id(),
                'last_modified_at' => now(),
                'updated_at' => now(),
            ]);

        $this->logAction('update', 'system_setting', null, [
            'setting_key' => $request->key,
            'old_value' => $setting->value,
            'new_value' => $validatedValue,
            'is_sensitive' => $setting->is_sensitive,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Setting updated successfully',
        ]);
    }

    /**
     * Export data for compliance/reporting
     */
    public function exportData(Request $request): JsonResponse
    {
        $this->authorizeAction('export', 'data');
        
        $request->validate([
            'type' => 'required|in:users,logs,analytics,reports',
            'format' => 'in:csv,xlsx,pdf',
            'start_date' => 'date_format:Y-m-d',
            'end_date' => 'date_format:Y-m-d|after_or_equal:start_date',
            'filters' => 'array',
        ]);

        // Queue the export job for large datasets
        $exportJob = \App\Jobs\AdminDataExportJob::dispatch(
            $request->type,
            $request->format ?? 'csv',
            Auth::user(),
            $request->only(['start_date', 'end_date', 'filters'])
        );

        $this->logAction('export', 'data', null, [
            'export_type' => $request->type,
            'format' => $request->format,
            'job_id' => $exportJob->getJobId(),
        ], 'high');

        return response()->json([
            'success' => true,
            'message' => 'Export started successfully',
            'job_id' => $exportJob->getJobId(),
            'estimated_completion' => now()->addMinutes(5)->toISOString(),
        ]);
    }

    // Private helper methods

    private function getDashboardSummary(): array
    {
        return [
            'total_users' => User::count(),
            'active_users' => User::where('is_active', true)->count(),
            'new_users_today' => User::whereDate('created_at', today())->count(),
            'total_beneficiaries' => Beneficiary::count(),
            'pending_documents' => Document::where('status', 'pending')->count(),
            'completed_questionnaires' => HealthQuestionnaire::whereNotNull('completed_at')->count(),
            'system_alerts' => \DB::table('admin_alert_instances')->where('status', 'active')->count(),
        ];
    }

    private function getRecentActivity(): array
    {
        return AdminActionLog::with('user')
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get()
            ->toArray();
    }

    private function getUserPermissions(User $user): array
    {
        $permissions = [];
        
        foreach ($user->adminRoles as $role) {
            foreach ($role->adminPermissions as $permission) {
                $permissions[] = $permission->identifier;
            }
        }
        
        return array_unique($permissions);
    }

    private function logAction(string $action, string $resource, ?int $resourceId = null, array $data = [], string $riskLevel = 'low'): void
    {
        AdminActionLog::create([
            'user_id' => Auth::id(),
            'admin_session_id' => $this->getCurrentAdminSessionId(),
            'action_type' => $action,
            'resource_type' => $resource,
            'resource_id' => $resourceId,
            'action_data' => $data,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'request_method' => request()->method(),
            'request_url' => request()->fullUrl(),
            'response_status' => 200,
            'risk_level' => $riskLevel,
        ]);
    }

    private function getCurrentAdminSessionId(): ?int
    {
        return AdminSession::where('user_id', Auth::id())
            ->where('is_active', true)
            ->value('id');
    }

    protected function authorizeAction(string $action, string $resource): void
    {
        $user = Auth::user();
        
        // Check if user has admin roles
        if (!$user->adminRoles()->exists()) {
            abort(403, 'Admin access required');
        }

        // Check specific permission
        $hasPermission = false;
        foreach ($user->adminRoles as $role) {
            if ($role->hasPermission($resource, $action)) {
                $hasPermission = true;
                break;
            }
        }

        if (!$hasPermission) {
            abort(403, "Insufficient permissions for {$action} on {$resource}");
        }
    }
}