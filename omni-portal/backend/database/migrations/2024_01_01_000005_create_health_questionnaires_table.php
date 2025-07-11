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
        Schema::create('health_questionnaires', function (Blueprint $table) {
            $table->id();
            $table->foreignId('beneficiary_id')->constrained()->onDelete('cascade');
            $table->string('questionnaire_type'); // 'initial', 'periodic', 'specific'
            $table->enum('status', ['draft', 'completed', 'reviewed', 'archived'])->default('draft');
            
            // Basic Health Information
            $table->decimal('height', 5, 2)->nullable(); // in cm
            $table->decimal('weight', 5, 2)->nullable(); // in kg
            $table->decimal('bmi', 4, 2)->nullable(); // calculated BMI
            $table->string('blood_type')->nullable();
            $table->enum('blood_pressure_status', ['normal', 'elevated', 'high_stage_1', 'high_stage_2', 'hypertensive_crisis'])->nullable();
            $table->string('blood_pressure_values')->nullable(); // e.g., "120/80"
            
            // Medical History
            $table->json('chronic_conditions')->nullable(); // Array of conditions
            $table->json('current_medications')->nullable(); // Array of medications with dosage
            $table->json('allergies')->nullable(); // Array of allergies
            $table->json('surgeries')->nullable(); // Array of past surgeries with dates
            $table->json('family_history')->nullable(); // Family medical history
            
            // Lifestyle
            $table->enum('smoking_status', ['never', 'former', 'current', 'occasional'])->nullable();
            $table->integer('cigarettes_per_day')->nullable();
            $table->enum('alcohol_consumption', ['never', 'rarely', 'moderate', 'heavy'])->nullable();
            $table->enum('physical_activity_level', ['sedentary', 'light', 'moderate', 'active', 'very_active'])->nullable();
            $table->integer('exercise_frequency_per_week')->nullable();
            $table->enum('diet_type', ['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'other'])->nullable();
            $table->integer('sleep_hours_average')->nullable();
            $table->enum('sleep_quality', ['very_poor', 'poor', 'fair', 'good', 'excellent'])->nullable();
            $table->enum('stress_level', ['very_low', 'low', 'moderate', 'high', 'very_high'])->nullable();
            
            // Mental Health
            $table->boolean('mental_health_concerns')->default(false);
            $table->json('mental_health_conditions')->nullable();
            $table->boolean('currently_in_therapy')->default(false);
            $table->boolean('taking_mental_health_medication')->default(false);
            
            // Women's Health (if applicable)
            $table->boolean('is_pregnant')->nullable();
            $table->integer('pregnancy_weeks')->nullable();
            $table->date('last_menstrual_period')->nullable();
            $table->boolean('uses_contraception')->nullable();
            $table->string('contraception_method')->nullable();
            
            // Preventive Care
            $table->date('last_medical_checkup')->nullable();
            $table->date('last_dental_checkup')->nullable();
            $table->date('last_eye_exam')->nullable();
            $table->json('vaccinations')->nullable(); // Array of vaccinations with dates
            $table->json('screening_tests')->nullable(); // Array of screening tests with dates
            
            // Additional Information
            $table->text('additional_notes')->nullable();
            $table->json('custom_responses')->nullable(); // For dynamic questionnaire fields
            
            // Metadata
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_notes')->nullable();
            $table->integer('completion_percentage')->default(0);
            $table->integer('accuracy_score')->nullable(); // Score based on completeness and consistency
            
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes
            $table->index('beneficiary_id');
            $table->index('questionnaire_type');
            $table->index('status');
            $table->index('completed_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('health_questionnaires');
    }
};