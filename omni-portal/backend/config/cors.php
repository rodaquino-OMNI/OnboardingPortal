<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'login', 'logout', 'register/*'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => env('APP_ENV') === 'production' 
        ? [
            env('FRONTEND_URL', 'https://portal.austahealth.com'),
            'https://portal.austahealth.com',
            'https://www.austahealth.com',
        ]
        : [
            env('FRONTEND_URL', 'http://localhost:3000'),
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002', // Current frontend port
            'http://localhost:3004', // Port 3004 support
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'http://127.0.0.1:3002',
            'http://127.0.0.1:3004',
            'http://localhost:8080', // For testing
        ],

    'allowed_origins_patterns' => env('APP_ENV') === 'production' 
        ? [] 
        : ['/^https?:\/\/localhost:\d+$/'], // Allow any localhost port in dev

    'allowed_headers' => [
        'Accept',
        'Authorization',
        'Content-Type',
        'X-Requested-With',
        'X-CSRF-Token',
        'X-XSRF-Token',
    ],

    'exposed_headers' => [
        'X-CSRF-Token',
        'X-XSRF-TOKEN',
        'X-Rate-Limit-Remaining',
        'X-Rate-Limit-Limit',
        'Content-Length',
        'X-Request-Id',
    ],

    'max_age' => 86400, // 24 hours

    'supports_credentials' => true,

];