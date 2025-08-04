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
        Schema::create('telemedicine_achievements', function (Blueprint $table) {
            $table->id();
            
            // Achievement Identity
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description');
            $table->enum('category', [
                'appointment_completion', 'health_monitoring', 'engagement', 
                'clinical_outcomes', 'consistency', 'milestones', 'social'
            ]);
            
            // Visual Design
            $table->string('icon_name', 100);
            $table->string('icon_color', 7)->default('#3B82F6');
            $table->json('badge_design')->nullable(); // Custom visual properties
            
            // Achievement Logic
            $table->json('criteria'); // Complex achievement rules
            $table->integer('points_value')->default(0);
            $table->enum('rarity', ['common', 'uncommon', 'rare', 'epic', 'legendary'])->default('common');
            $table->integer('max_earnable')->default(1); // How many times can be earned
            
            // Availability
            $table->boolean('is_active')->default(true);
            $table->boolean('is_secret')->default(false); // Hidden until earned
            $table->timestamp('available_from')->nullable();
            $table->timestamp('available_until')->nullable();
            
            // Behavioral Design
            $table->string('encourages_behavior')->nullable();
            $table->text('clinical_benefit')->nullable();
            $table->integer('difficulty_level')->default(1); // 1-5 scale
            
            // Integration with existing gamification
            $table->boolean('creates_badge')->default(true); // Create in gamification_badges table
            $table->foreignId('gamification_badge_id')->nullable()->constrained('gamification_badges')->onDelete('set null');
            
            // Sorting and Organization
            $table->integer('sort_order')->default(0);
            
            $table->timestamps();
            
            // Indexes
            $table->index('slug');
            $table->index('category');
            $table->index('is_active');
            $table->index('rarity');
            $table->index(['category', 'difficulty_level']);
            $table->index('gamification_badge_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('telemedicine_achievements');
    }
};