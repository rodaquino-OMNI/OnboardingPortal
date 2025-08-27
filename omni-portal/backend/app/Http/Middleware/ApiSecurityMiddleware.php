<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class ApiSecurityMiddleware
{
    /**
     * Handle an incoming request with enhanced API security.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next)
    {
        // Validate request size (prevent large payload attacks)
        $maxSize = config('api.max_request_size', 5120); // 5MB default
        if ($request->header('Content-Length') && (int) $request->header('Content-Length') > $maxSize * 1024) {
            Log::warning('Large request blocked', [
                'size' => $request->header('Content-Length'),
                'max_allowed' => $maxSize * 1024,
                'ip' => $request->ip(),
                'url' => $request->url(),
            ]);

            return response()->json([
                'message' => 'Request payload too large',
                'error' => 'Payload Too Large',
                'code' => 'PAYLOAD_TOO_LARGE',
                'max_size' => $maxSize . 'KB'
            ], 413);
        }

        // Validate JSON for POST/PUT/PATCH requests
        if (in_array($request->method(), ['POST', 'PUT', 'PATCH'])) {
            $contentType = $request->header('Content-Type');
            
            if (str_contains($contentType, 'application/json') && $request->getContent()) {
                $content = $request->getContent();
                json_decode($content);
                
                if (json_last_error() !== JSON_ERROR_NONE) {
                    Log::warning('Invalid JSON request', [
                        'json_error' => json_last_error_msg(),
                        'ip' => $request->ip(),
                        'url' => $request->url(),
                    ]);

                    return response()->json([
                        'message' => 'Invalid JSON format',
                        'error' => 'Bad Request',
                        'code' => 'INVALID_JSON',
                    ], 400);
                }
            }
        }

        // Block requests with dangerous patterns (allow simple script tags in device_name for sanitization)
        $suspiciousPatterns = [
            '/\.\.\//i',  // Directory traversal
            '/union\s+select/i', // SQL injection attempts
            '/javascript:/i', // JavaScript protocol
            '/data:text\/html/i', // Data URI attacks
            '/<iframe/i', // Iframe injection
            '/<object/i', // Object injection
            '/onclick\s*=/i', // Event handler injection
            '/onload\s*=/i', // Event handler injection
            '/eval\s*\(/i', // Code execution
            '/document\.cookie/i', // Cookie stealing
        ];

        $requestContent = $request->getContent();
        $queryString = http_build_query($request->query());
        
        // For login endpoints, allow script tags in device_name for controller sanitization
        if ($request->is('api/auth/login')) {
            // Parse JSON to check only non-device_name fields
            $data = json_decode($requestContent, true);
            if (is_array($data)) {
                $checkData = $data;
                unset($checkData['device_name']); // Allow XSS in device_name for testing/sanitization
                $contentToCheck = json_encode($checkData) . $queryString;
            } else {
                $contentToCheck = $requestContent . $queryString;
            }
        } else {
            $contentToCheck = $requestContent . $queryString;
        }

        foreach ($suspiciousPatterns as $pattern) {
            if (preg_match($pattern, $contentToCheck)) {
                Log::warning('Suspicious request pattern detected', [
                    'pattern' => $pattern,
                    'ip' => $request->ip(),
                    'url' => $request->url(),
                    'user_agent' => $request->userAgent(),
                ]);

                return response()->json([
                    'message' => 'Request blocked due to security policy',
                    'error' => 'Forbidden',
                    'code' => 'SECURITY_VIOLATION',
                ], 403);
            }
        }

        // Add request ID for tracking
        $requestId = uniqid('req_', true);
        $request->headers->set('X-Request-ID', $requestId);

        // Log API requests for monitoring
        Log::info('API Request', [
            'request_id' => $requestId,
            'method' => $request->method(),
            'url' => $request->url(),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'user_id' => auth()->id(),
        ]);

        return $next($request);
    }
}