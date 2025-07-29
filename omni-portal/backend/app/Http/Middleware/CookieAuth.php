<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\Crypt;

class CookieAuth
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Check if there's an auth_token cookie
        $encryptedToken = $request->cookie('auth_token');
        
        if ($encryptedToken && !$request->bearerToken()) {
            try {
                // Laravel cookies are automatically decrypted by the framework
                // The cookie value is already decrypted at this point
                // We need to extract the actual token from the decrypted value
                // The auth_token cookie contains the actual Sanctum token
                $request->headers->set('Authorization', 'Bearer ' . $encryptedToken);
            } catch (\Exception $e) {
                // If decryption fails, just continue without setting the header
            }
        }
        
        return $next($request);
    }
}