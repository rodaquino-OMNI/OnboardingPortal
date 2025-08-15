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
        // Add indexes for health_questionnaires table
        Schema::table('health_questionnaires', function (Blueprint $table) {
            $table->index(['user_id', 'status'], 'idx_health_questionnaires_user_status');
            $table->index(['status', 'created_at'], 'idx_health_questionnaires_status_created');
            $table->index(['is_draft', 'updated_at'], 'idx_health_questionnaires_draft_updated');
        });

        // Add indexes for beneficiaries table if it exists
        if (Schema::hasTable('beneficiaries')) {
            Schema::table('beneficiaries', function (Blueprint $table) {
                $table->index(['user_id', 'status'], 'idx_beneficiaries_user_status');
                $table->index(['email'], 'idx_beneficiaries_email');
                $table->index(['created_at'], 'idx_beneficiaries_created');
            });
        }

        // Add indexes for users table
        Schema::table('users', function (Blueprint $table) {
            $table->index(['email', 'created_at'], 'idx_users_email_created');
            $table->index(['created_at'], 'idx_users_created');
        });

        // Add indexes for sessions table if it exists
        if (Schema::hasTable('sessions')) {
            Schema::table('sessions', function (Blueprint $table) {
                $table->index(['user_id', 'last_activity'], 'idx_sessions_user_activity');
                $table->index(['last_activity'], 'idx_sessions_activity');
            });
        }

        // Add indexes for failed_jobs table
        if (Schema::hasTable('failed_jobs')) {
            Schema::table('failed_jobs', function (Blueprint $table) {
                $table->index(['queue', 'failed_at'], 'idx_failed_jobs_queue_failed');
            });
        }

        // Add indexes for jobs table
        if (Schema::hasTable('jobs')) {
            Schema::table('jobs', function (Blueprint $table) {
                $table->index(['queue', 'reserved_at'], 'idx_jobs_queue_reserved');
                $table->index(['available_at'], 'idx_jobs_available');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove health_questionnaires indexes
        Schema::table('health_questionnaires', function (Blueprint $table) {
            $table->dropIndex('idx_health_questionnaires_user_status');
            $table->dropIndex('idx_health_questionnaires_status_created');
            $table->dropIndex('idx_health_questionnaires_draft_updated');
        });

        // Remove beneficiaries indexes
        if (Schema::hasTable('beneficiaries')) {
            Schema::table('beneficiaries', function (Blueprint $table) {
                $table->dropIndex('idx_beneficiaries_user_status');
                $table->dropIndex('idx_beneficiaries_email');
                $table->dropIndex('idx_beneficiaries_created');
            });
        }

        // Remove users indexes
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('idx_users_email_created');
            $table->dropIndex('idx_users_created');
        });

        // Remove sessions indexes
        if (Schema::hasTable('sessions')) {
            Schema::table('sessions', function (Blueprint $table) {
                $table->dropIndex('idx_sessions_user_activity');
                $table->dropIndex('idx_sessions_activity');
            });
        }

        // Remove failed_jobs indexes
        if (Schema::hasTable('failed_jobs')) {
            Schema::table('failed_jobs', function (Blueprint $table) {
                $table->dropIndex('idx_failed_jobs_queue_failed');
            });
        }

        // Remove jobs indexes
        if (Schema::hasTable('jobs')) {
            Schema::table('jobs', function (Blueprint $table) {
                $table->dropIndex('idx_jobs_queue_reserved');
                $table->dropIndex('idx_jobs_available');
            });
        }
    }
};