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
        Schema::create('gamification_levels', function (Blueprint $table) {
            $table->id();
            $table->integer('level_number')->unique();
            $table->string('name');
            $table->string('title')->nullable(); // e.g., "Health Novice", "Wellness Expert"
            $table->integer('points_required');
            $table->integer('points_to_next')->nullable();
            $table->string('color_theme')->default('#3B82F6'); // Level color
            $table->string('icon')->nullable();
            $table->json('rewards')->nullable(); // Rewards for reaching this level
            $table->json('unlocked_features')->nullable(); // Features unlocked at this level
            $table->text('description')->nullable();
            $table->decimal('discount_percentage', 5, 2)->default(0); // Discount on services
            $table->integer('priority_support_level')->default(0); // Support priority
            $table->timestamps();
            
            // Indexes
            $table->index('level_number');
            $table->index('points_required');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('gamification_levels');
    }
};