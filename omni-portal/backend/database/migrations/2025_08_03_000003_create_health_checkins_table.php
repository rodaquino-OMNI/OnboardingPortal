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
        Schema::create('health_checkins', function (Blueprint $table) {
            $table->id();
            
            // Core Data
            $table->foreignId('beneficiary_id')->constrained('beneficiaries')->onDelete('cascade');
            $table->foreignId('telemedicine_appointment_id')->nullable()->constrained('telemedicine_appointments')->onDelete('set null');
            
            // Check-in Type
            $table->enum('checkin_type', [
                'pre_appointment', 'daily', 'weekly', 'symptom_tracker', 
                'medication_compliance', 'post_appointment', 'care_plan_update'
            ]);
            
            // Health Data
            $table->json('symptoms')->nullable(); // {"headache": 3, "fatigue": 7}
            $table->json('vitals')->nullable(); // {"bp": "120/80", "temp": "98.6", "weight": "150"}
            $table->integer('pain_level')->nullable(); // 1-10 scale
            $table->integer('mood_rating')->nullable(); // 1-10 scale
            $table->integer('energy_level')->nullable(); // 1-10 scale
            $table->decimal('sleep_hours', 3, 1)->nullable();
            $table->integer('stress_level')->nullable(); // 1-10 scale
            
            // Medication Tracking
            $table->json('medications_taken')->nullable();
            $table->json('side_effects')->nullable();
            $table->decimal('compliance_percentage', 5, 2)->nullable();
            $table->text('medication_notes')->nullable();
            
            // Lifestyle Factors
            $table->integer('exercise_minutes')->nullable();
            $table->json('nutrition_data')->nullable();
            $table->integer('water_intake_glasses')->nullable();
            $table->boolean('alcohol_consumed')->default(false);
            $table->boolean('tobacco_used')->default(false);
            
            // Gamification
            $table->integer('points_earned')->default(0);
            $table->integer('streak_day')->default(1);
            $table->boolean('consistency_bonus')->default(false);
            $table->boolean('completeness_bonus')->default(false);
            
            // Quality Metrics
            $table->integer('completion_time_seconds')->nullable();
            $table->integer('accuracy_score')->nullable(); // 0-100
            $table->decimal('completeness_percentage', 5, 2)->default(100.00);
            
            // Care Plan Integration
            $table->json('care_plan_goals_progress')->nullable();
            $table->boolean('triggers_alert')->default(false);
            $table->text('alert_reason')->nullable();
            
            // Follow-up Data
            $table->boolean('requires_professional_review')->default(false);
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->text('professional_notes')->nullable();
            
            $table->timestamp('completed_at');
            $table->timestamps();
            
            // Indexes
            $table->index(['beneficiary_id', 'checkin_type']);
            $table->index(['telemedicine_appointment_id']);
            $table->index(['completed_at']);
            $table->index(['beneficiary_id', 'completed_at']);
            $table->index(['checkin_type', 'completed_at']);
            $table->index(['requires_professional_review']);
            
            // Gamification Indexes
            $table->index(['beneficiary_id', 'streak_day']);
            $table->index(['points_earned']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('health_checkins');
    }
};