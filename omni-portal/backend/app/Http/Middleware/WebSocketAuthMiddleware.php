<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use App\Models\User;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * WebSocket Authentication Middleware for Pusher
 * Handles authentication for WebSocket connections and channel authorization
 */
class WebSocketAuthMiddleware
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next)
    {
        try {
            // Log the authentication attempt
            Log::info('WebSocket authentication attempt', [
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'channel_name' => $request->input('channel_name'),
                'socket_id' => $request->input('socket_id')
            ]);

            // Check if WebSocket is enabled
            if (!config('broadcasting.websocket_enabled', true)) {
                Log::warning('WebSocket authentication failed: WebSocket disabled');
                return response()->json(['error' => 'WebSocket connections are currently disabled'], 503);
            }

            // Authenticate user
            $user = $this->authenticateUser($request);
            
            if (!$user) {
                Log::warning('WebSocket authentication failed: Invalid user', [
                    'ip' => $request->ip(),
                    'channel_name' => $request->input('channel_name')
                ]);
                return response()->json(['error' => 'Unauthorized'], 401);
            }

            // Check channel authorization
            if (!$this->authorizeChannel($user, $request->input('channel_name'))) {
                Log::warning('WebSocket channel authorization failed', [
                    'user_id' => $user->id,
                    'channel_name' => $request->input('channel_name')
                ]);
                return response()->json(['error' => 'Forbidden'], 403);
            }

            // Set authenticated user for the request
            Auth::setUser($user);
            $request->setUserResolver(fn() => $user);

            Log::info('WebSocket authentication successful', [
                'user_id' => $user->id,
                'channel_name' => $request->input('channel_name')
            ]);

            return $next($request);

        } catch (\Exception $e) {
            Log::error('WebSocket authentication error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);
            
            return response()->json(['error' => 'Authentication failed'], 500);
        }
    }

    /**
     * Authenticate user from request
     */
    private function authenticateUser(Request $request): ?User
    {
        // Try Bearer token authentication first
        $token = $request->bearerToken();
        if ($token) {
            $accessToken = PersonalAccessToken::findToken($token);
            if ($accessToken && !$accessToken->can('*') === false) {
                return $accessToken->tokenable;
            }
        }

        // Try session authentication
        if (Auth::check()) {
            return Auth::user();
        }

        // Try custom auth header
        $authHeader = $request->header('X-Auth-Token');
        if ($authHeader) {
            $accessToken = PersonalAccessToken::findToken($authHeader);
            if ($accessToken) {
                return $accessToken->tokenable;
            }
        }

        // Try auth parameter (for WebSocket connections)
        $authParam = $request->input('auth');
        if ($authParam) {
            // Parse auth parameter if it's JSON
            if (is_string($authParam)) {
                $authData = json_decode($authParam, true);
                if (isset($authData['token'])) {
                    $accessToken = PersonalAccessToken::findToken($authData['token']);
                    if ($accessToken) {
                        return $accessToken->tokenable;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Check if user can access the specified channel
     */
    private function authorizeChannel(User $user, ?string $channelName): bool
    {
        if (!$channelName) {
            return false;
        }

        // Public channels - anyone can access
        if (strpos($channelName, 'public.') === 0) {
            return true;
        }

        // Private channels - require authentication
        if (strpos($channelName, 'private.') === 0) {
            return true; // User is already authenticated
        }

        // Admin channels - require admin role
        if (strpos($channelName, 'admin.') === 0) {
            return $this->isAdmin($user);
        }

        // Health channels - require health monitor permission or own data
        if (strpos($channelName, 'health.') === 0) {
            return $this->canAccessHealthChannel($user, $channelName);
        }

        // User-specific private channels
        if (preg_match('/^private-user\.(\d+)$/', $channelName, $matches)) {
            $targetUserId = (int)$matches[1];
            return $user->id === $targetUserId || $this->isAdmin($user);
        }

        // Default deny for unknown channel patterns
        return false;
    }

    /**
     * Check if user is admin
     */
    private function isAdmin(User $user): bool
    {
        return $user->hasRole(['admin', 'super-admin']) || 
               $user->hasPermissionTo('admin.access') ||
               $user->user_type === 'admin';
    }

    /**
     * Check if user can access health channels
     */
    private function canAccessHealthChannel(User $user, string $channelName): bool
    {
        // Admin can access all health channels
        if ($this->isAdmin($user)) {
            return true;
        }

        // Health professionals can monitor health channels
        if ($user->hasPermissionTo('health.monitor') || $user->user_type === 'health_professional') {
            return true;
        }

        // Users can access their own health channels
        if (preg_match('/^health\.alerts\.(\d+)$/', $channelName, $matches)) {
            $targetUserId = (int)$matches[1];
            return $user->id === $targetUserId;
        }

        return false;
    }

    /**
     * Get channel authorization data for Pusher
     */
    public static function getChannelAuthData(User $user, string $channelName): array
    {
        $authData = [
            'user_id' => $user->id,
            'user_info' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'user_type' => $user->user_type,
                'roles' => $user->getRoleNames()->toArray(),
                'permissions' => $user->getAllPermissions()->pluck('name')->toArray(),
            ],
            'channel_name' => $channelName,
            'timestamp' => now()->timestamp,
        ];

        // Add channel-specific data
        if (strpos($channelName, 'admin.') === 0) {
            $authData['admin_permissions'] = [
                'can_resolve_alerts' => $user->can('admin.alerts.resolve'),
                'can_manage_users' => $user->can('admin.users.manage'),
                'can_view_analytics' => $user->can('admin.analytics.view'),
            ];
        }

        if (strpos($channelName, 'health.') === 0) {
            $authData['health_permissions'] = [
                'can_monitor' => $user->can('health.monitor'),
                'can_intervene' => $user->can('health.intervene'),
                'is_health_professional' => $user->user_type === 'health_professional',
            ];
        }

        return $authData;
    }

    /**
     * Validate WebSocket connection limits
     */
    private function validateConnectionLimits(User $user): bool
    {
        $maxConnections = config('broadcasting.websocket_max_connections', 1000);
        $userMaxConnections = $this->isAdmin($user) ? 10 : 3;

        // In a production environment, you would check Redis or database
        // for current connection counts
        
        return true; // Simplified for this implementation
    }

    /**
     * Log security events
     */
    private function logSecurityEvent(string $event, array $data): void
    {
        Log::channel('security')->info("WebSocket Security Event: {$event}", $data);
    }
}