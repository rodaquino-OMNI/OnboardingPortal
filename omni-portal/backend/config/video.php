<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Video Conferencing Configuration
    |--------------------------------------------------------------------------
    |
    | This file contains configuration for video conferencing services,
    | including Vonage (OpenTok), WebRTC settings, and HIPAA compliance.
    |
    */

    // Video service provider: 'vonage', 'webrtc', 'agora', 'twilio'
    'provider' => env('VIDEO_PROVIDER', 'vonage'),

    // Vonage (OpenTok) Configuration
    'vonage' => [
        'api_key' => env('VONAGE_API_KEY'),
        'api_secret' => env('VONAGE_API_SECRET'),
        'api_url' => env('VONAGE_API_URL', 'https://api.opentok.com'),
        'archive_mode' => env('VONAGE_ARCHIVE_MODE', 'manual'),
        'media_mode' => env('VONAGE_MEDIA_MODE', 'routed'), // 'routed' or 'relayed'
    ],

    // WebRTC Configuration
    'webrtc' => [
        'stun_servers' => [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
            'stun:stun3.l.google.com:19302',
            'stun:stun4.l.google.com:19302',
        ],
        'turn_servers' => [
            [
                'urls' => env('TURN_SERVER_URL', 'turn:turnserver.example.com:3478'),
                'username' => env('TURN_USERNAME'),
                'credential' => env('TURN_CREDENTIAL'),
            ],
        ],
        'ice_transport_policy' => env('ICE_TRANSPORT_POLICY', 'all'), // 'all' or 'relay'
    ],

    // HIPAA Compliance Settings
    'hipaa' => [
        'enabled' => env('VIDEO_HIPAA_ENABLED', true),
        'encryption_key' => env('VIDEO_ENCRYPTION_KEY', env('APP_KEY')),
        'audit_logging' => env('VIDEO_AUDIT_LOGGING', true),
        'session_timeout' => env('VIDEO_SESSION_TIMEOUT', 3600), // 1 hour
        'require_consent' => env('VIDEO_REQUIRE_CONSENT', true),
        'data_retention_days' => env('VIDEO_DATA_RETENTION_DAYS', 2555), // 7 years for HIPAA
    ],

    // Recording Settings
    'recording' => [
        'enabled' => env('VIDEO_RECORDING_ENABLED', true),
        'auto_record' => env('VIDEO_AUTO_RECORD', false),
        'storage_driver' => env('VIDEO_STORAGE_DRIVER', 's3'),
        'storage_path' => env('VIDEO_STORAGE_PATH', 'video-recordings'),
        'encrypt_recordings' => env('VIDEO_ENCRYPT_RECORDINGS', true),
        'max_duration_minutes' => env('VIDEO_MAX_DURATION_MINUTES', 120),
    ],

    // Session Settings
    'session' => [
        'max_participants' => env('VIDEO_MAX_PARTICIPANTS', 10),
        'default_quality' => env('VIDEO_DEFAULT_QUALITY', 'hd'), // 'sd', 'hd', 'fhd'
        'enable_chat' => env('VIDEO_ENABLE_CHAT', true),
        'enable_screen_share' => env('VIDEO_ENABLE_SCREEN_SHARE', true),
        'enable_file_share' => env('VIDEO_ENABLE_FILE_SHARE', false),
        'enable_whiteboard' => env('VIDEO_ENABLE_WHITEBOARD', false),
    ],

    // Security Settings
    'security' => [
        'require_authentication' => env('VIDEO_REQUIRE_AUTH', true),
        'session_token_lifetime' => env('VIDEO_TOKEN_LIFETIME', 3600),
        'ip_whitelist' => env('VIDEO_IP_WHITELIST') ? explode(',', env('VIDEO_IP_WHITELIST')) : [],
        'admin_ip_whitelist' => env('VIDEO_ADMIN_IP_WHITELIST') ? explode(',', env('VIDEO_ADMIN_IP_WHITELIST')) : [],
        'block_recording_download' => env('VIDEO_BLOCK_RECORDING_DOWNLOAD', false),
        'watermark_recordings' => env('VIDEO_WATERMARK_RECORDINGS', true),
    ],

    // Rate Limiting
    'rate_limits' => [
        'create_session' => [
            'max_attempts' => env('VIDEO_CREATE_SESSION_LIMIT', 10),
            'decay_minutes' => env('VIDEO_CREATE_SESSION_DECAY', 60),
        ],
        'join_session' => [
            'max_attempts' => env('VIDEO_JOIN_SESSION_LIMIT', 30),
            'decay_minutes' => env('VIDEO_JOIN_SESSION_DECAY', 60),
        ],
        'recording' => [
            'max_attempts' => env('VIDEO_RECORDING_LIMIT', 20),
            'decay_minutes' => env('VIDEO_RECORDING_DECAY', 60),
        ],
    ],

    // Analytics and Monitoring
    'analytics' => [
        'enabled' => env('VIDEO_ANALYTICS_ENABLED', true),
        'track_quality_metrics' => env('VIDEO_TRACK_QUALITY', true),
        'track_user_behavior' => env('VIDEO_TRACK_BEHAVIOR', false),
        'export_format' => env('VIDEO_ANALYTICS_FORMAT', 'json'), // 'json', 'csv'
    ],

    // Notification Settings
    'notifications' => [
        'session_start' => env('VIDEO_NOTIFY_SESSION_START', true),
        'session_end' => env('VIDEO_NOTIFY_SESSION_END', true),
        'recording_available' => env('VIDEO_NOTIFY_RECORDING', true),
        'participant_joined' => env('VIDEO_NOTIFY_PARTICIPANT', false),
    ],

    // Cost Management
    'cost' => [
        'track_usage' => env('VIDEO_TRACK_USAGE', true),
        'monthly_budget' => env('VIDEO_MONTHLY_BUDGET', 1000),
        'cost_per_minute' => env('VIDEO_COST_PER_MINUTE', 0.004),
        'alert_threshold' => env('VIDEO_COST_ALERT_THRESHOLD', 0.8), // 80% of budget
    ],

];
