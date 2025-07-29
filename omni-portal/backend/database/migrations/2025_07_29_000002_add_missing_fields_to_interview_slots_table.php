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
            // Add missing fields from the enhanced model
            $table->string('meeting_platform')->nullable()->after('meeting_link');
            $table->integer('break_duration')->default(0)->after('duration_minutes');
            $table->integer('buffer_minutes')->default(15)->after('break_duration');
            $table->string('timezone')->default('America/Sao_Paulo')->after('buffer_minutes');
            $table->string('specialization_required')->nullable()->after('interview_type');
            $table->json('languages_available')->nullable()->after('specialization_required');
            $table->json('preparation_requirements')->nullable()->after('languages_available');
            $table->integer('cancellation_deadline_hours')->default(24)->after('preparation_requirements');
            $table->integer('reschedule_deadline_hours')->default(24)->after('cancellation_deadline_hours');
            
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
            // Drop new columns
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