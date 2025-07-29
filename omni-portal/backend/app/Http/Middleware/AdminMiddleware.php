<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AdminMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @param  string|null  $permission
     * @return mixed
     */
    public function handle(Request $request, Closure $next, ?string $permission = null)
    {
        $user = $request->user();

        // Check if user is authenticated
        if (!$user) {
            return response()->json([
                'message' => 'Acesso não autorizado',
                'error' => 'authentication_required'
            ], 401);
        }

        // Check if user has admin role
        if (!$user->hasRole('admin') && !$user->hasRole('super-admin')) {
            return response()->json([
                'message' => 'Acesso negado. Permissões administrativas necessárias.',
                'error' => 'insufficient_permissions'
            ], 403);
        }

        // Check specific permission if provided
        if ($permission && !$user->hasPermissionTo($permission)) {
            return response()->json([
                'message' => "Acesso negado. Permissão '{$permission}' necessária.",
                'error' => 'permission_denied',
                'required_permission' => $permission
            ], 403);
        }

        // Check if account is active
        if (!$user->is_active) {
            return response()->json([
                'message' => 'Conta administrativa inativa',
                'error' => 'account_inactive'
            ], 403);
        }

        return $next($request);
    }
}