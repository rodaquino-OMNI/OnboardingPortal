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
        Schema::table('interviews', function (Blueprint $table) {
            // Add missing fields from the enhanced model
            $table->timestamp('ended_at')->nullable()->after('started_at');
            $table->integer('actual_duration_minutes')->nullable()->after('duration_minutes');
            $table->string('interview_type')->nullable()->after('booking_reference');
            $table->string('meeting_type')->nullable()->after('interview_type');
            $table->string('meeting_link')->nullable()->after('meeting_type');
            $table->text('session_notes')->nullable()->after('interview_notes');
            $table->integer('rating')->nullable()->after('beneficiary_rating');
            $table->text('feedback')->nullable()->after('rating');
            $table->text('reschedule_reason')->nullable()->after('cancellation_reason');
            $table->integer('reschedule_count')->default(0)->after('reschedule_reason');
            $table->timestamp('rescheduled_at')->nullable()->after('reschedule_count');
            $table->foreignId('rescheduled_by')->nullable()->constrained('users')->onDelete('set null')->after('rescheduled_at');
            $table->timestamp('reminder_sent_at')->nullable()->after('rescheduled_by');
            $table->timestamp('confirmation_sent_at')->nullable()->after('reminder_sent_at');
            $table->boolean('follow_up_required')->default(false)->after('requires_follow_up');
            $table->text('follow_up_notes')->nullable()->after('follow_up_actions');
            $table->json('emergency_contact')->nullable()->after('follow_up_notes');
            $table->boolean('preparation_confirmed')->default(false)->after('emergency_contact');
            $table->integer('punctuality_score')->nullable()->after('preparation_confirmed');
            $table->timestamp('booked_at')->nullable()->after('punctuality_score');
            $table->string('timezone')->nullable()->after('booked_at');
            $table->string('beneficiary_timezone')->nullable()->after('timezone');
            $table->string('professional_timezone')->nullable()->after('beneficiary_timezone');
            
            // Update existing field name
            if (Schema::hasColumn('interviews', 'completed_at')) {
                $table->dropColumn('completed_at');
            }
            
            // Add indexes for new fields
            $table->index('interview_type');
            $table->index('meeting_type');
            $table->index('reschedule_count');
            $table->index('booked_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('interviews', function (Blueprint $table) {
            // Drop new columns
            $table->dropColumn([
                'ended_at',
                'actual_duration_minutes',
                'interview_type',
                'meeting_type',
                'meeting_link',
                'session_notes',
                'rating',
                'feedback',
                'reschedule_reason',
                'reschedule_count',
                'rescheduled_at',
                'rescheduled_by',
                'reminder_sent_at',
                'confirmation_sent_at',
                'follow_up_required',
                'follow_up_notes',
                'emergency_contact',
                'preparation_confirmed',
                'punctuality_score',
                'booked_at',
                'timezone',
                'beneficiary_timezone',
                'professional_timezone',
            ]);
            
            // Restore completed_at column
            $table->timestamp('completed_at')->nullable()->after('started_at');
            
            // Drop indexes
            $table->dropIndex(['interview_type']);
            $table->dropIndex(['meeting_type']);
            $table->dropIndex(['reschedule_count']);
            $table->dropIndex(['booked_at']);
        });
    }
};