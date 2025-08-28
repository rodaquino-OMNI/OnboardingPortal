<?php

use Illuminate\Support\Facades\Broadcast;
use App\Http\Middleware\WebSocketAuthMiddleware;
use App\Models\User;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| Here you may register all of the event broadcasting channels that your
| application supports. The given channel authorization callbacks are
| used to check if an authenticated user can listen to the channel.
|
*/

// Public channels (no authentication required)
Broadcast::channel('public.announcements', function () {
    return true;
});

Broadcast::channel('public.system-status', function () {
    return true;
});

// Private user channels
Broadcast::channel('private-user.{userId}', function (User $user, int $userId) {
    return $user->id === $userId;
});

// Admin channels - require admin permissions
Broadcast::channel('admin.notifications', function (User $user) {
    return $user->hasRole(['admin', 'super-admin']) || 
           $user->hasPermissionTo('admin.access') ||
           $user->user_type === 'admin';
});

Broadcast::channel('admin.notifications.{userId}', function (User $user, int $userId) {
    // Admin can receive targeted notifications
    return ($user->hasRole(['admin', 'super-admin']) || 
            $user->hasPermissionTo('admin.access') ||
            $user->user_type === 'admin') && 
           $user->id === $userId;
});

Broadcast::channel('admin.health-alerts', function (User $user) {
    return $user->hasRole(['admin', 'super-admin', 'health-admin']) || 
           $user->hasPermissionTo(['health.monitor', 'admin.access']) ||
           in_array($user->user_type, ['admin', 'health_professional']);
});

Broadcast::channel('admin.security', function (User $user) {
    return $user->hasRole(['admin', 'super-admin', 'security-admin']) || 
           $user->hasPermissionTo(['security.monitor', 'admin.access']) ||
           $user->user_type === 'admin';
});

Broadcast::channel('admin.system', function (User $user) {
    return $user->hasRole(['admin', 'super-admin', 'system-admin']) || 
           $user->hasPermissionTo(['system.monitor', 'admin.access']) ||
           $user->user_type === 'admin';
});

Broadcast::channel('admin.performance', function (User $user) {
    return $user->hasRole(['admin', 'super-admin', 'system-admin']) || 
           $user->hasPermissionTo(['system.monitor', 'performance.monitor', 'admin.access']) ||
           $user->user_type === 'admin';
});

Broadcast::channel('admin.compliance', function (User $user) {
    return $user->hasRole(['admin', 'super-admin', 'compliance-admin']) || 
           $user->hasPermissionTo(['compliance.monitor', 'admin.access']) ||
           $user->user_type === 'admin';
});

Broadcast::channel('admin.user_activity', function (User $user) {
    return $user->hasRole(['admin', 'super-admin']) || 
           $user->hasPermissionTo(['users.monitor', 'admin.access']) ||
           $user->user_type === 'admin';
});

// Health channels - for health professionals and users
Broadcast::channel('health.alerts.{userId}', function (User $user, int $userId) {
    // Users can access their own health alerts
    if ($user->id === $userId) {
        return WebSocketAuthMiddleware::getChannelAuthData($user, "health.alerts.{$userId}");
    }
    
    // Health professionals can monitor patient alerts
    if ($user->hasRole(['health-professional', 'doctor', 'nurse']) ||
        $user->hasPermissionTo('health.monitor') ||
        $user->user_type === 'health_professional') {
        return WebSocketAuthMiddleware::getChannelAuthData($user, "health.alerts.{$userId}");
    }
    
    // Admins can access all health alerts
    if ($user->hasRole(['admin', 'super-admin', 'health-admin']) ||
        $user->hasPermissionTo('admin.access')) {
        return WebSocketAuthMiddleware::getChannelAuthData($user, "health.alerts.{$userId}");
    }
    
    return false;
});

Broadcast::channel('health.monitoring', function (User $user) {
    return $user->hasRole(['health-professional', 'doctor', 'nurse', 'admin', 'super-admin']) ||
           $user->hasPermissionTo(['health.monitor', 'admin.access']) ||
           in_array($user->user_type, ['health_professional', 'admin']);
});

