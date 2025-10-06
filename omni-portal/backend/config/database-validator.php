<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Database Query Validator Configuration
    |--------------------------------------------------------------------------
    |
    | Controls runtime database query validation for security and performance.
    | Automatically disabled in testing environments to prevent test interference.
    |
    */

    'enabled' => env('DB_QUERY_VALIDATOR_ENABLED', true),

    /*
    |--------------------------------------------------------------------------
    | Excluded Environments
    |--------------------------------------------------------------------------
    |
    | Environments where validator should be disabled (e.g., testing, local dev)
    |
    */

    'exclude_environments' => ['testing', 'local'],

    /*
    |--------------------------------------------------------------------------
    | Logging Configuration
    |--------------------------------------------------------------------------
    |
    | Whether to log violations to application logs
    |
    */

    'log_violations' => env('DB_QUERY_VALIDATOR_LOG', true),

    /*
    |--------------------------------------------------------------------------
    | Strict Mode
    |--------------------------------------------------------------------------
    |
    | When enabled, throws exceptions on violations. When disabled, only logs.
    |
    */

    'strict_mode' => env('DB_QUERY_VALIDATOR_STRICT', true),

];
