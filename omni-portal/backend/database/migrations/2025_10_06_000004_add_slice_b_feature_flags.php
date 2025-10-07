<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Migration: Add Slice B Feature Flags
 *
 * Purpose: Enable gradual rollout of Slice B Documents flow
 *
 * Feature Flags:
 * - sliceB_documents: Enable/disable Slice B documents upload flow
 *
 * Rollout Strategy:
 * 1. Start at 0% (disabled)
 * 2. Enable for internal testing (development)
 * 3. Gradual rollout: 10% → 25% → 50% → 100%
 *
 * @see app/Services/FeatureFlagService.php
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Check if feature_flags table exists
        if (!DB::getSchemaBuilder()->hasTable('feature_flags')) {
            throw new \RuntimeException(
                'feature_flags table does not exist. Run 2025_09_30_000001_create_feature_flags_table.php first'
            );
        }

        // Insert Slice B feature flag
        DB::table('feature_flags')->insertOrIgnore([
            [
                'key' => 'sliceB_documents',
                'enabled' => false, // Start disabled
                'rollout_percentage' => 0, // Start at 0% rollout
                'description' => 'Enable Slice B Documents upload flow with presigned URLs',
                'environments' => json_encode(['development', 'staging', 'production']),
                'metadata' => json_encode([
                    'slice' => 'B',
                    'feature_type' => 'documents_flow',
                    'owner_team' => 'onboarding',
                    'rollout_strategy' => 'gradual',
                    'canary_group' => 'internal_testers',
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('feature_flags')
            ->where('key', 'sliceB_documents')
            ->delete();
    }
};
