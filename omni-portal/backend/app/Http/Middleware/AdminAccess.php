<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use App\Models\Admin\AdminSession;
use App\Models\Admin\AdminActionLog;
use Symfony\Component\HttpFoundation\Response;

/**
 * Admin Access Middleware
 * 
 * Comprehensive security middleware for admin dashboard access with:
 * - RBAC authentication
 * - Session management 
 * - Activity logging
 * - Security monitoring
 */
class AdminAccess
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, ...$permissions): Response
    {
        // Ensure user is authenticated
        if (!Auth::check()) {
            return response()->json([
                'error' => 'Authentication required',
                'message' => 'Admin access requires authentication'
            ], 401);
        }

        $user = Auth::user();

        // Check if user has admin roles
        $adminRoles = $user->adminRoles()->where('is_active', true)->get();
        
        if ($adminRoles->isEmpty()) {
            $this->logSecurityEvent($user, 'unauthorized_admin_access', [
                'reason' => 'no_admin_roles',
                'requested_path' => $request->path(),
            ]);
            
            return response()->json([
                'error' => 'Insufficient privileges',
                'message' => 'Admin access required'
            ], 403);
        }

        // Check specific permissions if provided
        if (!empty($permissions)) {
            if (!$this->hasRequiredPermissions($user, $permissions)) {
                $this->logSecurityEvent($user, 'permission_denied', [
                    'required_permissions' => $permissions,
                    'requested_path' => $request->path(),
                ]);
                
                return response()->json([
                    'error' => 'Insufficient permissions',
                    'message' => 'Required permissions: ' . implode(', ', $permissions)
                ], 403);
            }
        }

        // Check for locked account
        if ($user->isLocked()) {
            $this->logSecurityEvent($user, 'locked_account_access', [
                'locked_until' => $user->locked_until,
                'requested_path' => $request->path(),
            ]);
            
            return response()->json([
                'error' => 'Account locked',
                'message' => 'Account is temporarily locked due to security concerns',
                'locked_until' => $user->locked_until->toISOString(),
            ], 423);
        }

        // Manage admin session
        $this->manageAdminSession($user, $request);

        // Check for suspicious activity
        if ($this->detectSuspiciousActivity($user, $request)) {
            $this->logSecurityEvent($user, 'suspicious_activity', [
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'requested_path' => $request->path(),
            ], 'high');
            
            // Optional: Lock account or require additional verification
            // $user->lockAccount(60); // Lock for 1 hour
        }

        // Add admin context to request
        $request->merge([
            'admin_context' => [
                'user_id' => $user->id,
                'roles' => $adminRoles->pluck('name')->toArray(),
                'permissions' => $this->getUserPermissions($user),
                'session_id' => $this->getCurrentAdminSessionId($user),
                'hierarchy_level' => $adminRoles->max('hierarchy_level'),
            ]
        ]);

        return $next($request);
    }

    /**
     * Check if user has required permissions
     */
    private function hasRequiredPermissions($user, array $permissions): bool
    {
        $userPermissions = $this->getUserPermissions($user);
        
        foreach ($permissions as $permission) {
            // Parse permission format: resource.action.scope
            $parts = explode('.', $permission);
            $resource = $parts[0] ?? null;
            $action = $parts[1] ?? 'view';
            $scope = $parts[2] ?? 'all';
            
            $hasPermission = false;
            
            foreach ($user->adminRoles as $role) {
                if ($role->hasPermission($resource, $action, $scope)) {
                    $hasPermission = true;
                    break;
                }
            }
            
            if (!$hasPermission) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Get all user permissions
     */
    private function getUserPermissions($user): array
    {
        $permissions = [];
        
        foreach ($user->adminRoles as $role) {
            foreach ($role->adminPermissions as $permission) {
                $permissions[] = $permission->identifier;
            }
        }
        
        return array_unique($permissions);
    }

    /**
     * Manage admin session tracking
     */
    private function manageAdminSession($user, Request $request): void
    {
        $session = AdminSession::where('user_id', $user->id)
            ->where('session_id', session()->getId())
            ->first();

        if ($session) {
            // Update existing session
            $session->update([
                'last_activity_at' => now(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
        } else {
            // Create new session
            AdminSession::create([
                'user_id' => $user->id,
                'session_id' => session()->getId(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'device_info' => $this->getDeviceInfo($request),
                'login_at' => now(),
                'last_activity_at' => now(),
                'is_active' => true,
                'permissions_snapshot' => $this->getUserPermissions($user),
            ]);
        }

        // Clean up expired sessions
        AdminSession::where('user_id', $user->id)
            ->where('last_activity_at', '<', now()->subHours(24))
            ->where('is_active', true)
            ->update([
                'is_active' => false,
                'logout_at' => now(),
                'logout_reason' => 'timeout',
            ]);
    }

    /**
     * Detect suspicious activity patterns
     */
    private function detectSuspiciousActivity($user, Request $request): bool
    {
        $suspiciousIndicators = [];

        // Check for rapid requests from different IPs
        $recentSessions = AdminSession::where('user_id', $user->id)
            ->where('last_activity_at', '>', now()->subMinutes(5))
            ->distinct('ip_address')
            ->count('ip_address');

        if ($recentSessions > 3) {
            $suspiciousIndicators[] = 'multiple_ip_addresses';
        }

        // Check for unusual user agent patterns
        $currentUserAgent = $request->userAgent();
        $recentUserAgents = AdminSession::where('user_id', $user->id)
            ->where('last_activity_at', '>', now()->subHours(1))
            ->distinct('user_agent')
            ->pluck('user_agent')
            ->toArray();

        if (count($recentUserAgents) > 2 && !in_array($currentUserAgent, $recentUserAgents)) {
            $suspiciousIndicators[] = 'unusual_user_agent';
        }

        // Check for high-risk actions frequency
        $highRiskActions = AdminActionLog::where('user_id', $user->id)
            ->where('created_at', '>', now()->subMinutes(10))
            ->where('risk_level', 'high')
            ->count();

        if ($highRiskActions > 5) {
            $suspiciousIndicators[] = 'high_frequency_risk_actions';
        }

        // Check for unusual access patterns
        $offHoursAccess = now()->hour < 6 || now()->hour > 22;
        $weekendAccess = now()->isWeekend();
        
        if ($offHoursAccess && $weekendAccess) {
            $suspiciousIndicators[] = 'off_hours_weekend_access';
        }

        return !empty($suspiciousIndicators);
    }

    /**
     * Log security events
     */
    private function logSecurityEvent($user, string $eventType, array $data = [], string $riskLevel = 'medium'): void
    {
        AdminActionLog::create([
            'user_id' => $user->id,
            'admin_session_id' => $this->getCurrentAdminSessionId($user),
            'action_type' => 'security_event',
            'resource_type' => 'admin_access',
            'action_data' => array_merge($data, [
                'event_type' => $eventType,
                'timestamp' => now()->toISOString(),
            ]),
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'request_method' => request()->method(),
            'request_url' => request()->fullUrl(),
            'response_status' => 403,
            'risk_level' => $riskLevel,
            'is_successful' => false,
        ]);

        // Log to application log for monitoring
        Log::channel('security')->warning('Admin security event', [
            'user_id' => $user->id,
            'user_email' => $user->email,
            'event_type' => $eventType,
            'data' => $data,
            'risk_level' => $riskLevel,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);
    }

    /**
     * Get current admin session ID
     */
    private function getCurrentAdminSessionId($user): ?int
    {
        return AdminSession::where('user_id', $user->id)
            ->where('session_id', session()->getId())
            ->where('is_active', true)
            ->value('id');
    }

    /**
     * Extract device information from request
     */
    private function getDeviceInfo(Request $request): array
    {
        $userAgent = $request->userAgent();
        $deviceInfo = [
            'user_agent' => $userAgent,
            'browser' => 'Unknown',
            'browser_version' => 'Unknown',
            'platform' => 'Unknown',
            'device_type' => 'Unknown',
        ];

        // Simple browser detection
        if (str_contains($userAgent, 'Chrome')) {
            $deviceInfo['browser'] = 'Chrome';
            preg_match('/Chrome\/([0-9\.]+)/', $userAgent, $matches);
            $deviceInfo['browser_version'] = $matches[1] ?? 'Unknown';
        } elseif (str_contains($userAgent, 'Firefox')) {
            $deviceInfo['browser'] = 'Firefox';
            preg_match('/Firefox\/([0-9\.]+)/', $userAgent, $matches);
            $deviceInfo['browser_version'] = $matches[1] ?? 'Unknown';
        } elseif (str_contains($userAgent, 'Safari')) {
            $deviceInfo['browser'] = 'Safari';
            preg_match('/Version\/([0-9\.]+)/', $userAgent, $matches);
            $deviceInfo['browser_version'] = $matches[1] ?? 'Unknown';
        }

        // Platform detection
        if (str_contains($userAgent, 'Windows')) {
            $deviceInfo['platform'] = 'Windows';
        } elseif (str_contains($userAgent, 'Mac')) {
            $deviceInfo['platform'] = 'macOS';
        } elseif (str_contains($userAgent, 'Linux')) {
            $deviceInfo['platform'] = 'Linux';
        } elseif (str_contains($userAgent, 'Android')) {
            $deviceInfo['platform'] = 'Android';
        } elseif (str_contains($userAgent, 'iOS')) {
            $deviceInfo['platform'] = 'iOS';
        }

        // Device type detection
        if (str_contains($userAgent, 'Mobile') || str_contains($userAgent, 'Android')) {
            $deviceInfo['device_type'] = 'mobile';
        } elseif (str_contains($userAgent, 'Tablet') || str_contains($userAgent, 'iPad')) {
            $deviceInfo['device_type'] = 'tablet';
        } else {
            $deviceInfo['device_type'] = 'desktop';
        }

        return $deviceInfo;
    }

    /**
     * Handle middleware termination (cleanup)
     */
    public function terminate(Request $request, Response $response): void
    {
        if (Auth::check() && $request->has('admin_context')) {
            $user = Auth::user();
            $context = $request->get('admin_context');

            // Log successful admin action
            AdminActionLog::create([
                'user_id' => $user->id,
                'admin_session_id' => $context['session_id'],
                'action_type' => 'admin_access',
                'resource_type' => 'admin_dashboard',
                'action_data' => [
                    'path' => $request->path(),
                    'method' => $request->method(),
                    'roles' => $context['roles'],
                    'hierarchy_level' => $context['hierarchy_level'],
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'request_method' => $request->method(),
                'request_url' => $request->fullUrl(),
                'response_status' => $response->getStatusCode(),
                'risk_level' => 'low',
                'is_successful' => $response->isSuccessful(),
            ]);
        }
    }
}