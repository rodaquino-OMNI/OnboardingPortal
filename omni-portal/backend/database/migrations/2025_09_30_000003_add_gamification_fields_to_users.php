<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Add gamification tracking fields per GAMIFICATION_SPEC.md
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->integer('points_balance')->default(0)->after('password');
            $table->integer('current_level')->default(1)->after('points_balance');
            $table->integer('current_streak')->default(0)->after('current_level');
            $table->timestamp('last_action_at')->nullable()->after('current_streak');
            $table->timestamp('streak_started_at')->nullable()->after('last_action_at');

            // Indexes for leaderboards and queries
            $table->index('points_balance');
            $table->index('current_level');
            $table->index('current_streak');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['points_balance']);
            $table->dropIndex(['current_level']);
            $table->dropIndex(['current_streak']);

            $table->dropColumn([
                'points_balance',
                'current_level',
                'current_streak',
                'last_action_at',
                'streak_started_at',
            ]);
        });
    }
};
