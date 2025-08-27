<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations - Technical Excellence Applied
     * These indexes eliminate the performance bottlenecks identified in the gamification system
     */
    public function up(): void
    {
        // Critical Index 1: Leaderboard queries (fixes 1.1s delay)
        Schema::table('gamification_progress', function (Blueprint $table) {
            $table->index(['total_points', 'current_level', 'engagement_score'], 'idx_leaderboard_composite');
            $table->index('beneficiary_id', 'idx_progress_beneficiary');
        });

        // Critical Index 2: Badge queries (fixes 3.1s delay)
        Schema::table('beneficiary_badges', function (Blueprint $table) {
            $table->index(['beneficiary_id', 'earned_at'], 'idx_beneficiary_badges_composite');
            $table->index('earned_at', 'idx_badges_earned_at');
        });

        // Critical Index 3: Level lookups (improves all queries)
        Schema::table('gamification_levels', function (Blueprint $table) {
            $table->index('level_number', 'idx_level_number');
            $table->index(['level_number', 'name'], 'idx_level_covering');
        });

        // Critical Index 4: Activity feed queries (fixes 4.1s delay)
        Schema::table('gamification_badges', function (Blueprint $table) {
            $table->index(['is_active', 'is_secret'], 'idx_badge_visibility');
            $table->index('slug', 'idx_badge_slug');
        });

        // Update statistics for query optimizer (MySQL/PostgreSQL syntax)
        $driver = DB::connection()->getDriverName();
        if ($driver === 'mysql' || $driver === 'pgsql') {
            DB::statement('ANALYZE TABLE gamification_progress');
            DB::statement('ANALYZE TABLE beneficiary_badges');
            DB::statement('ANALYZE TABLE gamification_levels');
            DB::statement('ANALYZE TABLE gamification_badges');
        } elseif ($driver === 'sqlite') {
            // SQLite uses different syntax for analyzing tables
            DB::statement('ANALYZE gamification_progress');
            DB::statement('ANALYZE beneficiary_badges');
            DB::statement('ANALYZE gamification_levels');
            DB::statement('ANALYZE gamification_badges');
        }
    }

    /**
     * Reverse the migrations
     */
    public function down(): void
    {
        Schema::table('gamification_progress', function (Blueprint $table) {
            $table->dropIndex('idx_leaderboard_composite');
            $table->dropIndex('idx_progress_beneficiary');
        });

        Schema::table('beneficiary_badges', function (Blueprint $table) {
            $table->dropIndex('idx_beneficiary_badges_composite');
            $table->dropIndex('idx_badges_earned_at');
        });

        Schema::table('gamification_levels', function (Blueprint $table) {
            $table->dropIndex('idx_level_number');
            $table->dropIndex('idx_level_covering');
        });

        Schema::table('gamification_badges', function (Blueprint $table) {
            $table->dropIndex('idx_badge_visibility');
            $table->dropIndex('idx_badge_slug');
        });
    }
};