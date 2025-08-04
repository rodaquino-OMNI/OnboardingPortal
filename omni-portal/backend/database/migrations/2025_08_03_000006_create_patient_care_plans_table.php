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
        Schema::create('patient_care_plans', function (Blueprint $table) {
            $table->id();
            
            // Core Data
            $table->foreignId('beneficiary_id')->constrained('beneficiaries')->onDelete('cascade');
            $table->foreignId('healthcare_professional_id')->constrained('users')->onDelete('cascade');
            
            // Plan Details
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('clinical_condition')->nullable();
            $table->date('start_date');
            $table->date('target_end_date')->nullable();
            
            // Goals and Metrics
            $table->json('health_goals'); // Structured goals with metrics
            $table->json('success_metrics'); // How to measure success
            $table->json('milestone_schedule')->nullable(); // Key checkpoints
            
            // Gamification Integration
            $table->integer('total_possible_points')->default(0);
            $table->json('milestone_rewards')->nullable(); // Points and badges for milestones
            $table->integer('current_points_earned')->default(0);
            
            // Status and Progress
            $table->enum('status', ['active', 'paused', 'completed', 'discontinued'])->default('active');
            $table->decimal('completion_percentage', 5, 2)->default(0.00);
            $table->json('progress_data')->nullable(); // Detailed progress tracking
            
            // Appointments Integration
            $table->integer('required_appointments')->default(0);
            $table->integer('completed_appointments')->default(0);
            $table->json('appointment_schedule')->nullable(); // Planned appointment cadence
            
            // Monitoring and Alerts
            $table->json('monitoring_parameters')->nullable(); // What to track
            $table->json('alert_thresholds')->nullable(); // When to alert
            $table->boolean('requires_daily_checkin')->default(false);
            $table->boolean('requires_weekly_checkin')->default(false);
            
            // Review and Updates
            $table->timestamp('last_updated_at')->useCurrent()->useCurrentOnUpdate();
            $table->date('next_review_date')->nullable();
            $table->text('last_review_notes')->nullable();
            $table->integer('review_count')->default(0);
            
            // Outcomes Tracking
            $table->json('outcome_measures')->nullable(); // Key health outcomes to track
            $table->json('baseline_measurements')->nullable(); // Initial values
            $table->json('latest_measurements')->nullable(); // Most recent values
            
            // Care Team
            $table->json('care_team_members')->nullable(); // Other professionals involved
            $table->json('emergency_contacts')->nullable(); // Emergency contact info
            
            // Compliance and Adherence
            $table->decimal('overall_adherence_rate', 5, 2)->nullable(); // 0-100%
            $table->json('adherence_breakdown')->nullable(); // By category
            
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes
            $table->index(['beneficiary_id', 'status']);
            $table->index(['healthcare_professional_id']);
            $table->index(['status', 'next_review_date']);
            $table->index(['completion_percentage']);
            $table->index(['start_date', 'target_end_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('patient_care_plans');
    }
};