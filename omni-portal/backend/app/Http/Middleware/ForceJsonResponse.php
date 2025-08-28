<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Force JSON Response Middleware
 * 
 * Ensures all API responses are in JSON format and sets proper content-type headers.
 * This is essential for consistent API behavior and client compatibility.
 */
class ForceJsonResponse
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @return \Symfony\Component\HttpFoundation\Response
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Force Accept header to JSON for API routes
        if ($request->is('api/*')) {
            $request->headers->set('Accept', 'application/json');
            $request->headers->set('Content-Type', 'application/json', true);
        }

        $response = $next($request);

        // Ensure response is JSON formatted
        if ($request->is('api/*') && method_exists($response, 'header')) {
            $response->header('Content-Type', 'application/json; charset=utf-8');
            
            // Add API versioning header
            $response->header('X-API-Version', config('app.version', '1.0.0'));
            
            // Add request ID for tracing
            if ($request->has('security_context')) {
                $context = $request->get('security_context');
                $response->header('X-Request-ID', $context['request_id'] ?? 'unknown');
            }
        }

        return $response;
    }
}