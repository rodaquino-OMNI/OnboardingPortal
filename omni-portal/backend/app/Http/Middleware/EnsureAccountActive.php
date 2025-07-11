<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountActive
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        
        if ($user) {
            // Check if account is locked
            if ($user->isLocked()) {
                return response()->json([
                    'message' => 'Conta bloqueada',
                    'error' => 'Sua conta está bloqueada devido a múltiplas tentativas de login falhadas.',
                    'locked_until' => $user->locked_until,
                ], 423); // 423 Locked
            }
            
            // Check if account is active
            if (!$user->is_active) {
                return response()->json([
                    'message' => 'Conta inativa',
                    'error' => 'Sua conta está inativa. Entre em contato com o administrador.',
                ], 403);
            }
            
            // Check if account status is suspended
            if ($user->status === 'suspended') {
                return response()->json([
                    'message' => 'Conta suspensa',
                    'error' => 'Sua conta foi suspensa. Entre em contato com o administrador.',
                ], 403);
            }
        }
        
        return $next($request);
    }
}