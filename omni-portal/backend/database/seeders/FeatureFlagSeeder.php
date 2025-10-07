<?php

namespace Database\Seeders;

use App\Models\FeatureFlag;
use Illuminate\Database\Seeder;

/**
 * FeatureFlagSeeder - Seed feature flags for gradual rollout
 *
 * Feature flags control access to new features during development and rollout:
 * - sliceB_documents: Document upload flow (Sprint 2B)
 * - sliceC_health: Health questionnaire (Sprint 2C)
 *
 * Default: All flags disabled (rollout_percentage: 0)
 *
 * Enable flags via:
 * - artisan command: php artisan feature:enable sliceC_health
 * - service: app(FeatureFlagService::class)->toggle('sliceC_health')
 *
 * @see app/Services/FeatureFlagService.php
 * @see app/Http/Middleware/FeatureFlagMiddleware.php
 */
class FeatureFlagSeeder extends Seeder
{
    /**
     * Run the database seeds
     */
    public function run(): void
    {
        // Slice B: Document Upload Flow
        FeatureFlag::updateOrCreate(
            ['key' => 'sliceB_documents'],
            [
                'name' => 'Slice B - Document Upload Flow',
                'description' => 'Feature-flagged document upload with S3 presigned URLs and async OCR',
                'enabled' => false, // Default off
                'rollout_percentage' => 0,
                'environments' => ['production', 'staging', 'testing'],
            ]
        );

        // Slice C: Health Questionnaire
        FeatureFlag::updateOrCreate(
            ['key' => 'sliceC_health'],
            [
                'name' => 'Slice C - Health Questionnaire',
                'description' => 'Adaptive health questionnaire with PHI encryption and risk scoring',
                'enabled' => false, // Default off
                'rollout_percentage' => 0,
                'environments' => ['production', 'staging', 'testing'],
            ]
        );

        // Gamification System (existing - should be enabled)
        FeatureFlag::updateOrCreate(
            ['key' => 'gamification'],
            [
                'name' => 'Gamification System',
                'description' => 'Points, levels, badges, and leaderboards',
                'enabled' => true,
                'rollout_percentage' => 100,
                'environments' => ['production', 'staging', 'testing'],
            ]
        );

        // Registration Flow (Sprint 2A - should be enabled)
        FeatureFlag::updateOrCreate(
            ['key' => 'registration_flow'],
            [
                'name' => 'Registration Flow',
                'description' => 'Multi-step registration with email verification',
                'enabled' => true,
                'rollout_percentage' => 100,
                'environments' => ['production', 'staging', 'testing'],
            ]
        );
    }
}
