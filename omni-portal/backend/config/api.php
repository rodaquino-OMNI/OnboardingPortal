<?php

return [
    /*
    |--------------------------------------------------------------------------
    | API Security Configuration
    |--------------------------------------------------------------------------
    |
    | This file contains security settings for the API endpoints including
    | request size limits, rate limiting, and security policies.
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Maximum Request Size
    |--------------------------------------------------------------------------
    |
    | The maximum size for API request payloads in kilobytes.
    | This helps prevent large payload attacks and memory exhaustion.
    |
    */
    'max_request_size' => env('API_MAX_REQUEST_SIZE', 5120), // 5MB

    /*
    |--------------------------------------------------------------------------
    | Rate Limiting
    |--------------------------------------------------------------------------
    |
    | Configure rate limits for different types of API endpoints.
    | Values are in requests per minute.
    |
    */
    'rate_limits' => [
        'authentication' => env('API_AUTH_RATE_LIMIT', 5), // 5 attempts per minute
        'general' => env('API_GENERAL_RATE_LIMIT', 60), // 60 requests per minute
        'health_endpoints' => env('API_HEALTH_RATE_LIMIT', 120), // 120 requests per minute
    ],

    /*
    |--------------------------------------------------------------------------
    | Security Headers
    |--------------------------------------------------------------------------
    |
    | Configuration for security headers added to API responses.
    |
    */
    'security_headers' => [
        'strict_transport_security' => env('API_HSTS_ENABLED', true),
        'content_type_options' => 'nosniff',
        'frame_options' => 'DENY',
        'xss_protection' => '1; mode=block',
        'referrer_policy' => 'strict-origin-when-cross-origin',
    ],

    /*
    |--------------------------------------------------------------------------
    | Request Logging
    |--------------------------------------------------------------------------
    |
    | Configuration for API request logging and monitoring.
    |
    */
    'logging' => [
        'log_requests' => env('API_LOG_REQUESTS', true),
        'log_responses' => env('API_LOG_RESPONSES', false),
        'log_errors' => env('API_LOG_ERRORS', true),
        'sensitive_fields' => ['password', 'token', 'secret', 'key'], // Fields to redact in logs
    ],

    /*
    |--------------------------------------------------------------------------
    | Error Handling
    |--------------------------------------------------------------------------
    |
    | Configuration for API error responses and debugging.
    |
    */
    'errors' => [
        'show_debug_info' => env('API_SHOW_DEBUG', false),
        'expose_trace' => env('API_EXPOSE_TRACE', false),
        'include_request_id' => true,
        'log_all_exceptions' => true,
    ],

    /*
    |--------------------------------------------------------------------------
    | CORS Configuration
    |--------------------------------------------------------------------------
    |
    | Cross-Origin Resource Sharing settings for API endpoints.
    |
    */
    'cors' => [
        'allowed_origins' => explode(',', env('API_ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:3001')),
        'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        'allowed_headers' => ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
        'max_age' => 86400, // 24 hours
    ],
];