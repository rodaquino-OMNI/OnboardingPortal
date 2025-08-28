<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Broadcaster
    |--------------------------------------------------------------------------
    |
    | This option controls the default broadcaster that will be used by the
    | framework when an event needs to be broadcast. You may set this to
    | any of the connections defined in the "connections" array below.
    |
    | Supported: "pusher", "ably", "redis", "log", "null"
    |
    */

    'default' => env('BROADCAST_DRIVER', 'log'),

    /*
    |--------------------------------------------------------------------------
    | Broadcast Connections
    |--------------------------------------------------------------------------
    |
    | Here you may define all of the broadcast connections that will be used
    | to broadcast events to other systems or over websockets. Samples of
    | each available type of connection are provided inside this array.
    |
    */

    'connections' => [

        'pusher' => [
            'driver' => 'pusher',
            'key' => env('PUSHER_APP_KEY'),
            'secret' => env('PUSHER_APP_SECRET'),
            'app_id' => env('PUSHER_APP_ID'),
            'options' => [
                'cluster' => env('PUSHER_APP_CLUSTER'),
                'host' => env('PUSHER_HOST') ?: 'api-'.env('PUSHER_APP_CLUSTER', 'mt1').'.pusherapp.com',
                'port' => env('PUSHER_PORT', 443),
                'scheme' => env('PUSHER_SCHEME', 'https'),
                'encrypted' => true,
                'useTLS' => env('PUSHER_SCHEME', 'https') === 'https',
                'curl_options' => [
                    CURLOPT_SSL_VERIFYHOST => 2,
                    CURLOPT_SSL_VERIFYPEER => true,
                ],
            ],
            'client_options' => [
                // Guzzle client options: https://docs.guzzlephp.org/en/stable/request-options.html
            ],
        ],

        'ably' => [
            'driver' => 'ably',
            'key' => env('ABLY_KEY'),
        ],

        'redis' => [
            'driver' => 'redis',
            'connection' => 'default',
        ],

        'log' => [
            'driver' => 'log',
        ],

        'null' => [
            'driver' => 'null',
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | WebSocket Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration options specific to WebSocket functionality
    |
    */

    'websocket_enabled' => env('WEBSOCKET_ENABLED', true),
    'websocket_max_connections' => env('WEBSOCKET_MAX_CONNECTIONS', 1000),
    'websocket_heartbeat_interval' => env('WEBSOCKET_HEARTBEAT_INTERVAL', 30),
    'websocket_auth_timeout' => env('WEBSOCKET_AUTH_TIMEOUT', 10),

    /*
    |--------------------------------------------------------------------------
    | Real-time Features Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for real-time features like alerts and notifications
    |
    */

    'realtime' => [
        'alerts_enabled' => env('REALTIME_ALERTS_ENABLED', true),
        'health_monitoring' => env('REALTIME_HEALTH_MONITORING', true),
        'admin_notifications' => env('REALTIME_ADMIN_NOTIFICATIONS', true),
        'max_alert_retention' => env('MAX_ALERT_RETENTION_HOURS', 72),
        'alert_channels' => [
            'health' => 'health.alerts',
            'admin' => 'admin.notifications',
            'security' => 'admin.security',
            'system' => 'admin.system',
            'performance' => 'admin.performance',
            'compliance' => 'admin.compliance',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Channel Security Configuration
    |--------------------------------------------------------------------------
    |
    | Security settings for WebSocket channels
    |
    */

    'channel_security' => [
        'enable_signature_verification' => env('WEBSOCKET_SIGNATURE_VERIFICATION', true),
        'auth_endpoint' => '/broadcasting/auth',
        'auth_headers' => [
            'X-Requested-With' => 'XMLHttpRequest',
        ],
        'max_auth_attempts' => 5,
        'auth_rate_limit' => '60,1', // 60 attempts per minute
    ],

    /*
    |--------------------------------------------------------------------------
    | Performance Configuration
    |--------------------------------------------------------------------------
    |
    | Performance-related settings for broadcasting
    |
    */

    'performance' => [
        'queue_broadcasts' => env('QUEUE_BROADCASTS', true),
        'queue_connection' => env('BROADCAST_QUEUE_CONNECTION', 'redis'),
        'queue_name' => env('BROADCAST_QUEUE_NAME', 'broadcasts'),
        'batch_broadcasts' => env('BATCH_BROADCASTS', true),
        'batch_size' => env('BROADCAST_BATCH_SIZE', 100),
        'retry_attempts' => env('BROADCAST_RETRY_ATTEMPTS', 3),
        'retry_delay' => env('BROADCAST_RETRY_DELAY', 5), // seconds
    ],

    /*
    |--------------------------------------------------------------------------
    | Monitoring and Logging
    |--------------------------------------------------------------------------
    |
    | Configuration for monitoring WebSocket connections and logging
    |
    */

    'monitoring' => [
        'log_connections' => env('LOG_WEBSOCKET_CONNECTIONS', true),
        'log_channel' => env('WEBSOCKET_LOG_CHANNEL', 'websocket'),
        'metrics_enabled' => env('WEBSOCKET_METRICS_ENABLED', true),
        'health_check_interval' => env('WEBSOCKET_HEALTH_CHECK_INTERVAL', 60), // seconds
        'connection_timeout' => env('WEBSOCKET_CONNECTION_TIMEOUT', 300), // seconds
    ],

    /*
    |--------------------------------------------------------------------------
    | Development Configuration
    |--------------------------------------------------------------------------
    |
    | Settings specific to development environment
    |
    */

    'development' => [
        'debug_mode' => env('WEBSOCKET_DEBUG', false),
        'mock_connections' => env('MOCK_WEBSOCKET_CONNECTIONS', false),
        'test_channels' => [
            'test.public' => true,
            'test.private' => false,
        ],
    ],

];