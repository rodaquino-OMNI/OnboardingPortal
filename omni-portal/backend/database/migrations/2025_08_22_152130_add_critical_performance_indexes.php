<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Check if an index exists on a table (database-agnostic)
     */
    private function indexExists(string $table, string $indexName): bool
    {
        $driver = DB::connection()->getDriverName();
        
        try {
            switch ($driver) {
                case 'sqlite':
                    // For SQLite, query the sqlite_master table
                    $result = DB::select(
                        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ? AND tbl_name = ?", 
                        [$indexName, $table]
                    );
                    return !empty($result);
                    
                case 'mysql':
                    // For MySQL, use SHOW INDEX
                    $result = DB::select("SHOW INDEX FROM {$table} WHERE Key_name = ?", [$indexName]);
                    return !empty($result);
                    
                case 'pgsql':
                    // For PostgreSQL, query information_schema
                    $result = DB::select(
                        "SELECT indexname FROM pg_indexes WHERE tablename = ? AND indexname = ?", 
                        [$table, $indexName]
                    );
                    return !empty($result);
                    
                default:
                    // Fallback: Use Laravel's Schema::hasIndex if available
                    // Note: This method was added in newer Laravel versions
                    if (method_exists(Schema::class, 'hasIndex')) {
                        return Schema::hasIndex($table, $indexName);
                    }
                    
                    // Last resort: assume index doesn't exist and let Laravel handle duplicates
                    return false;
            }
        } catch (\Exception $e) {
            // If index checking fails, assume it doesn't exist
            // Laravel will handle duplicate index creation gracefully
            return false;
        }
    }

    /**
     * Safely add index if it doesn't exist (database-agnostic)
     */
    private function addIndexIfNotExists(string $tableName, array $columns, string $indexName, ?string $indexType = null): void
    {
        if (!$this->indexExists($tableName, $indexName)) {
            try {
                Schema::table($tableName, function (Blueprint $table) use ($columns, $indexName) {
                    $table->index($columns, $indexName);
                });
            } catch (\Exception $e) {
                // If Laravel's Schema builder fails, fall back to raw SQL for MySQL
                $driver = DB::connection()->getDriverName();
                if ($driver === 'mysql') {
                    $columnsStr = implode(', ', array_map(fn($col) => "`{$col}`", $columns));
                    $indexTypeStr = $indexType ? " USING {$indexType}" : '';
                    $sql = "CREATE INDEX `{$indexName}` ON `{$tableName}` ({$columnsStr}){$indexTypeStr}";
                    DB::statement($sql);
                }
                // For other databases, let the exception bubble up or ignore
            }
        }
    }

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Critical missing foreign key indexes
        if (Schema::hasTable('health_questionnaires')) {
            // Add user_id index if the column exists
            if (Schema::hasColumn('health_questionnaires', 'user_id')) {
                $this->addIndexIfNotExists('health_questionnaires', ['user_id'], 'idx_health_questionnaires_user_id');
            }
            
            // Performance indexes for reporting and analytics
            $this->addIndexIfNotExists('health_questionnaires', ['created_at', 'status', 'questionnaire_type'], 'idx_health_created_status_type');
            $this->addIndexIfNotExists('health_questionnaires', ['beneficiary_id', 'status', 'created_at'], 'idx_health_beneficiary_status_created_complex');
            $this->addIndexIfNotExists('health_questionnaires', ['status', 'severity_level', 'emergency_detected'], 'idx_health_risk_assessment');
            
            // AI processing optimization indexes
            $this->addIndexIfNotExists('health_questionnaires', ['template_id', 'status', 'completed_at'], 'idx_health_template_completion');
            $this->addIndexIfNotExists('health_questionnaires', ['last_saved_at', 'status'], 'idx_health_last_saved_status');
        }

        // Documents table optimization
        if (Schema::hasTable('documents')) {
            $this->addIndexIfNotExists('documents', ['user_id', 'created_at'], 'idx_documents_user_created');
            if (Schema::hasColumn('documents', 'beneficiary_id')) {
                $this->addIndexIfNotExists('documents', ['beneficiary_id', 'created_at'], 'idx_documents_beneficiary_created');
                $this->addIndexIfNotExists('documents', ['user_id', 'beneficiary_id'], 'idx_documents_user_beneficiary');
            }
            if (Schema::hasColumn('documents', 'ocr_status')) {
                $this->addIndexIfNotExists('documents', ['ocr_status', 'created_at'], 'idx_documents_ocr_status_created');
            }
        }

        // Audit logs optimization
        if (Schema::hasTable('audit_logs')) {
            $this->addIndexIfNotExists('audit_logs', ['user_id', 'created_at'], 'idx_audit_logs_user_created');
            if (Schema::hasColumn('audit_logs', 'action')) {
                $this->addIndexIfNotExists('audit_logs', ['action', 'created_at'], 'idx_audit_logs_action_created');
            }
        }

        // Interviews table optimization
        if (Schema::hasTable('interviews')) {
            if (Schema::hasColumn('interviews', 'beneficiary_id') && Schema::hasColumn('interviews', 'interview_slot_id')) {
                $this->addIndexIfNotExists('interviews', ['beneficiary_id', 'interview_slot_id'], 'idx_interviews_beneficiary_slot');
            }
            if (Schema::hasColumn('interviews', 'status')) {
                $this->addIndexIfNotExists('interviews', ['status', 'scheduled_at'], 'idx_interviews_status_scheduled');
            }
        }

        // Beneficiaries table optimization
        if (Schema::hasTable('beneficiaries')) {
            if (Schema::hasColumn('beneficiaries', 'company_id')) {
                $this->addIndexIfNotExists('beneficiaries', ['company_id', 'status'], 'idx_beneficiaries_company_status');
            }
            $this->addIndexIfNotExists('beneficiaries', ['email', 'created_at'], 'idx_beneficiaries_email_created_enhanced');
            $this->addIndexIfNotExists('beneficiaries', ['user_id', 'created_at'], 'idx_beneficiaries_user_created');
        }

        // Users table additional optimization
        if (Schema::hasTable('users')) {
            $this->addIndexIfNotExists('users', ['role', 'is_active'], 'idx_users_role_active');
            $this->addIndexIfNotExists('users', ['email_verified_at', 'created_at'], 'idx_users_verified_created');
        }

        // Gamification tables optimization
        if (Schema::hasTable('gamification_progress')) {
            if (Schema::hasColumn('gamification_progress', 'beneficiary_id')) {
                $this->addIndexIfNotExists('gamification_progress', ['beneficiary_id', 'updated_at'], 'idx_gamification_beneficiary_updated');
            }
        }

        if (Schema::hasTable('notifications')) {
            if (Schema::hasColumn('notifications', 'notifiable_id') && Schema::hasColumn('notifications', 'notifiable_type')) {
                $this->addIndexIfNotExists('notifications', ['notifiable_id', 'notifiable_type', 'read_at'], 'idx_notifications_notifiable_read');
            }
        }

        // OCR usage logs optimization for high-frequency writes
        if (Schema::hasTable('ocr_usage_logs')) {
            $this->addIndexIfNotExists('ocr_usage_logs', ['user_id', 'created_at'], 'idx_ocr_logs_user_created');
            if (Schema::hasColumn('ocr_usage_logs', 'cost_usd')) {
                $this->addIndexIfNotExists('ocr_usage_logs', ['created_at', 'cost_usd'], 'idx_ocr_logs_created_cost');
            }
        }

        // Video sessions optimization
        if (Schema::hasTable('video_sessions')) {
            if (Schema::hasColumn('video_sessions', 'participant_id')) {
                $this->addIndexIfNotExists('video_sessions', ['participant_id', 'created_at'], 'idx_video_sessions_participant_created');
            }
            if (Schema::hasColumn('video_sessions', 'status')) {
                $this->addIndexIfNotExists('video_sessions', ['status', 'started_at'], 'idx_video_sessions_status_started');
            }
        }

        // Clinical alerts optimization
        if (Schema::hasTable('clinical_alerts')) {
            if (Schema::hasColumn('clinical_alerts', 'patient_id')) {
                $this->addIndexIfNotExists('clinical_alerts', ['patient_id', 'severity', 'created_at'], 'idx_clinical_alerts_patient_severity_created');
            }
            if (Schema::hasColumn('clinical_alerts', 'resolved_at')) {
                $this->addIndexIfNotExists('clinical_alerts', ['resolved_at', 'created_at'], 'idx_clinical_alerts_resolved_created');
            }
        }
    }

    /**
     * Safely drop index if it exists (database-agnostic)
     */
    private function dropIndexIfExists(string $tableName, string $indexName): void
    {
        if ($this->indexExists($tableName, $indexName)) {
            try {
                Schema::table($tableName, function (Blueprint $table) use ($indexName) {
                    $table->dropIndex($indexName);
                });
            } catch (\Exception $e) {
                // If Laravel's Schema builder fails, fall back to raw SQL for MySQL
                $driver = DB::connection()->getDriverName();
                if ($driver === 'mysql') {
                    DB::statement("DROP INDEX `{$indexName}` ON `{$tableName}`");
                }
                // For other databases, let the exception bubble up or ignore
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove health_questionnaires indexes
        if (Schema::hasTable('health_questionnaires')) {
            $this->dropIndexIfExists('health_questionnaires', 'idx_health_questionnaires_user_id');
            $this->dropIndexIfExists('health_questionnaires', 'idx_health_created_status_type');
            $this->dropIndexIfExists('health_questionnaires', 'idx_health_beneficiary_status_created_complex');
            $this->dropIndexIfExists('health_questionnaires', 'idx_health_risk_assessment');
            $this->dropIndexIfExists('health_questionnaires', 'idx_health_template_completion');
            $this->dropIndexIfExists('health_questionnaires', 'idx_health_last_saved_status');
        }

        // Remove documents indexes
        if (Schema::hasTable('documents')) {
            $this->dropIndexIfExists('documents', 'idx_documents_user_created');
            $this->dropIndexIfExists('documents', 'idx_documents_beneficiary_created');
            $this->dropIndexIfExists('documents', 'idx_documents_user_beneficiary');
            $this->dropIndexIfExists('documents', 'idx_documents_ocr_status_created');
        }

        // Remove audit_logs indexes
        if (Schema::hasTable('audit_logs')) {
            $this->dropIndexIfExists('audit_logs', 'idx_audit_logs_user_created');
            $this->dropIndexIfExists('audit_logs', 'idx_audit_logs_action_created');
        }

        // Remove interviews indexes
        if (Schema::hasTable('interviews')) {
            $this->dropIndexIfExists('interviews', 'idx_interviews_beneficiary_slot');
            $this->dropIndexIfExists('interviews', 'idx_interviews_status_scheduled');
        }

        // Remove beneficiaries indexes
        if (Schema::hasTable('beneficiaries')) {
            $this->dropIndexIfExists('beneficiaries', 'idx_beneficiaries_company_status');
            $this->dropIndexIfExists('beneficiaries', 'idx_beneficiaries_email_created_enhanced');
            $this->dropIndexIfExists('beneficiaries', 'idx_beneficiaries_user_created');
        }

        // Remove users indexes
        if (Schema::hasTable('users')) {
            $this->dropIndexIfExists('users', 'idx_users_role_active');
            $this->dropIndexIfExists('users', 'idx_users_verified_created');
        }

        // Remove other table indexes
        if (Schema::hasTable('gamification_progress')) {
            $this->dropIndexIfExists('gamification_progress', 'idx_gamification_beneficiary_updated');
        }

        if (Schema::hasTable('notifications')) {
            $this->dropIndexIfExists('notifications', 'idx_notifications_notifiable_read');
        }

        if (Schema::hasTable('ocr_usage_logs')) {
            $this->dropIndexIfExists('ocr_usage_logs', 'idx_ocr_logs_user_created');
            $this->dropIndexIfExists('ocr_usage_logs', 'idx_ocr_logs_created_cost');
        }

        if (Schema::hasTable('video_sessions')) {
            $this->dropIndexIfExists('video_sessions', 'idx_video_sessions_participant_created');
            $this->dropIndexIfExists('video_sessions', 'idx_video_sessions_status_started');
        }

        if (Schema::hasTable('clinical_alerts')) {
            $this->dropIndexIfExists('clinical_alerts', 'idx_clinical_alerts_patient_severity_created');
            $this->dropIndexIfExists('clinical_alerts', 'idx_clinical_alerts_resolved_created');
        }
    }
};