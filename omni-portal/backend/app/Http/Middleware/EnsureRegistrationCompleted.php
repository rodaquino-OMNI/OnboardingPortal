<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRegistrationCompleted
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        
        // Allow access to registration and auth routes
        $allowedRoutes = [
            'api/register/*',
            'api/auth/logout',
            'api/auth/user',
            'api/health',
        ];
        
        foreach ($allowedRoutes as $pattern) {
            if (fnmatch($pattern, $request->path())) {
                return $next($request);
            }
        }
        
        // Check if user has completed registration
        if ($user && !$user->isRegistrationCompleted()) {
            return response()->json([
                'message' => 'Registro incompleto',
                'error' => 'Você precisa completar seu registro para acessar este recurso.',
                'registration_step' => $user->registration_step,
            ], 403);
        }
        
        return $next($request);
    }
}