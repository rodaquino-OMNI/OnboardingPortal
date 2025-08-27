<?php

use Illuminate\Support\Str;

return [

    /*
    |--------------------------------------------------------------------------
    | Default Database Connection Name
    |--------------------------------------------------------------------------
    */

    'default' => env('DB_CONNECTION', 'sqlite'),

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
            'password' => env('DB_PASSWORD'),
            'unix_socket' => env('DB_SOCKET', ''),
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            // Performance optimized options
            'options' => extension_loaded('pdo_mysql') ? array_filter([
                PDO::MYSQL_ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
                PDO::ATTR_PERSISTENT => env('DB_PERSISTENT', false),
                PDO::ATTR_TIMEOUT => env('DB_TIMEOUT', 3), // Reduced from 5 to 3 seconds
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci, sql_mode='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ZERO_DATE,NO_ZERO_IN_DATE', time_zone='+00:00', wait_timeout=28800, interactive_timeout=28800",
                // Connection pooling optimizations
                PDO::MYSQL_ATTR_LOCAL_INFILE => false,
                PDO::MYSQL_ATTR_COMPRESS => env('DB_COMPRESS', false),
            ]) : [],
            // Additional Laravel-specific optimizations
            'pool' => [
                'size' => env('DB_POOL_SIZE', 10),
                'timeout' => env('DB_POOL_TIMEOUT', 30),
                'max_connections' => env('DB_MAX_CONNECTIONS', 50),
                'min_connections' => env('DB_MIN_CONNECTIONS', 5),
            ],
        ],

        // MySQL HA Configuration with Read/Write Splitting
        'mysql-ha' => [
            'driver' => 'mysql',
            'read' => [
                'host' => [
                    env('DB_READ_HOST_1', '127.0.0.1:3307'), // Slave 1
                    env('DB_READ_HOST_2', '127.0.0.1:3308'), // Slave 2
                ],
                'port' => env('DB_READ_PORT', '3306'),
                'database' => env('DB_DATABASE', 'omni_portal'),
                'username' => env('DB_READ_USERNAME', 'omni_reader'),
                'password' => env('DB_READ_PASSWORD'),
            ],
            'write' => [
                'host' => env('DB_WRITE_HOST', '127.0.0.1'), // Master
                'port' => env('DB_WRITE_PORT', '3306'),
                'database' => env('DB_DATABASE', 'omni_portal'),
                'username' => env('DB_WRITE_USERNAME', 'omni_user'),
                'password' => env('DB_WRITE_PASSWORD'),
            ],
            'sticky' => true,
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => [
                PDO::ATTR_TIMEOUT => 5,
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET sql_mode='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ZERO_DATE,NO_ZERO_IN_DATE'",
            ],
        ],

        // ProxySQL Connection (recommended for production)
        'proxysql' => [
            'driver' => 'mysql',
            'host' => env('PROXYSQL_HOST', '127.0.0.1'),
            'port' => env('PROXYSQL_PORT', '6033'),
            'database' => env('DB_DATABASE', 'omni_portal'),
            'username' => env('DB_USERNAME', 'omni_user'),
            'password' => env('DB_PASSWORD'),
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => [
                PDO::ATTR_TIMEOUT => 10,
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
                PDO::ATTR_PERSISTENT => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET sql_mode='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ZERO_DATE,NO_ZERO_IN_DATE'",
            ],
        ],

        // Direct Master Connection (for admin/maintenance)
        'mysql-master' => [
            'driver' => 'mysql',
            'host' => env('DB_MASTER_HOST', '127.0.0.1'),
            'port' => env('DB_MASTER_PORT', '3306'),
            'database' => env('DB_DATABASE', 'omni_portal'),
            'username' => env('DB_MASTER_USERNAME', 'omni_user'),
            'password' => env('DB_MASTER_PASSWORD'),
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => [
                PDO::ATTR_TIMEOUT => 5,
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ],
        ],

        // Direct Slave Connections (for specific read operations)
        'mysql-slave-1' => [
            'driver' => 'mysql',
            'host' => env('DB_SLAVE1_HOST', '127.0.0.1'),
            'port' => env('DB_SLAVE1_PORT', '3307'),
            'database' => env('DB_DATABASE', 'omni_portal'),
            'username' => env('DB_SLAVE_USERNAME', 'omni_reader'),
            'password' => env('DB_SLAVE_PASSWORD'),
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => [
                PDO::ATTR_TIMEOUT => 5,
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ],
        ],

        'mysql-slave-2' => [
            'driver' => 'mysql',
            'host' => env('DB_SLAVE2_HOST', '127.0.0.1'),
            'port' => env('DB_SLAVE2_PORT', '3308'),
            'database' => env('DB_DATABASE', 'omni_portal'),
            'username' => env('DB_SLAVE_USERNAME', 'omni_reader'),
            'password' => env('DB_SLAVE_PASSWORD'),
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => [
                PDO::ATTR_TIMEOUT => 5,
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ],
        ],

        'pgsql' => [
            'driver' => 'pgsql',
            'url' => env('DATABASE_URL'),
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'omni_portal'),
            'username' => env('DB_USERNAME', 'root'),
            'password' => env('DB_PASSWORD'),
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

        'client' => env('REDIS_CLIENT', 'phpredis'),

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
            // Sentinel configuration for High Availability
            'sentinel' => [
                'enabled' => env('REDIS_SENTINEL_ENABLED', false),
                'master_name' => env('REDIS_SENTINEL_MASTER', 'mymaster'),
                'service' => [
                    [
                        'host' => env('REDIS_SENTINEL_HOST_1', '127.0.0.1'),
                        'port' => env('REDIS_SENTINEL_PORT_1', 26379),
                    ],
                    [
                        'host' => env('REDIS_SENTINEL_HOST_2', '127.0.0.1'),
                        'port' => env('REDIS_SENTINEL_PORT_2', 26380),
                    ],
                    [
                        'host' => env('REDIS_SENTINEL_HOST_3', '127.0.0.1'),
                        'port' => env('REDIS_SENTINEL_PORT_3', 26381),
                    ],
                ],
                'options' => [
                    'sentinel_timeout' => env('REDIS_SENTINEL_TIMEOUT', 3.0),
                    'retry_limit' => env('REDIS_SENTINEL_RETRY_LIMIT', 3),
                    'update_sentinels' => env('REDIS_SENTINEL_UPDATE', true),
                ],
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