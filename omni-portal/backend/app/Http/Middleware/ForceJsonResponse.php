<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ForceJsonResponse
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
        // Force Accept header to be application/json for API routes
        $request->headers->set('Accept', 'application/json');
        
        // If the request has JSON content, ensure it's parsed
        if ($request->isJson() || $request->header('Content-Type') === 'application/json') {
            $content = $request->getContent();
            if ($content) {
                // Remove any escaped characters that might cause issues
                $content = stripslashes($content);
                $data = json_decode($content, true);
                
                if (json_last_error() === JSON_ERROR_NONE && is_array($data)) {
                    // Replace the request's input with the parsed data
                    $request->replace($data);
                }
            }
        }
        
        return $next($request);
    }
}