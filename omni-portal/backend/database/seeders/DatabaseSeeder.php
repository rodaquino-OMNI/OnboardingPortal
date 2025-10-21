<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * DatabaseSeeder - Main seeder orchestrator
 *
 * Runs all seeders in correct dependency order:
 * 1. TestUserSeeder - Test users for integration testing
 * 2. FeatureFlagSeeder - Feature flags (no dependencies)
 * 3. QuestionnaireSeeder - Health questionnaire templates (requires users)
 *
 * Usage:
 * - php artisan db:seed                     # Run all seeders
 * - php artisan db:seed --class=FeatureFlagSeeder  # Run specific seeder
 * - php artisan migrate:fresh --seed        # Fresh migration with seeding
 */
class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->command->info('🌱 Starting database seeding...');

        // 1. Test Users (for testing)
        $this->call(TestUserSeeder::class);

        // 2. Feature Flags (independent)
        $this->call(FeatureFlagSeeder::class);

        // 3. Questionnaire Templates (requires users table)
        $this->call(QuestionnaireSeeder::class);

        $this->command->info('✅ Database seeding complete!');
    }
}
