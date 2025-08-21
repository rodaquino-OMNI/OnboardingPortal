<?php

return [
    
    /*
    |--------------------------------------------------------------------------
    | Security Configuration
    |--------------------------------------------------------------------------
    |
    | This file contains all security-related configuration options for the
    | application including CSRF, session, SQL protection, and more.
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Session Security
    |--------------------------------------------------------------------------
    */
    
    'session' => [
        'encrypt' => env('SESSION_ENCRYPT', true),
        'fingerprinting' => env('SESSION_FINGERPRINTING', true),
        'rotate_sensitive' => env('SESSION_ROTATE_SENSITIVE', true),
        'validate_ip' => env('SESSION_VALIDATE_IP', true),
        'validate_user_agent' => env('SESSION_VALIDATE_USER_AGENT', true),
        'inactive_timeout' => env('SESSION_INACTIVE_TIMEOUT', 60),
        'max_failed_attempts' => env('MAX_FAILED_ATTEMPTS', 5),
        'lockout_duration' => env('LOCKOUT_DURATION', 30),
    ],

    /*
    |--------------------------------------------------------------------------
    | CSRF Protection
    |--------------------------------------------------------------------------
    */
    
    'csrf' => [
        'enhanced_protection' => env('CSRF_ENHANCED_PROTECTION', true),
        'double_submit_cookie' => env('CSRF_DOUBLE_SUBMIT_COOKIE', true),
        'validate_origin' => env('CSRF_VALIDATE_ORIGIN', true),
        'validate_referer' => env('CSRF_VALIDATE_REFERER', true),
        'strict_referer' => env('CSRF_STRICT_REFERER', false),
        'operation_tokens' => env('CSRF_OPERATION_TOKENS', true),
        'rate_limit' => env('CSRF_RATE_LIMIT', 10),
    ],

    /*
    |--------------------------------------------------------------------------
    | SQL Injection Protection
    |--------------------------------------------------------------------------
    */
    
    'sql' => [
        'protection_enabled' => env('SQL_INJECTION_PROTECTION', true),
        'monitoring' => env('SQL_MONITORING', true),
        'block_high_risk' => env('SQL_BLOCK_HIGH_RISK', true),
        'log_suspicious' => env('SQL_LOG_SUSPICIOUS', true),
        'rate_limit' => env('SQL_PROTECTION_RATE_LIMIT', 50),
        'auto_block_ips' => env('SQL_AUTO_BLOCK_IPS', true),
        'block_threshold' => env('SQL_BLOCK_THRESHOLD', 3),
        'block_duration' => env('SQL_BLOCK_DURATION', 60),
    ],

    /*
    |--------------------------------------------------------------------------
    | Query Validator
    |--------------------------------------------------------------------------
    */
    
    'query_validator_enabled' => env('SECURITY_QUERY_VALIDATOR_ENABLED', true),

    /*
    |--------------------------------------------------------------------------
    | Database Query Monitoring
    |--------------------------------------------------------------------------
    */
    
    'query' => [
        'monitoring' => env('QUERY_MONITORING', true),
        'log_dangerous' => env('QUERY_LOG_DANGEROUS', true),
        'log_suspicious' => env('QUERY_LOG_SUSPICIOUS', true),
        'max_execution_time' => env('QUERY_MAX_EXECUTION_TIME', 5000),
        'max_joins' => env('QUERY_MAX_JOINS', 5),
        'max_subqueries' => env('QUERY_MAX_SUBQUERIES', 3),
    ],

    /*
    |--------------------------------------------------------------------------
    | Input Validation
    |--------------------------------------------------------------------------
    */
    
    'input' => [
        'enhanced_validation' => env('INPUT_ENHANCED_VALIDATION', true),
        'max_text_length' => env('INPUT_MAX_TEXT_LENGTH', 1000),
        'max_textarea_length' => env('INPUT_MAX_TEXTAREA_LENGTH', 5000),
    ],

    /*
    |--------------------------------------------------------------------------
    | Security Headers
    |--------------------------------------------------------------------------
    */
    
    'headers' => [
        'frame_options' => env('SECURITY_FRAME_OPTIONS', 'DENY'),
        'content_type_options' => 'nosniff',
        'xss_protection' => '1; mode=block',
        'referrer_policy' => env('SECURITY_REFERRER_POLICY', 'strict-origin-when-cross-origin'),
        'hsts' => env('SECURITY_HSTS', 'max-age=31536000; includeSubDomains; preload'),
        'permissions_policy' => 'camera=(), microphone=(), geolocation=()',
    ],

    /*
    |--------------------------------------------------------------------------
    | Rate Limiting
    |--------------------------------------------------------------------------
    */
    
    'rate_limits' => [
        'api' => env('RATE_LIMIT_API', 60),
        'login' => env('RATE_LIMIT_LOGIN', 5),
        'password_reset' => env('RATE_LIMIT_PASSWORD_RESET', 3),
        'registration' => env('RATE_LIMIT_REGISTRATION', 3),
        'upload' => env('RATE_LIMIT_UPLOAD', 10),
    ],

    /*
    |--------------------------------------------------------------------------
    | IP Blocking
    |--------------------------------------------------------------------------
    */
    
    'ip_blocking' => [
        'enabled' => env('IP_BLOCKING_ENABLED', true),
        'whitelist' => explode(',', env('IP_WHITELIST', '127.0.0.1,::1')),
        'max_violations' => env('IP_MAX_VIOLATIONS', 10),
        'block_duration' => env('IP_BLOCK_DURATION', 60),
    ],

    /*
    |--------------------------------------------------------------------------
    | File Upload Security
    |--------------------------------------------------------------------------
    */
    
    'file_upload' => [
        'antivirus_enabled' => env('ANTIVIRUS_ENABLED', false),
        'antivirus_command' => env('ANTIVIRUS_COMMAND', 'clamscan'),
        'max_upload_size' => env('MAX_UPLOAD_SIZE', 10485760), // 10MB
        'allowed_extensions' => explode(',', env('ALLOWED_FILE_TYPES', 'jpeg,jpg,png,pdf,doc,docx')),
    ],

    /*
    |--------------------------------------------------------------------------
    | Logging and Monitoring
    |--------------------------------------------------------------------------
    */
    
    'logging' => [
        'security_events' => env('LOG_SECURITY_EVENTS', true),
        'failed_auth' => env('LOG_FAILED_AUTH', true),
        'suspicious_activity' => env('LOG_SUSPICIOUS_ACTIVITY', true),
        'send_alerts' => env('SECURITY_SEND_ALERTS', false),
        'alert_emails' => explode(',', env('SECURITY_ALERT_EMAILS', 'admin@example.com')),
    ],

    /*
    |--------------------------------------------------------------------------
    | Password Policy
    |--------------------------------------------------------------------------
    */
    
    'password' => [
        'min_length' => env('PASSWORD_MIN_LENGTH', 8),
        'require_uppercase' => env('PASSWORD_REQUIRE_UPPERCASE', true),
        'require_lowercase' => env('PASSWORD_REQUIRE_LOWERCASE', true),
        'require_numbers' => env('PASSWORD_REQUIRE_NUMBERS', true),
        'require_symbols' => env('PASSWORD_REQUIRE_SYMBOLS', true),
        'check_pwned' => env('PASSWORD_CHECK_PWNED', true),
        'history_count' => env('PASSWORD_HISTORY_COUNT', 5),
        'expiry_days' => env('PASSWORD_EXPIRY_DAYS', 90),
    ],

    /*
    |--------------------------------------------------------------------------
    | Two-Factor Authentication
    |--------------------------------------------------------------------------
    */
    
    '2fa' => [
        'enabled' => env('2FA_ENABLED', true),
        'force_for_admins' => env('2FA_FORCE_FOR_ADMINS', true),
        'recovery_codes' => env('2FA_RECOVERY_CODES', 8),
        'qr_code_size' => env('2FA_QR_CODE_SIZE', 200),
    ],

    /*
    |--------------------------------------------------------------------------
    | Content Security Policy
    |--------------------------------------------------------------------------
    */
    
    'csp' => [
        'enabled' => env('CSP_ENABLED', true),
        'report_only' => env('CSP_REPORT_ONLY', false),
        'report_uri' => env('CSP_REPORT_URI', null),
    ],

];