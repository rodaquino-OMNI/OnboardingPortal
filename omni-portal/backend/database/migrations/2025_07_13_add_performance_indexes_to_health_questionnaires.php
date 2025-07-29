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
        Schema::table('health_questionnaires', function (Blueprint $table) {
            // High-impact performance indexes
            $table->index(['beneficiary_id', 'status'], 'idx_health_beneficiary_status');
            $table->index(['template_id', 'completed_at'], 'idx_health_template_completed');
            $table->index(['beneficiary_id', 'created_at'], 'idx_health_beneficiary_created');
            $table->index(['status', 'last_saved_at'], 'idx_health_status_saved');
            
            // Progressive screening performance indexes
            $table->index(['progressive_layer', 'created_at'], 'idx_health_progressive_created');
            $table->index(['risk_level', 'emergency_detected'], 'idx_health_risk_emergency');
            
            // AI processing performance indexes
            $table->index(['status', 'ai_insights'], 'idx_health_status_ai_null');
            $table->index(['template_id', 'status', 'completed_at'], 'idx_health_template_status_completed');
            
            // Reporting and analytics indexes
            $table->index(['completed_at', 'risk_level'], 'idx_health_completed_risk');
            $table->index(['beneficiary_id', 'completed_at', 'status'], 'idx_health_beneficiary_completed_status');
        });

        // Add indexes to questionnaire_templates for faster template loading
        Schema::table('questionnaire_templates', function (Blueprint $table) {
            $table->index(['is_active', 'type'], 'idx_template_active_type');
            $table->index(['code', 'is_active'], 'idx_template_code_active');
            $table->index(['is_active', 'created_at'], 'idx_template_active_created');
        });

        // Add composite index for pathway experiences if table exists
        if (Schema::hasTable('pathway_experiences')) {
            Schema::table('pathway_experiences', function (Blueprint $table) {
                $table->index(['beneficiary_id', 'pathway'], 'idx_pathway_beneficiary_pathway');
                $table->index(['created_at', 'pathway'], 'idx_pathway_created_pathway');
                $table->index(['engagement_score', 'risk_level'], 'idx_pathway_engagement_risk');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('health_questionnaires', function (Blueprint $table) {
            $table->dropIndex('idx_health_beneficiary_status');
            $table->dropIndex('idx_health_template_completed');
            $table->dropIndex('idx_health_beneficiary_created');
            $table->dropIndex('idx_health_status_saved');
            $table->dropIndex('idx_health_progressive_created');
            $table->dropIndex('idx_health_risk_emergency');
            $table->dropIndex('idx_health_status_ai_null');
            $table->dropIndex('idx_health_template_status_completed');
            $table->dropIndex('idx_health_completed_risk');
            $table->dropIndex('idx_health_beneficiary_completed_status');
        });

        Schema::table('questionnaire_templates', function (Blueprint $table) {
            $table->dropIndex('idx_template_active_type');
            $table->dropIndex('idx_template_code_active');
            $table->dropIndex('idx_template_active_created');
        });

        if (Schema::hasTable('pathway_experiences')) {
            Schema::table('pathway_experiences', function (Blueprint $table) {
                $table->dropIndex('idx_pathway_beneficiary_pathway');
                $table->dropIndex('idx_pathway_created_pathway');
                $table->dropIndex('idx_pathway_engagement_risk');
            });
        }
    }
};