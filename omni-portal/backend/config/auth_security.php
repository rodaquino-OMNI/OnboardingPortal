<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Authentication Cookie Configuration
    |--------------------------------------------------------------------------
    |
    | Secure cookie settings for authentication tokens
    |
    */

    'cookie' => [
        'expiration' => env('AUTH_COOKIE_EXPIRATION', 525600), // 1 year default
        'path' => env('AUTH_COOKIE_PATH', '/'),
        'domain' => env('AUTH_COOKIE_DOMAIN', null),
        'secure' => env('AUTH_COOKIE_SECURE', env('APP_ENV') === 'production'),
        'httponly' => env('AUTH_COOKIE_HTTPONLY', true),
        'samesite' => env('AUTH_COOKIE_SAMESITE', env('APP_ENV') === 'production' ? 'Strict' : 'Lax'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Metrics Security Configuration
    |--------------------------------------------------------------------------
    |
    | Security settings for metrics endpoint access
    |
    */

    'metrics' => [
        'allowed_ips' => array_filter(explode(',', env('METRICS_ALLOWED_IPS', ''))),
        'rate_limit' => env('METRICS_RATE_LIMIT', 5), // requests per minute (more restrictive)
        'require_auth' => env('METRICS_REQUIRE_AUTH', true),
        'require_admin' => env('METRICS_REQUIRE_ADMIN', true), // Admin-only access
        'log_access_attempts' => env('METRICS_LOG_ACCESS', true), // Log all access attempts
    ],

    /*
    |--------------------------------------------------------------------------
    | Health Questionnaire Security
    |--------------------------------------------------------------------------
    |
    | Security settings for health questionnaire endpoints
    |
    */

    'health_questionnaire' => [
        'require_email_verification' => env('HEALTH_REQUIRE_EMAIL_VERIFICATION', true),
        'max_responses_per_submission' => env('HEALTH_MAX_RESPONSES', 500),
        'max_response_length' => env('HEALTH_MAX_RESPONSE_LENGTH', 2000),
        'max_array_depth' => env('HEALTH_MAX_ARRAY_DEPTH', 2),
        'max_array_size' => env('HEALTH_MAX_ARRAY_SIZE', 100),
    ],
];