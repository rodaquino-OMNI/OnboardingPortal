<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Redis High Availability Configuration
    |--------------------------------------------------------------------------
    |
    | This configuration handles Redis Sentinel setup for high availability.
    | It provides automatic failover, master discovery, and connection pooling.
    |
    */

    'enabled' => env('REDIS_HA_ENABLED', false),

    'sentinel' => [
        'master_name' => env('REDIS_SENTINEL_MASTER', 'mymaster'),
        'nodes' => [
            [
                'host' => env('REDIS_SENTINEL_HOST_1', '127.0.0.1'),
                'port' => env('REDIS_SENTINEL_PORT_1', 26379),
                'timeout' => env('REDIS_SENTINEL_TIMEOUT', 3.0),
            ],
            [
                'host' => env('REDIS_SENTINEL_HOST_2', '127.0.0.1'),
                'port' => env('REDIS_SENTINEL_PORT_2', 26380),
                'timeout' => env('REDIS_SENTINEL_TIMEOUT', 3.0),
            ],
            [
                'host' => env('REDIS_SENTINEL_HOST_3', '127.0.0.1'),
                'port' => env('REDIS_SENTINEL_PORT_3', 26381),
                'timeout' => env('REDIS_SENTINEL_TIMEOUT', 3.0),
            ],
        ],
        'options' => [
            'update_sentinels' => env('REDIS_SENTINEL_UPDATE', true),
            'retry_limit' => env('REDIS_SENTINEL_RETRY_LIMIT', 3),
            'retry_wait_time' => env('REDIS_SENTINEL_RETRY_WAIT', 100), // milliseconds
        ],
    ],

    'connections' => [
        'default' => [
            'database' => env('REDIS_DB', 0),
            'password' => env('REDIS_PASSWORD'),
            'options' => [
                'persistent' => env('REDIS_PERSISTENT', true),
                'connection_timeout' => env('REDIS_CONNECTION_TIMEOUT', 5.0),
                'read_timeout' => env('REDIS_READ_TIMEOUT', 5.0),
                'tcp_keepalive' => env('REDIS_TCP_KEEPALIVE', 1),
                'compression' => env('REDIS_COMPRESSION', 'lz4'),
                'serialization' => env('REDIS_SERIALIZATION', 'igbinary'),
            ],
        ],
        'cache' => [
            'database' => env('REDIS_CACHE_DB', 1),
            'password' => env('REDIS_PASSWORD'),
            'options' => [
                'persistent' => env('REDIS_CACHE_PERSISTENT', true),
                'connection_timeout' => env('REDIS_CACHE_CONNECTION_TIMEOUT', 3.0),
                'read_timeout' => env('REDIS_CACHE_READ_TIMEOUT', 3.0),
                'tcp_keepalive' => env('REDIS_CACHE_TCP_KEEPALIVE', 1),
            ],
        ],
        'session' => [
            'database' => env('REDIS_SESSION_DB', 3),
            'password' => env('REDIS_PASSWORD'),
            'options' => [
                'persistent' => env('REDIS_SESSION_PERSISTENT', true),
                'connection_timeout' => env('REDIS_SESSION_CONNECTION_TIMEOUT', 2.0),
                'read_timeout' => env('REDIS_SESSION_READ_TIMEOUT', 2.0),
                'tcp_keepalive' => env('REDIS_SESSION_TCP_KEEPALIVE', 1),
            ],
        ],
        'horizon' => [
            'database' => env('REDIS_HORIZON_DB', 2),
            'password' => env('REDIS_PASSWORD'),
            'options' => [
                'persistent' => env('REDIS_HORIZON_PERSISTENT', true),
                'connection_timeout' => env('REDIS_HORIZON_CONNECTION_TIMEOUT', 10.0),
                'read_timeout' => env('REDIS_HORIZON_READ_TIMEOUT', 10.0),
                'tcp_keepalive' => env('REDIS_HORIZON_TCP_KEEPALIVE', 1),
            ],
        ],
    ],

    'pool' => [
        'size' => env('REDIS_POOL_SIZE', 10),
        'timeout' => env('REDIS_POOL_TIMEOUT', 30),
        'max_connections' => env('REDIS_MAX_CONNECTIONS', 50),
        'min_connections' => env('REDIS_MIN_CONNECTIONS', 5),
        'max_idle_time' => env('REDIS_MAX_IDLE_TIME', 300), // seconds
    ],

    'failover' => [
        'max_retries' => env('REDIS_FAILOVER_MAX_RETRIES', 3),
        'retry_delay' => env('REDIS_FAILOVER_RETRY_DELAY', 100), // milliseconds
        'health_check_interval' => env('REDIS_HEALTH_CHECK_INTERVAL', 10), // seconds
        'connection_failure_threshold' => env('REDIS_FAILURE_THRESHOLD', 3),
    ],

    'monitoring' => [
        'enabled' => env('REDIS_MONITORING_ENABLED', true),
        'log_level' => env('REDIS_LOG_LEVEL', 'warning'),
        'metrics' => [
            'connection_count' => true,
            'command_latency' => true,
            'memory_usage' => true,
            'sentinel_status' => true,
        ],
    ],

    'backup' => [
        'enabled' => env('REDIS_BACKUP_ENABLED', false),
        'interval' => env('REDIS_BACKUP_INTERVAL', 3600), // seconds
        'retention' => env('REDIS_BACKUP_RETENTION', 168), // hours (7 days)
        'path' => env('REDIS_BACKUP_PATH', storage_path('redis-backups')),
    ],
];