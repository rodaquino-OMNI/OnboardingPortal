<?php

use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Auth;

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
Broadcast::channel('public.alerts', function () {
    return true;
});

Broadcast::channel('public.system', function () {
    return true;
});

// Private admin channels (require admin role)
Broadcast::channel('admin.alerts', function ($user) {
    return $user && ($user->hasRole('admin') || $user->hasRole('super_admin'));
});

Broadcast::channel('admin.system', function ($user) {
    return $user && ($user->hasRole('admin') || $user->hasRole('super_admin'));
});

Broadcast::channel('admin.security', function ($user) {
    return $user && ($user->hasRole('admin') || $user->hasRole('super_admin') || $user->hasRole('security_admin'));
});

Broadcast::channel('admin.performance', function ($user) {
    return $user && ($user->hasRole('admin') || $user->hasRole('super_admin'));
});

Broadcast::channel('admin.compliance', function ($user) {
    return $user && ($user->hasRole('admin') || $user->hasRole('super_admin') || $user->hasRole('compliance_admin'));
});

// Health-specific channels
Broadcast::channel('health.alerts', function ($user) {
    return $user && (
        $user->hasRole('admin') || 
        $user->hasRole('super_admin') || 
        $user->hasRole('health_admin') ||
        $user->hasRole('medical_professional')
    );
});

// User-specific presence channels
Broadcast::channel('user.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Online users presence channel (for admins)
Broadcast::channel('online', function ($user) {
    if ($user && ($user->hasRole('admin') || $user->hasRole('super_admin'))) {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'role' => $user->getRoleNames()->first(),
            'avatar' => $user->avatar_url ?? null,
        ];
    }
    return false;
});

// Development/Testing channels
if (config('app.env') === 'local' || config('app.env') === 'testing') {
    Broadcast::channel('test.public', function () {
        return true;
    });
    
    Broadcast::channel('test.private', function ($user) {
        return $user !== null;
    });
}