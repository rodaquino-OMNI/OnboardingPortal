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
        Schema::create('telemedicine_appointments', function (Blueprint $table) {
            $table->id();
            
            // Core Appointment Data
            $table->string('appointment_reference', 20)->unique();
            $table->foreignId('beneficiary_id')->constrained('beneficiaries')->onDelete('cascade');
            $table->foreignId('healthcare_professional_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('appointment_type_id')->constrained('telemedicine_appointment_types')->onDelete('cascade');
            
            // Backward Compatibility - Link to existing interviews system
            $table->foreignId('legacy_interview_id')->nullable()->constrained('interviews')->onDelete('set null');
            
            // Scheduling
            $table->timestamp('scheduled_at');
            $table->integer('duration_minutes');
            $table->string('timezone', 50)->default('America/Sao_Paulo');
            
            // Enhanced Status Management
            $table->enum('status', [
                'scheduled', 'confirmed', 'preparation', 'waiting_room', 
                'in_progress', 'completed', 'cancelled', 'no_show', 
                'rescheduled', 'follow_up_required'
            ])->default('scheduled');
            
            // Timing Tracking
            $table->timestamp('booked_at');
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('preparation_started_at')->nullable();
            $table->timestamp('joined_waiting_room_at')->nullable();
            $table->timestamp('session_started_at')->nullable();
            $table->timestamp('session_ended_at')->nullable();
            
            // Gamification Integration
            $table->integer('points_earned')->default(0);
            $table->json('badges_awarded')->nullable();
            $table->integer('completion_streak')->default(0);
            $table->boolean('punctuality_bonus_earned')->default(false);
            $table->boolean('preparation_bonus_earned')->default(false);
            
            // Clinical Data
            $table->text('chief_complaint')->nullable();
            $table->json('symptoms_checklist')->nullable();
            $table->json('vitals_recorded')->nullable();
            $table->boolean('medications_reviewed')->default(false);
            $table->json('care_plan_updates')->nullable();
            
            // Engagement Metrics
            $table->boolean('preparation_completed')->default(false);
            $table->integer('preparation_score')->nullable(); // 0-100
            $table->integer('session_quality_rating')->nullable(); // 1-5
            $table->json('technical_issues')->nullable();
            $table->integer('engagement_score')->nullable(); // 0-100
            
            // Follow-up Management
            $table->boolean('follow_up_required')->default(false);
            $table->date('follow_up_date')->nullable();
            $table->string('follow_up_type', 100)->nullable();
            $table->boolean('care_plan_updated')->default(false);
            
            // Integration Fields
            $table->string('video_session_id')->nullable();
            $table->string('recording_url', 500)->nullable();
            $table->boolean('prescription_issued')->default(false);
            $table->boolean('lab_orders_issued')->default(false);
            
            // Cancellation and Rescheduling
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->onDelete('set null');
            $table->text('cancellation_reason')->nullable();
            $table->integer('reschedule_count')->default(0);
            
            // Professional Notes
            $table->text('pre_appointment_notes')->nullable();
            $table->text('session_notes')->nullable();
            $table->text('post_appointment_notes')->nullable();
            $table->json('clinical_recommendations')->nullable();
            
            // Ratings and Feedback
            $table->integer('beneficiary_rating')->nullable(); // 1-5
            $table->text('beneficiary_feedback')->nullable();
            $table->integer('professional_rating')->nullable(); // 1-5
            $table->text('professional_feedback')->nullable();
            
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes for Performance
            $table->index(['beneficiary_id', 'status']);
            $table->index(['healthcare_professional_id', 'scheduled_at']);
            $table->index(['appointment_type_id']);
            $table->index(['status', 'scheduled_at']);
            $table->index(['appointment_reference']);
            $table->index(['scheduled_at']);
            $table->index(['legacy_interview_id']);
            
            // Gamification Indexes
            $table->index(['beneficiary_id', 'completion_streak']);
            $table->index(['points_earned']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('telemedicine_appointments');
    }
};