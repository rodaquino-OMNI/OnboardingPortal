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
        // Add composite index on health_questionnaires table for (beneficiary_id, completed_at)
        Schema::table('health_questionnaires', function (Blueprint $table) {
            $table->index(['beneficiary_id', 'completed_at'], 'idx_health_questionnaires_beneficiary_completed');
        });

        // Add composite index on documents table for (beneficiary_id, status)
        Schema::table('documents', function (Blueprint $table) {
            $table->index(['beneficiary_id', 'status'], 'idx_documents_beneficiary_status');
        });

        // Add composite index on gamification_progress table for (beneficiary_id, updated_at)
        Schema::table('gamification_progress', function (Blueprint $table) {
            $table->index(['beneficiary_id', 'updated_at'], 'idx_gamification_progress_beneficiary_updated');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop the indexes in reverse order
        Schema::table('gamification_progress', function (Blueprint $table) {
            $table->dropIndex('idx_gamification_progress_beneficiary_updated');
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->dropIndex('idx_documents_beneficiary_status');
        });

        Schema::table('health_questionnaires', function (Blueprint $table) {
            $table->dropIndex('idx_health_questionnaires_beneficiary_completed');
        });
    }
};
