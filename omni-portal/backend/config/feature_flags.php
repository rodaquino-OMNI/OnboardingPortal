<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Feature Flags Configuration
    |--------------------------------------------------------------------------
    |
    | Feature flags enable progressive rollout and quick rollback.
    | Flags can be overridden via database or environment variables.
    |
    */

    'slice_a_registration' => env('FEATURE_SLICE_A_REGISTRATION', false),
    'slice_b_documents' => env('FEATURE_SLICE_B_DOCUMENTS', false),

    'gamification_enabled' => env('FEATURE_GAMIFICATION', true),
    'gamification_badges' => env('FEATURE_GAMIFICATION_BADGES', true),
    'gamification_streaks' => env('FEATURE_GAMIFICATION_STREAKS', true),
    'gamification_challenges' => env('FEATURE_GAMIFICATION_CHALLENGES', false),

    'mfa_enabled' => env('FEATURE_MFA_ENABLED', false),
    'mfa_required_for_admin' => env('FEATURE_MFA_REQUIRED_ADMIN', true),

    'ocr_enabled' => env('FEATURE_OCR_ENABLED', true),
    'ocr_fraud_detection' => env('FEATURE_OCR_FRAUD_DETECTION', true),

    'analytics_enabled' => env('FEATURE_ANALYTICS_ENABLED', true),
    'analytics_pii_hashing' => env('FEATURE_ANALYTICS_PII_HASHING', true),
];
