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
        Schema::table('interview_slots', function (Blueprint $table) {
            // Add missing fields from the enhanced model (skip is_available as it already exists)
            if (!Schema::hasColumn('interview_slots', 'meeting_platform')) {
                $table->string('meeting_platform')->nullable()->after('meeting_link');
            }
            if (!Schema::hasColumn('interview_slots', 'break_duration')) {
                $table->integer('break_duration')->default(0)->after('duration_minutes');
            }
            if (!Schema::hasColumn('interview_slots', 'buffer_minutes')) {
                $table->integer('buffer_minutes')->default(15)->after('break_duration');
            }
            if (!Schema::hasColumn('interview_slots', 'timezone')) {
                $table->string('timezone')->default('America/Sao_Paulo')->after('buffer_minutes');
            }
            if (!Schema::hasColumn('interview_slots', 'specialization_required')) {
                $table->string('specialization_required')->nullable()->after('interview_type');
            }
            if (!Schema::hasColumn('interview_slots', 'languages_available')) {
                $table->json('languages_available')->nullable()->after('specialization_required');
            }
            if (!Schema::hasColumn('interview_slots', 'preparation_requirements')) {
                $table->json('preparation_requirements')->nullable()->after('languages_available');
            }
            if (!Schema::hasColumn('interview_slots', 'cancellation_deadline_hours')) {
                $table->integer('cancellation_deadline_hours')->default(24)->after('preparation_requirements');
            }
            if (!Schema::hasColumn('interview_slots', 'reschedule_deadline_hours')) {
                $table->integer('reschedule_deadline_hours')->default(24)->after('cancellation_deadline_hours');
            }
            
            // Add indexes for new fields
            $table->index('timezone');
            $table->index('specialization_required');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('interview_slots', function (Blueprint $table) {
            // Drop new columns (skip is_available as it was not added by this migration)
            $table->dropColumn([
                'meeting_platform',
                'break_duration',
                'buffer_minutes',
                'timezone',
                'specialization_required',
                'languages_available',
                'preparation_requirements',
                'cancellation_deadline_hours',
                'reschedule_deadline_hours',
            ]);
            
            // Drop indexes
            $table->dropIndex(['timezone']);
            $table->dropIndex(['specialization_required']);
        });
    }
};