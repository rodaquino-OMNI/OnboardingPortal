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
        Schema::create('appointment_waitlists', function (Blueprint $table) {
            $table->id();
            
            // Core Data
            $table->foreignId('beneficiary_id')->constrained('beneficiaries')->onDelete('cascade');
            $table->foreignId('appointment_type_id')->constrained('telemedicine_appointment_types')->onDelete('cascade');
            $table->foreignId('healthcare_professional_id')->nullable()->constrained('users')->onDelete('cascade'); // NULL for any professional
            
            // Preferences
            $table->json('preferred_date_range'); // {"start": "2024-08-05", "end": "2024-08-15"}
            $table->json('preferred_times'); // ["09:00-12:00", "14:00-17:00"]
            $table->integer('max_advance_notice_hours')->default(24);
            
            // Priority System
            $table->integer('priority_score')->default(100);
            $table->enum('medical_urgency', ['routine', 'urgent', 'very_urgent'])->default('routine');
            $table->text('urgency_reason')->nullable();
            
            // Gamification Integration
            $table->integer('points_bonus_for_flexibility')->default(10);
            $table->boolean('flexibility_bonus_earned')->default(false);
            
            // Waitlist Management
            $table->enum('status', ['active', 'notified', 'booked', 'expired', 'cancelled'])->default('active');
            $table->timestamp('expires_at');
            $table->timestamp('last_notification_sent_at')->nullable();
            $table->integer('notification_count')->default(0);
            
            // Matching Algorithm Data
            $table->json('matching_criteria')->nullable(); // Additional criteria for matching
            $table->integer('match_attempts')->default(0);
            $table->timestamp('last_match_attempt_at')->nullable();
            
            // Conversion Tracking
            $table->foreignId('resulting_appointment_id')->nullable()->constrained('telemedicine_appointments')->onDelete('set null');
            $table->timestamp('converted_at')->nullable();
            
            $table->timestamps();
            
            // Indexes
            $table->index(['status', 'appointment_type_id', 'expires_at']);
            $table->index(['beneficiary_id']);
            $table->index(['healthcare_professional_id']);
            $table->index(['medical_urgency', 'priority_score']);
            $table->index(['status', 'expires_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('appointment_waitlists');
    }
};