<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureAccountIsActive
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        // For now, allow all authenticated users through
        // In production, check if user account is active
        if ($request->user() && $request->user()->is_active === false) {
            return response()->json([
                'message' => 'Your account has been deactivated.',
                'error' => 'account_inactive'
            ], 403);
        }

        return $next($request);
    }
}