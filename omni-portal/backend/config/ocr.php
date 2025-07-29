<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default OCR Driver
    |--------------------------------------------------------------------------
    |
    | This option controls the default OCR driver that will be used by the
    | framework. The default is "enhanced" which tries AWS Textract first
    | and falls back to Tesseract if needed.
    |
    */

    'default' => env('OCR_DRIVER', 'enhanced'),

    /*
    |--------------------------------------------------------------------------
    | OCR Service Drivers
    |--------------------------------------------------------------------------
    |
    | Here you may configure OCR drivers for your application. Each driver
    | has different capabilities and cost implications.
    |
    */

    'drivers' => [

        'enhanced' => [
            'driver' => 'enhanced',
            'primary' => 'textract',
            'fallback' => 'tesseract',
            'max_retries' => 3,
            'retry_delay' => 1000, // milliseconds
            'timeout' => 30, // seconds
        ],

        'textract' => [
            'driver' => 'textract',
            'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
            'version' => 'latest',
            'credentials' => [
                'key' => env('AWS_ACCESS_KEY_ID'),
                'secret' => env('AWS_SECRET_ACCESS_KEY'),
            ],
            'bucket' => env('AWS_BUCKET'),
            'features' => ['FORMS', 'TABLES', 'SIGNATURES'],
            'max_pages' => 100,
            'cost_per_page' => 0.05, // USD per page for monitoring
        ],

        'tesseract' => [
            'driver' => 'tesseract',
            'languages' => ['por', 'eng'],
            'config' => [
                'preserve_interword_spaces' => 1,
                'tessedit_char_whitelist' => '',
                'tessedit_pageseg_mode' => 3,
            ],
            'image_preprocessing' => true,
            'dpi' => 300,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Quality Thresholds
    |--------------------------------------------------------------------------
    |
    | These settings control when to fallback to alternative OCR methods
    | based on confidence scores and other quality metrics.
    |
    */

    'quality' => [
        'min_confidence' => 70,
        'fallback_threshold' => 50,
        'retry_threshold' => 30,
        'text_length_threshold' => 50,
    ],

    /*
    |--------------------------------------------------------------------------
    | Cost Monitoring
    |--------------------------------------------------------------------------
    |
    | Enable cost tracking and set budgets for OCR processing.
    |
    */

    'monitoring' => [
        'enabled' => env('OCR_MONITORING_ENABLED', true),
        'daily_budget' => env('OCR_DAILY_BUDGET', 50.00), // USD
        'monthly_budget' => env('OCR_MONTHLY_BUDGET', 1000.00), // USD
        'alert_threshold' => 80, // percentage of budget
        'log_channel' => 'ocr',
    ],

    /*
    |--------------------------------------------------------------------------
    | Cost Limits and Optimization
    |--------------------------------------------------------------------------
    |
    | Configure cost limits and optimization strategies for AWS Textract.
    |
    */

    'cost_limits' => [
        'daily' => env('OCR_COST_LIMIT_DAILY', 1000.00), // USD
        'weekly' => env('OCR_COST_LIMIT_WEEKLY', 5000.00), // USD
        'monthly' => env('OCR_COST_LIMIT_MONTHLY', 25000.00), // USD
    ],

    /*
    |--------------------------------------------------------------------------
    | Document Processing Settings
    |--------------------------------------------------------------------------
    |
    | Configuration for document preprocessing and optimization.
    |
    */

    'processing' => [
        'max_file_size' => env('OCR_MAX_FILE_SIZE', 10485760), // 10MB
        'supported_formats' => ['jpg', 'jpeg', 'png', 'pdf', 'tiff'],
        'image_optimization' => [
            'enabled' => true,
            'max_width' => 2480,
            'max_height' => 3508,
            'quality' => 90,
            'format' => 'png',
        ],
        'pdf_settings' => [
            'dpi' => 300,
            'format' => 'png',
            'pages' => 'all', // or specific page numbers
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Caching Configuration
    |--------------------------------------------------------------------------
    |
    | OCR results caching to avoid reprocessing the same documents.
    |
    */

    'cache' => [
        'enabled' => env('OCR_CACHE_ENABLED', true),
        'ttl' => env('OCR_CACHE_TTL', 3600 * 24 * 7), // 1 week
        'prefix' => 'ocr_result',
        'driver' => env('OCR_CACHE_DRIVER', 'redis'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Cost Limits Configuration
    |--------------------------------------------------------------------------
    |
    | Set daily, weekly, and monthly cost limits for Textract processing.
    |
    */

    'cost_limits' => [
        'daily' => env('OCR_COST_LIMIT_DAILY', 1000.00), // USD
        'weekly' => env('OCR_COST_LIMIT_WEEKLY', 5000.00), // USD
        'monthly' => env('OCR_COST_LIMIT_MONTHLY', 25000.00), // USD
    ],

    /*
    |--------------------------------------------------------------------------
    | Security Settings
    |--------------------------------------------------------------------------
    |
    | Security configurations for OCR processing.
    |
    */

    'security' => [
        'encrypt_results' => env('OCR_ENCRYPT_RESULTS', true),
        'secure_temp_files' => true,
        'max_processing_time' => 300, // 5 minutes
        'rate_limiting' => [
            'enabled' => true,
            'max_requests_per_minute' => 10,
            'max_requests_per_hour' => 100,
        ],
    ],

];