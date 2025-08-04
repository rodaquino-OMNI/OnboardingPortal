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
        Schema::create('telemedicine_appointment_types', function (Blueprint $table) {
            $table->id();
            
            // Basic Information
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->integer('duration_minutes')->default(30);
            $table->integer('preparation_time_minutes')->default(15);
            $table->boolean('follow_up_required')->default(false);
            
            // Gamification Integration
            $table->integer('base_points')->default(50);
            $table->foreignId('completion_badge_id')->nullable()->constrained('gamification_badges')->onDelete('set null');
            $table->decimal('streak_multiplier', 3, 2)->default(1.0);
            
            // Clinical Configuration
            $table->boolean('requires_pre_screening')->default(false);
            $table->integer('max_reschedules')->default(2);
            $table->integer('advance_booking_hours')->default(24);
            
            // Pricing and Availability
            $table->decimal('base_price', 8, 2)->nullable();
            $table->boolean('requires_insurance')->default(false);
            $table->string('specialty_required', 100)->nullable();
            
            // Engagement Features
            $table->json('reminder_schedule')->nullable(); // [24h, 2h, 30min]
            $table->json('preparation_checklist')->nullable();
            $table->json('post_appointment_actions')->nullable();
            
            // Status
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            
            $table->timestamps();
            
            // Indexes
            $table->index('slug');
            $table->index('is_active');
            $table->index('specialty_required');
            $table->index('sort_order');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('telemedicine_appointment_types');
    }
};