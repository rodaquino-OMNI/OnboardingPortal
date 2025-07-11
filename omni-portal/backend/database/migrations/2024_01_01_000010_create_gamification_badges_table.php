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
        Schema::create('gamification_badges', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description');
            $table->string('icon_name'); // Icon identifier or file path
            $table->string('icon_color')->default('#3B82F6'); // Hex color
            $table->enum('category', ['onboarding', 'health', 'engagement', 'milestone', 'special'])->default('engagement');
            $table->enum('rarity', ['common', 'uncommon', 'rare', 'epic', 'legendary'])->default('common');
            $table->integer('points_value')->default(0); // Points awarded when earned
            $table->json('criteria')->nullable(); // Conditions to earn the badge
            $table->boolean('is_active')->default(true);
            $table->boolean('is_secret')->default(false); // Hidden until earned
            $table->integer('sort_order')->default(0);
            $table->integer('max_per_user')->default(1); // How many times can be earned
            $table->timestamp('available_from')->nullable();
            $table->timestamp('available_until')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('slug');
            $table->index('category');
            $table->index('is_active');
            $table->index('rarity');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('gamification_badges');
    }
};