// Interview and appointment channels
Broadcast::channel('interviews.{userId}', function (User $user, int $userId) {
    // Users can access their own interview notifications
    if ($user->id === $userId) {
        return WebSocketAuthMiddleware::getChannelAuthData($user, "interviews.{$userId}");
    }
    
    // Staff can access interview notifications for coordination
    return $user->hasRole(['admin', 'staff', 'health-professional']) ||
           $user->hasPermissionTo(['interviews.manage', 'admin.access']) ||
           in_array($user->user_type, ['admin', 'staff', 'health_professional']);
});

Broadcast::channel('appointments.{userId}', function (User $user, int $userId) {
    // Users can access their own appointment notifications
    if ($user->id === $userId) {
        return WebSocketAuthMiddleware::getChannelAuthData($user, "appointments.{$userId}");
    }
    
    // Medical staff can access appointment notifications
    return $user->hasRole(['doctor', 'nurse', 'admin', 'health-professional']) ||
           $user->hasPermissionTo(['appointments.manage', 'admin.access']) ||
           in_array($user->user_type, ['admin', 'health_professional']);
});

// Gamification channels
Broadcast::channel('gamification.{userId}', function (User $user, int $userId) {
    return $user->id === $userId;
});

Broadcast::channel('gamification.leaderboard', function (User $user) {
    return true; // All authenticated users can see leaderboard updates
});

// Document processing channels
Broadcast::channel('documents.{userId}', function (User $user, int $userId) {
    // Users can access their own document processing updates
    if ($user->id === $userId) {
        return WebSocketAuthMiddleware::getChannelAuthData($user, "documents.{$userId}");
    }
    
    // Staff can monitor document processing for administrative purposes
    return $user->hasRole(['admin', 'staff']) ||
           $user->hasPermissionTo(['documents.manage', 'admin.access']) ||
           in_array($user->user_type, ['admin', 'staff']);
});

// System monitoring channels
Broadcast::channel('system.monitoring', function (User $user) {
    return $user->hasRole(['admin', 'super-admin', 'system-admin']) ||
           $user->hasPermissionTo(['system.monitor', 'admin.access']) ||
           $user->user_type === 'admin';
});

Broadcast::channel('system.alerts', function (User $user) {
    return $user->hasRole(['admin', 'super-admin', 'system-admin']) ||
           $user->hasPermissionTo(['system.monitor', 'alerts.receive', 'admin.access']) ||
           $user->user_type === 'admin';
});

// Presence channels for collaborative features
Broadcast::channel('presence.admin-dashboard', function (User $user) {
    if ($user->hasRole(['admin', 'super-admin']) ||
        $user->hasPermissionTo('admin.access') ||
        $user->user_type === 'admin') {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'role' => $user->getRoleNames()->first() ?? $user->user_type,
            'avatar' => $user->avatar_url ?? null,
            'status' => 'online',
            'last_seen' => now()->toISOString()
        ];
    }
    
    return false;
});

Broadcast::channel('presence.health-monitoring', function (User $user) {
    if ($user->hasRole(['health-professional', 'doctor', 'nurse', 'admin']) ||
        $user->hasPermissionTo('health.monitor') ||
        in_array($user->user_type, ['health_professional', 'admin'])) {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'role' => $user->getRoleNames()->first() ?? $user->user_type,
            'specialization' => $user->specialization ?? null,
            'status' => 'monitoring',
            'active_patients' => $user->active_patients_count ?? 0
        ];
    }
    
    return false;
});

// Emergency channels - highest priority
Broadcast::channel('emergency.alerts', function (User $user) {
    return $user->hasRole(['admin', 'super-admin', 'health-professional', 'emergency-contact']) ||
           $user->hasPermissionTo(['emergency.respond', 'health.monitor', 'admin.access']) ||
           in_array($user->user_type, ['admin', 'health_professional', 'emergency_contact']);
});

Broadcast::channel('emergency.coordination', function (User $user) {
    return $user->hasRole(['admin', 'super-admin', 'health-professional', 'emergency-coordinator']) ||
           $user->hasPermissionTo(['emergency.coordinate', 'admin.access']) ||
           in_array($user->user_type, ['admin', 'health_professional']);
});