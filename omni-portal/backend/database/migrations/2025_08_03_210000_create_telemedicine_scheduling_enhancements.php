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
        // Check if telemedicine_appointment_types table already exists
        if (!Schema::hasTable('telemedicine_appointment_types')) {
            // Create telemedicine appointment types table
            Schema::create('telemedicine_appointment_types', function (Blueprint $table) {
                $table->id();
                $table->string('name'); // 'Initial Consultation', 'Follow-up', 'Urgent Care', 'Mental Health', etc.
                $table->string('slug')->unique();
                $table->text('description')->nullable();
                $table->integer('default_duration_minutes')->default(30);
                $table->decimal('base_price', 10, 2)->default(0.00);
                $table->json('required_documents')->nullable(); // Document types required for this appointment type
                $table->json('preparation_checklist')->nullable(); // What patient needs to prepare
                $table->boolean('requires_prescription_review')->default(false);
                $table->boolean('allows_emergency_booking')->default(false);
                $table->integer('advance_booking_days')->default(30); // How far in advance can be booked
                $table->integer('minimum_notice_hours')->default(24); // Minimum hours before appointment
                $table->json('specializations_required')->nullable(); // Required healthcare professional specializations
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->index(['is_active', 'slug']);
                $table->index('allows_emergency_booking');
            });
        }

        // Create telemedicine availability templates
        if (!Schema::hasTable('telemedicine_availability_templates')) {
            Schema::create('telemedicine_availability_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('healthcare_professional_id')->constrained('users')->onDelete('cascade');
            $table->string('name'); // 'Weekday Morning', 'Weekend Schedule', etc.
            $table->json('weekly_schedule'); // Day of week -> time slots
            $table->json('appointment_types_allowed'); // Which appointment types this template supports
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['healthcare_professional_id', 'is_active']);
            $table->index(['healthcare_professional_id', 'is_default']);
            });
        }

        // Create telemedicine recurring appointments
        if (!Schema::hasTable('telemedicine_recurring_appointments')) {
            Schema::create('telemedicine_recurring_appointments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('beneficiary_id')->constrained()->onDelete('cascade');
            $table->foreignId('healthcare_professional_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('appointment_type_id')->constrained('telemedicine_appointment_types')->onDelete('cascade');
            $table->string('recurrence_pattern'); // 'weekly', 'biweekly', 'monthly', 'quarterly'
            $table->integer('recurrence_interval')->default(1); // Every X weeks/months
            $table->json('recurrence_days')->nullable(); // For weekly: ['monday', 'wednesday'], etc.
            $table->time('preferred_start_time');
            $table->time('preferred_end_time');
            $table->date('series_start_date');
            $table->date('series_end_date')->nullable();
            $table->integer('max_occurrences')->nullable();
            $table->integer('created_appointments_count')->default(0);
            $table->json('skip_dates')->nullable(); // Dates to skip in the series
            $table->enum('status', ['active', 'paused', 'completed', 'cancelled'])->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['beneficiary_id', 'status']);
            $table->index(['healthcare_professional_id', 'status']);
            $table->index(['series_start_date', 'series_end_date']);
            });
        }

        // Create telemedicine waitlist
        if (!Schema::hasTable('telemedicine_waitlist')) {
            Schema::create('telemedicine_waitlist', function (Blueprint $table) {
            $table->id();
            $table->foreignId('beneficiary_id')->constrained()->onDelete('cascade');
            $table->foreignId('appointment_type_id')->constrained('telemedicine_appointment_types')->onDelete('cascade');
            $table->foreignId('preferred_professional_id')->nullable()->constrained('users')->onDelete('set null');
            $table->json('preferred_time_slots'); // Array of preferred time ranges
            $table->json('preferred_days'); // ['monday', 'tuesday', etc.]
            $table->date('earliest_date');
            $table->date('latest_date');
            $table->enum('urgency_level', ['routine', 'urgent', 'emergency'])->default('routine');
            $table->text('special_requirements')->nullable();
            $table->boolean('accepts_any_provider')->default(false);
            $table->enum('status', ['waiting', 'matched', 'expired', 'cancelled'])->default('waiting');
            $table->timestamp('matched_at')->nullable();
            $table->foreignId('matched_appointment_id')->nullable()->constrained('interviews')->onDelete('set null');
            $table->timestamp('expires_at');
            $table->integer('notification_attempts')->default(0);
            $table->timestamp('last_notification_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'urgency_level', 'earliest_date']);
            $table->index(['beneficiary_id', 'status']);
            $table->index('expires_at');
            });
        }

        // Add telemedicine-specific fields to existing interviews table
        if (Schema::hasTable('interviews') && !Schema::hasColumn('interviews', 'appointment_type_id')) {
            Schema::table('interviews', function (Blueprint $table) {
            $table->foreignId('appointment_type_id')->nullable()->constrained('telemedicine_appointment_types')->onDelete('set null')->after('interview_type');
            $table->foreignId('recurring_appointment_id')->nullable()->constrained('telemedicine_recurring_appointments')->onDelete('set null')->after('appointment_type_id');
            $table->boolean('is_telemedicine')->default(true)->after('recurring_appointment_id');
            $table->json('telemedicine_setup_checklist')->nullable()->after('is_telemedicine'); // Pre-appointment setup items
            $table->boolean('setup_checklist_completed')->default(false)->after('telemedicine_setup_checklist');
            $table->timestamp('setup_completed_at')->nullable()->after('setup_checklist_completed');
            $table->json('vital_signs_data')->nullable()->after('setup_completed_at'); // If patient uses devices
            $table->boolean('prescription_reviewed')->default(false)->after('vital_signs_data');
            $table->json('prescription_changes')->nullable()->after('prescription_reviewed');
            $table->boolean('requires_in_person_followup')->default(false)->after('prescription_changes');
            $table->date('suggested_followup_date')->nullable()->after('requires_in_person_followup');
            $table->enum('consultation_outcome', [
                'completed_successfully',
                'completed_with_followup',
                'requires_in_person',
                'technical_issues',
                'patient_no_show',
                'provider_unavailable'
            ])->nullable()->after('suggested_followup_date');
            $table->integer('patient_satisfaction_score')->nullable()->after('consultation_outcome'); // 1-10 scale
            $table->text('patient_satisfaction_feedback')->nullable()->after('patient_satisfaction_score');
            $table->decimal('consultation_cost', 10, 2)->nullable()->after('patient_satisfaction_feedback');
            $table->boolean('insurance_covered')->default(false)->after('consultation_cost');
            $table->string('insurance_claim_id')->nullable()->after('insurance_covered');

            // Indexes for telemedicine-specific queries
            $table->index(['is_telemedicine', 'status']);
            $table->index(['appointment_type_id', 'scheduled_at']);
            $table->index(['consultation_outcome', 'scheduled_at']);
            $table->index(['requires_in_person_followup', 'suggested_followup_date']);
            });
        }

        // Add telemedicine-specific fields to interview_slots table
        if (Schema::hasTable('interview_slots') && !Schema::hasColumn('interview_slots', 'supported_appointment_types')) {
            Schema::table('interview_slots', function (Blueprint $table) {
            $table->json('supported_appointment_types')->nullable()->after('interview_type'); // Which appointment types this slot supports
            $table->boolean('is_telemedicine_enabled')->default(true)->after('supported_appointment_types');
            $table->json('technology_requirements')->nullable()->after('is_telemedicine_enabled'); // Browser, device requirements
            $table->boolean('allows_urgent_booking')->default(false)->after('technology_requirements');
            $table->integer('urgent_booking_fee')->default(0)->after('allows_urgent_booking'); // Additional fee for urgent bookings
            $table->json('preparation_time_by_type')->nullable()->after('urgent_booking_fee'); // Different prep times per appointment type
            $table->boolean('auto_confirm_bookings')->default(false)->after('preparation_time_by_type');
            $table->json('blocked_appointment_types')->nullable()->after('auto_confirm_bookings'); // Types not allowed for this slot

            $table->index(['is_telemedicine_enabled', 'is_available']);
            $table->index(['allows_urgent_booking', 'date']);
            });
        }

        // Create telemedicine session quality metrics
        if (!Schema::hasTable('telemedicine_session_metrics')) {
            Schema::create('telemedicine_session_metrics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('interview_id')->constrained()->onDelete('cascade');
            $table->foreignId('video_session_id')->nullable()->constrained('video_sessions')->onDelete('set null');
            $table->json('connection_quality_data'); // Bandwidth, latency, packet loss throughout session
            $table->integer('audio_quality_score')->nullable(); // 1-10 scale
            $table->integer('video_quality_score')->nullable(); // 1-10 scale
            $table->integer('overall_technical_score')->nullable(); // 1-10 scale
            $table->json('technical_issues_log')->nullable(); // Array of issues encountered
            $table->integer('session_interruptions_count')->default(0);
            $table->integer('total_interruption_duration_seconds')->default(0);
            $table->boolean('backup_communication_used')->default(false); // If had to use phone fallback
            $table->string('primary_device_type')->nullable(); // desktop, mobile, tablet
            $table->string('browser_type')->nullable();
            $table->string('operating_system')->nullable();
            $table->json('feature_usage')->nullable(); // Which features were used (screen share, chat, etc.)
            $table->boolean('session_completed_successfully')->default(true);
            $table->text('technical_feedback')->nullable();
            $table->timestamps();

            $table->index(['interview_id']);
            $table->index(['session_completed_successfully', 'created_at']);
            $table->index(['overall_technical_score', 'created_at']);
            });
        }

        // Create telemedicine notifications queue
        if (!Schema::hasTable('telemedicine_notifications')) {
            Schema::create('telemedicine_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('interview_id')->constrained()->onDelete('cascade');
            $table->foreignId('recipient_user_id')->constrained('users')->onDelete('cascade');
            $table->enum('notification_type', [
                'appointment_confirmation',
                'appointment_reminder_24h',
                'appointment_reminder_1h',
                'setup_checklist_reminder',
                'technical_check_reminder',
                'appointment_cancelled',
                'appointment_rescheduled',
                'followup_required',
                'waitlist_match_found',
                'prescription_ready'
            ]);
            $table->string('delivery_method'); // email, sms, push, in_app
            $table->enum('status', ['pending', 'sent', 'delivered', 'failed', 'expired'])->default('pending');
            $table->timestamp('scheduled_for');
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->json('message_data'); // Template variables and content
            $table->text('failure_reason')->nullable();
            $table->integer('retry_count')->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'scheduled_for']);
            $table->index(['interview_id', 'notification_type']);
            $table->index(['recipient_user_id', 'status']);
            });
        }

        // Create gamification rewards for telemedicine
        if (!Schema::hasTable('telemedicine_gamification_rules')) {
            Schema::create('telemedicine_gamification_rules', function (Blueprint $table) {
            $table->id();
            $table->string('rule_name');
            $table->string('trigger_event'); // 'appointment_completed', 'checklist_completed', etc.
            $table->json('conditions'); // Additional conditions for rule to apply
            $table->integer('points_awarded')->default(0);
            $table->string('badge_slug')->nullable(); // Badge to award if any
            $table->json('achievement_data')->nullable(); // Additional achievement information
            $table->boolean('is_active')->default(true);
            $table->text('description')->nullable();
            $table->timestamps();

            $table->index(['trigger_event', 'is_active']);
            $table->index('is_active');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop new tables in reverse order of creation
        Schema::dropIfExists('telemedicine_gamification_rules');
        Schema::dropIfExists('telemedicine_notifications');
        Schema::dropIfExists('telemedicine_session_metrics');
        Schema::dropIfExists('telemedicine_waitlist');
        Schema::dropIfExists('telemedicine_recurring_appointments');
        Schema::dropIfExists('telemedicine_availability_templates');
        Schema::dropIfExists('telemedicine_appointment_types');

        // Remove added columns from existing tables
        Schema::table('interviews', function (Blueprint $table) {
            $table->dropForeign(['appointment_type_id']);
            $table->dropForeign(['recurring_appointment_id']);
            $table->dropColumn([
                'appointment_type_id',
                'recurring_appointment_id',
                'is_telemedicine',
                'telemedicine_setup_checklist',
                'setup_checklist_completed',
                'setup_completed_at',
                'vital_signs_data',
                'prescription_reviewed',
                'prescription_changes',
                'requires_in_person_followup',
                'suggested_followup_date',
                'consultation_outcome',
                'patient_satisfaction_score',
                'patient_satisfaction_feedback',
                'consultation_cost',
                'insurance_covered',
                'insurance_claim_id'
            ]);
        });

        Schema::table('interview_slots', function (Blueprint $table) {
            $table->dropColumn([
                'supported_appointment_types',
                'is_telemedicine_enabled',
                'technology_requirements',
                'allows_urgent_booking',
                'urgent_booking_fee',
                'preparation_time_by_type',
                'auto_confirm_bookings',
                'blocked_appointment_types'
            ]);
        });
    }
};