<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Feature Flags Configuration
    |--------------------------------------------------------------------------
    |
    | This file contains feature flag definitions for gradual rollout of
    | Phase 8 enhancements. Flags are stored in database for runtime control.
    |
    */

    'storage' => [
        'driver' => env('FEATURE_FLAG_DRIVER', 'database'),
        'cache_ttl' => env('FEATURE_FLAG_CACHE_TTL', 300), // 5 minutes
    ],

    'flags' => [
        'phase8_encryption_enabled' => [
            'name' => 'Phase 8 Encryption',
            'description' => 'Enable enhanced encryption for sensitive data fields',
            'type' => 'boolean',
            'default' => false,
            'environments' => ['staging', 'production'],
            'rollout_strategy' => 'percentage',
        ],

        'phase8_analytics_persistence_enabled' => [
            'name' => 'Phase 8 Analytics Persistence',
            'description' => 'Enable persistent analytics and audit logging',
            'type' => 'boolean',
            'default' => false,
            'environments' => ['staging', 'production'],
            'rollout_strategy' => 'percentage',
        ],

        'canary_rollout_percentage' => [
            'name' => 'Canary Rollout Percentage',
            'description' => 'Percentage of traffic receiving new features',
            'type' => 'integer',
            'default' => 5,
            'min' => 0,
            'max' => 100,
            'environments' => ['staging', 'production'],
        ],

        'phase8_gamification_enhancements' => [
            'name' => 'Phase 8 Gamification Enhancements',
            'description' => 'Enable new gamification features and improvements',
            'type' => 'boolean',
            'default' => false,
            'environments' => ['staging', 'production'],
            'rollout_strategy' => 'percentage',
        ],

        'phase8_auth_improvements' => [
            'name' => 'Phase 8 Authentication Improvements',
            'description' => 'Enable enhanced authentication and session management',
            'type' => 'boolean',
            'default' => false,
            'environments' => ['staging', 'production'],
            'rollout_strategy' => 'percentage',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Rollout Stages
    |--------------------------------------------------------------------------
    |
    | Define progressive rollout stages for canary deployments
    |
    */

    'rollout_stages' => [
        'stage_1' => [
            'name' => 'Initial Canary',
            'percentage' => 5,
            'duration_minutes' => 60,
            'slo_requirements' => [
                'error_rate_max' => 1.0,
                'p95_latency_max' => 500,
                'p99_latency_max' => 1000,
            ],
        ],
        'stage_2' => [
            'name' => 'Expanded Canary',
            'percentage' => 25,
            'duration_minutes' => 120,
            'slo_requirements' => [
                'error_rate_max' => 1.0,
                'p95_latency_max' => 500,
                'p99_latency_max' => 1000,
            ],
        ],
        'stage_3' => [
            'name' => 'Half Traffic',
            'percentage' => 50,
            'duration_minutes' => 240,
            'slo_requirements' => [
                'error_rate_max' => 0.8,
                'p95_latency_max' => 450,
                'p99_latency_max' => 900,
            ],
        ],
        'stage_4' => [
            'name' => 'Full Rollout',
            'percentage' => 100,
            'duration_minutes' => 1440, // 24 hours
            'slo_requirements' => [
                'error_rate_max' => 0.5,
                'p95_latency_max' => 400,
                'p99_latency_max' => 800,
            ],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Auto-Rollback Configuration
    |--------------------------------------------------------------------------
    |
    | Configure automatic rollback thresholds and behavior
    |
    */

    'auto_rollback' => [
        'enabled' => env('AUTO_ROLLBACK_ENABLED', true),
        'monitoring_interval_seconds' => 30,
        'breach_threshold_count' => 3, // Trigger rollback after 3 consecutive breaches
        'rollback_timeout_seconds' => 120,
        'notification_channels' => ['slack', 'email', 'pagerduty'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Admin Endpoints
    |--------------------------------------------------------------------------
    |
    | API endpoints for managing feature flags via admin UI
    |
    */

    'admin_routes' => [
        'prefix' => 'api/admin/feature-flags',
        'middleware' => ['auth:sanctum', 'admin'],
    ],
];
