<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Check if an index exists on a table
     */
    private function indexExists(string $table, string $indexName): bool
    {
        $indexes = DB::select("SHOW INDEX FROM {$table} WHERE Key_name = ?", [$indexName]);
        return !empty($indexes);
    }

    /**
     * Safely add index if it doesn't exist
     */
    private function addIndexIfNotExists(Blueprint $table, array $columns, string $indexName): void
    {
        if (!$this->indexExists($table->getTable(), $indexName)) {
            $table->index($columns, $indexName);
        }
    }

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('health_questionnaires', function (Blueprint $table) {
            // High-impact performance indexes - check existence before creating
            $this->addIndexIfNotExists($table, ['beneficiary_id', 'status'], 'idx_health_beneficiary_status');
            $this->addIndexIfNotExists($table, ['template_id', 'completed_at'], 'idx_health_template_completed');
            $this->addIndexIfNotExists($table, ['beneficiary_id', 'created_at'], 'idx_health_beneficiary_created');
            $this->addIndexIfNotExists($table, ['status', 'last_saved_at'], 'idx_health_status_saved');
            
            // Progressive screening performance indexes
            $this->addIndexIfNotExists($table, ['progressive_layer', 'created_at'], 'idx_health_progressive_created');
            $this->addIndexIfNotExists($table, ['risk_level', 'emergency_detected'], 'idx_health_risk_emergency');
            
            // AI processing performance indexes
            $this->addIndexIfNotExists($table, ['status', 'ai_insights'], 'idx_health_status_ai_null');
            $this->addIndexIfNotExists($table, ['template_id', 'status', 'completed_at'], 'idx_health_template_status_completed');
            
            // Reporting and analytics indexes
            $this->addIndexIfNotExists($table, ['completed_at', 'risk_level'], 'idx_health_completed_risk');
            $this->addIndexIfNotExists($table, ['beneficiary_id', 'completed_at', 'status'], 'idx_health_beneficiary_completed_status');
        });

        // Add indexes to questionnaire_templates for faster template loading
        if (Schema::hasTable('questionnaire_templates')) {
            Schema::table('questionnaire_templates', function (Blueprint $table) {
                $this->addIndexIfNotExists($table, ['is_active', 'type'], 'idx_template_active_type');
                $this->addIndexIfNotExists($table, ['code', 'is_active'], 'idx_template_code_active');
                $this->addIndexIfNotExists($table, ['is_active', 'created_at'], 'idx_template_active_created');
            });
        }

        // Add composite index for pathway experiences if table exists
        if (Schema::hasTable('pathway_experiences')) {
            Schema::table('pathway_experiences', function (Blueprint $table) {
                $this->addIndexIfNotExists($table, ['beneficiary_id', 'pathway'], 'idx_pathway_beneficiary_pathway');
                $this->addIndexIfNotExists($table, ['created_at', 'pathway'], 'idx_pathway_created_pathway');
                $this->addIndexIfNotExists($table, ['engagement_score', 'risk_level'], 'idx_pathway_engagement_risk');
            });
        }
    }

    /**
     * Safely drop index if it exists
     */
    private function dropIndexIfExists(Blueprint $table, string $indexName): void
    {
        if ($this->indexExists($table->getTable(), $indexName)) {
            $table->dropIndex($indexName);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('health_questionnaires', function (Blueprint $table) {
            $this->dropIndexIfExists($table, 'idx_health_beneficiary_status');
            $this->dropIndexIfExists($table, 'idx_health_template_completed');
            $this->dropIndexIfExists($table, 'idx_health_beneficiary_created');
            $this->dropIndexIfExists($table, 'idx_health_status_saved');
            $this->dropIndexIfExists($table, 'idx_health_progressive_created');
            $this->dropIndexIfExists($table, 'idx_health_risk_emergency');
            $this->dropIndexIfExists($table, 'idx_health_status_ai_null');
            $this->dropIndexIfExists($table, 'idx_health_template_status_completed');
            $this->dropIndexIfExists($table, 'idx_health_completed_risk');
            $this->dropIndexIfExists($table, 'idx_health_beneficiary_completed_status');
        });

        if (Schema::hasTable('questionnaire_templates')) {
            Schema::table('questionnaire_templates', function (Blueprint $table) {
                $this->dropIndexIfExists($table, 'idx_template_active_type');
                $this->dropIndexIfExists($table, 'idx_template_code_active');
                $this->dropIndexIfExists($table, 'idx_template_active_created');
            });
        }

        if (Schema::hasTable('pathway_experiences')) {
            Schema::table('pathway_experiences', function (Blueprint $table) {
                $this->dropIndexIfExists($table, 'idx_pathway_beneficiary_pathway');
                $this->dropIndexIfExists($table, 'idx_pathway_created_pathway');
                $this->dropIndexIfExists($table, 'idx_pathway_engagement_risk');
            });
        }
    }
};