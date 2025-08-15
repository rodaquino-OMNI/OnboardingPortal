<?php

use Illuminate\Support\Str;

return [

    /*
    |--------------------------------------------------------------------------
    | Default Database Connection Name
    |--------------------------------------------------------------------------
    */

    'default' => env('DB_CONNECTION', 'mysql'),

    /*
    |--------------------------------------------------------------------------
    | Database Connections
    |--------------------------------------------------------------------------
    */

    'connections' => [

        'sqlite' => [
            'driver' => 'sqlite',
            'url' => env('DATABASE_URL'),
            'database' => env('DB_DATABASE', database_path('database.sqlite')),
            'prefix' => '',
            'foreign_key_constraints' => env('DB_FOREIGN_KEYS', true),
        ],

        'mysql' => [
            'driver' => 'mysql',
            'url' => env('DATABASE_URL'),
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '3306'),
            'database' => env('DB_DATABASE', 'omni_portal'),
            'username' => env('DB_USERNAME', 'root'),
            'password' => env('DB_PASSWORD', ''),
            'unix_socket' => env('DB_SOCKET', ''),
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => extension_loaded('pdo_mysql') ? array_filter([
                PDO::MYSQL_ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
            ]) : [],
        ],

        'pgsql' => [
            'driver' => 'pgsql',
            'url' => env('DATABASE_URL'),
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'omni_portal'),
            'username' => env('DB_USERNAME', 'root'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'prefix_indexes' => true,
            'search_path' => 'public',
            'sslmode' => 'prefer',
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Migration Repository Table
    |--------------------------------------------------------------------------
    */

    'migrations' => 'migrations',

    /*
    |--------------------------------------------------------------------------
    | Redis Databases
    |--------------------------------------------------------------------------
    */

    'redis' => [

        'client' => env('REDIS_CLIENT', 'predis'),

        'options' => [
            'cluster' => env('REDIS_CLUSTER', 'redis'),
            'prefix' => env('REDIS_PREFIX', Str::slug(env('APP_NAME', 'laravel'), '_').'_database_'),
            // Connection pooling settings
            'connection_timeout' => env('REDIS_CONNECTION_TIMEOUT', 5.0),
            'read_write_timeout' => env('REDIS_READ_WRITE_TIMEOUT', 5.0),
            'tcp_keepalive' => env('REDIS_TCP_KEEPALIVE', 1),
            'compression' => env('REDIS_COMPRESSION', 'lz4'),
            'serialization' => env('REDIS_SERIALIZATION', 'igbinary'),
            // Pool configuration
            'pool' => [
                'size' => env('REDIS_POOL_SIZE', 10),
                'timeout' => env('REDIS_POOL_TIMEOUT', 30),
                'max_connections' => env('REDIS_MAX_CONNECTIONS', 50),
                'min_connections' => env('REDIS_MIN_CONNECTIONS', 5),
            ],
        ],

        'default' => [
            'url' => env('REDIS_URL'),
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'username' => env('REDIS_USERNAME'),
            'password' => env('REDIS_PASSWORD'),
            'port' => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_DB', '0'),
            // Connection pooling and persistence
            'persistent' => env('REDIS_PERSISTENT', true),
            'connection_timeout' => env('REDIS_CONNECTION_TIMEOUT', 5.0),
            'read_timeout' => env('REDIS_READ_TIMEOUT', 5.0),
            'retry_interval' => env('REDIS_RETRY_INTERVAL', 100),
            'tcp_keepalive' => env('REDIS_TCP_KEEPALIVE', 1),
        ],

        'cache' => [
            'url' => env('REDIS_URL'),
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'username' => env('REDIS_USERNAME'),
            'password' => env('REDIS_PASSWORD'),
            'port' => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_CACHE_DB', '1'),
            // Connection pooling and persistence
            'persistent' => env('REDIS_CACHE_PERSISTENT', true),
            'connection_timeout' => env('REDIS_CACHE_CONNECTION_TIMEOUT', 3.0),
            'read_timeout' => env('REDIS_CACHE_READ_TIMEOUT', 3.0),
            'retry_interval' => env('REDIS_CACHE_RETRY_INTERVAL', 50),
            'tcp_keepalive' => env('REDIS_CACHE_TCP_KEEPALIVE', 1),
        ],

        'session' => [
            'url' => env('REDIS_URL'),
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'username' => env('REDIS_USERNAME'),
            'password' => env('REDIS_PASSWORD'),
            'port' => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_SESSION_DB', '3'),
            // Connection pooling and persistence
            'persistent' => env('REDIS_SESSION_PERSISTENT', true),
            'connection_timeout' => env('REDIS_SESSION_CONNECTION_TIMEOUT', 2.0),
            'read_timeout' => env('REDIS_SESSION_READ_TIMEOUT', 2.0),
            'retry_interval' => env('REDIS_SESSION_RETRY_INTERVAL', 25),
            'tcp_keepalive' => env('REDIS_SESSION_TCP_KEEPALIVE', 1),
            'options' => [
                'prefix' => env('SESSION_PREFIX', 'sess:'),
            ],
        ],

        'horizon' => [
            'url' => env('REDIS_URL'),
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'username' => env('REDIS_USERNAME'),
            'password' => env('REDIS_PASSWORD'),
            'port' => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_HORIZON_DB', '2'),
            // Connection pooling and persistence
            'persistent' => env('REDIS_HORIZON_PERSISTENT', true),
            'connection_timeout' => env('REDIS_HORIZON_CONNECTION_TIMEOUT', 10.0),
            'read_timeout' => env('REDIS_HORIZON_READ_TIMEOUT', 10.0),
            'retry_interval' => env('REDIS_HORIZON_RETRY_INTERVAL', 200),
            'tcp_keepalive' => env('REDIS_HORIZON_TCP_KEEPALIVE', 1),
            'options' => [
                'prefix' => env('HORIZON_PREFIX', 'horizon:'),
            ],
        ],

    ],

];