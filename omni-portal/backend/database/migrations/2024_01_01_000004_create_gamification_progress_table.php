<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('gamification_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('beneficiary_id')->constrained()->onDelete('cascade');
            $table->integer('total_points')->default(0);
            $table->integer('current_level')->default(1);
            $table->integer('points_to_next_level')->default(100);
            $table->integer('streak_days')->default(0);
            $table->date('last_activity_date')->nullable();
            $table->integer('tasks_completed')->default(0);
            $table->integer('perfect_forms')->default(0); // Forms completed without errors
            $table->integer('documents_uploaded')->default(0);
            $table->integer('health_assessments_completed')->default(0);
            $table->boolean('profile_completed')->default(false);
            $table->boolean('onboarding_completed')->default(false);
            $table->json('badges_earned')->nullable(); // Array of badge IDs
            $table->json('achievements')->nullable(); // Detailed achievement data
            $table->json('daily_challenges')->nullable(); // Current daily challenges
            $table->json('weekly_goals')->nullable(); // Weekly goals progress
            $table->decimal('engagement_score', 5, 2)->default(0); // 0-100 score
            $table->timestamp('last_badge_earned_at')->nullable();
            $table->timestamp('last_level_up_at')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('beneficiary_id');
            $table->index('current_level');
            $table->index('total_points');
            $table->index('last_activity_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('gamification_progress');
    }
};