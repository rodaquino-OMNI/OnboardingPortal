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
        Schema::create('beneficiary_badges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('beneficiary_id')->constrained()->onDelete('cascade');
            $table->foreignId('gamification_badge_id')->constrained()->onDelete('cascade');
            $table->timestamp('earned_at');
            $table->integer('earned_count')->default(1); // For badges that can be earned multiple times
            $table->json('earned_context')->nullable(); // Context of how it was earned
            $table->boolean('is_featured')->default(false); // If user wants to showcase this badge
            $table->timestamps();
            
            // Indexes with proper constraint name (MySQL 64-char limit)
            $table->unique(['beneficiary_id', 'gamification_badge_id', 'earned_count'], 'bb_user_badge_count_unique');
            $table->index('beneficiary_id', 'bb_beneficiary_id_index');
            $table->index('gamification_badge_id', 'bb_badge_id_index');
            $table->index('earned_at', 'bb_earned_at_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('beneficiary_badges');
    }
};