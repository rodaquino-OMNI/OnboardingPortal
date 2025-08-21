<?php

return [
    /*
    |--------------------------------------------------------------------------
    | OpenTelemetry Configuration
    |--------------------------------------------------------------------------
    |
    | This file is for storing the configuration for OpenTelemetry.
    |
    */

    'enabled' => env('OTEL_ENABLED', true),

    'service_name' => env('OTEL_SERVICE_NAME', 'omni-portal-backend'),
    'service_version' => env('OTEL_SERVICE_VERSION', '1.0.0'),

    'jaeger' => [
        'endpoint' => env('JAEGER_ENDPOINT', 'http://jaeger:14268/api/traces'),
        'agent_host' => env('JAEGER_AGENT_HOST', 'jaeger'),
        'agent_port' => env('JAEGER_AGENT_PORT', 6832),
    ],

    'sampling' => [
        'ratio' => env('OTEL_SAMPLING_RATIO', 0.1), // 10% sampling
    ],

    'resource_attributes' => [
        'service.name' => env('OTEL_SERVICE_NAME', 'omni-portal-backend'),
        'service.version' => env('OTEL_SERVICE_VERSION', '1.0.0'),
        'deployment.environment' => env('APP_ENV', 'development'),
    ],

    'propagators' => [
        'jaeger',
        'b3',
        'tracecontext',
        'baggage',
    ],

    'exporter' => [
        'type' => env('OTEL_EXPORTER_TYPE', 'otlp'),
        'endpoint' => env('OTEL_EXPORTER_ENDPOINT', 'http://jaeger:14268/api/traces'),
        'headers' => [],
        'timeout' => 30,
    ],

    'instrumentation' => [
        'laravel' => [
            'enabled' => true,
            'http_requests' => true,
            'database_queries' => true,
            'cache_operations' => true,
            'queue_jobs' => true,
            'events' => true,
        ],
    ],

    'attributes' => [
        'http.request.header.user-agent' => true,
        'http.request.header.accept' => true,
        'user.id' => true,
    ],

    'ignored_routes' => [
        'health',
        'metrics',
        '_ignition/*',
    ],

    'ignored_commands' => [
        'schedule:run',
        'queue:work',
        'horizon:work',
    ],
];