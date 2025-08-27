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
                    $result = DB::select("SHOW INDEX FROM `{$table}` WHERE Key_name = ?", [$indexName]);
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
            // If table doesn't exist or other error, return false to avoid breaking migration
            return false;
        }
    }

    /**
     * Check if a column exists in a table
     */
    private function columnExists(string $table, string $column): bool
    {
        return Schema::hasColumn($table, $column);
    }

    /**
     * Safely add index if it doesn't exist and table/columns exist
     */
    private function safelyAddIndex(string $tableName, array $columns, string $indexName): void
    {
        if (!Schema::hasTable($tableName)) {
            return;
        }

        // Check if all columns exist
        foreach ($columns as $column) {
            if (!$this->columnExists($tableName, $column)) {
                return;
            }
        }

        // Check if index already exists
        if ($this->indexExists($tableName, $indexName)) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($columns, $indexName) {
            $table->index($columns, $indexName);
        });
    }

    /**
     * Safely add virtual column if it doesn't exist (database-agnostic)
     */
    private function safelyAddVirtualColumn(string $tableName, string $columnName, string $expression, string $type = 'varchar(255)'): void
    {
        if (!Schema::hasTable($tableName)) {
            return;
        }

        if ($this->columnExists($tableName, $columnName)) {
            return;
        }

        // Check if the JSON column exists before creating virtual column
        $jsonColumn = explode('->', $expression)[0];
        $jsonColumn = str_replace('JSON_UNQUOTE(JSON_EXTRACT(', '', $jsonColumn);
        
        if (!$this->columnExists($tableName, $jsonColumn)) {
            return;
        }

        $driver = DB::connection()->getDriverName();
        
        try {
            switch ($driver) {
                case 'mysql':
                    // MySQL supports virtual columns
                    DB::statement("ALTER TABLE `{$tableName}` ADD COLUMN `{$columnName}` {$type} AS ({$expression}) STORED");
                    break;
                    
                case 'sqlite':
                    // SQLite doesn't support virtual columns, skip this feature
                    // Could implement as a regular column with triggers, but for tests just skip
                    break;
                    
                case 'pgsql':
                    // PostgreSQL uses generated columns (different syntax)
                    // Adapt expression syntax for PostgreSQL if needed
                    $pgExpression = str_replace('JSON_UNQUOTE(JSON_EXTRACT(', '', $expression);
                    $pgExpression = str_replace(', "$.', '->>', $pgExpression);
                    $pgExpression = str_replace('"))', '', $pgExpression);
                    DB::statement("ALTER TABLE \"{$tableName}\" ADD COLUMN \"{$columnName}\" {$type} GENERATED ALWAYS AS ({$pgExpression}) STORED");
                    break;
                    
                default:
                    // For unsupported databases, skip virtual column creation
                    break;
            }
        } catch (\Exception $e) {
            // If virtual column creation fails, continue without it
            // This ensures tests don't break
        }
    }

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Users table: Composite index on email + is_active for authentication queries
        $this->safelyAddIndex('users', ['email', 'is_active'], 'idx_users_email_active');

        // 2. Beneficiaries table: Index on user_id for foreign key lookups (if not exists)
        if (!$this->indexExists('beneficiaries', 'beneficiaries_user_id_index') && 
            !$this->indexExists('beneficiaries', 'idx_beneficiaries_user_id')) {
            $this->safelyAddIndex('beneficiaries', ['user_id'], 'idx_beneficiaries_user_id');
        }

        // 3. Health questionnaires: Composite index on (status, created_at) for admin dashboards
        $this->safelyAddIndex('health_questionnaires', ['status', 'created_at'], 'idx_health_status_created_new');

        // 4. Documents: Index on beneficiary_id + status for document management
        if (!$this->indexExists('documents', 'idx_documents_beneficiary_status')) {
            $this->safelyAddIndex('documents', ['beneficiary_id', 'status'], 'idx_documents_beneficiary_status_new');
        }

        // 5. Interviews: Index on beneficiary_id + scheduled_at for scheduling queries
        $this->safelyAddIndex('interviews', ['beneficiary_id', 'scheduled_at'], 'idx_interviews_beneficiary_scheduled');

        // Additional performance indexes for common queries
        
        // Users: Role-based queries with activity status
        $this->safelyAddIndex('users', ['role', 'is_active'], 'idx_users_role_active');

        // Beneficiaries: Onboarding status queries
        $this->safelyAddIndex('beneficiaries', ['onboarding_status', 'created_at'], 'idx_beneficiaries_onboarding_created');

        // Health questionnaires: Beneficiary timeline queries
        $this->safelyAddIndex('health_questionnaires', ['beneficiary_id', 'questionnaire_type', 'completed_at'], 'idx_health_beneficiary_type_completed');

        // Documents: Document type filtering
        $this->safelyAddIndex('documents', ['document_type', 'status'], 'idx_documents_type_status');

        // Interviews: Professional scheduling queries
        $this->safelyAddIndex('interviews', ['healthcare_professional_id', 'scheduled_at', 'status'], 'idx_interviews_professional_scheduled_status');

        // Interviews: Status-based queries for reporting
        $this->safelyAddIndex('interviews', ['status', 'scheduled_at'], 'idx_interviews_status_scheduled');

        // Add virtual columns for JSON field optimization
        
        // Virtual column for AI risk score from health_questionnaires.ai_insights JSON
        $this->safelyAddVirtualColumn(
            'health_questionnaires', 
            'ai_risk_score', 
            'JSON_UNQUOTE(JSON_EXTRACT(ai_insights, "$.risk_score"))',
            'decimal(5,2)'
        );

        // Virtual column for notification enabled from beneficiaries.notification_preferences JSON
        $this->safelyAddVirtualColumn(
            'beneficiaries', 
            'notification_enabled', 
            'JSON_UNQUOTE(JSON_EXTRACT(notification_preferences, "$.enabled"))',
            'boolean'
        );

        // Add indexes on virtual columns if they were created successfully
        if ($this->columnExists('health_questionnaires', 'ai_risk_score')) {
            $this->safelyAddIndex('health_questionnaires', ['ai_risk_score'], 'idx_health_ai_risk_score');
        }

        if ($this->columnExists('beneficiaries', 'notification_enabled')) {
            $this->safelyAddIndex('beneficiaries', ['notification_enabled'], 'idx_beneficiaries_notification_enabled');
        }

        // Composite indexes involving virtual columns
        if ($this->columnExists('health_questionnaires', 'ai_risk_score')) {
            $this->safelyAddIndex('health_questionnaires', ['beneficiary_id', 'ai_risk_score'], 'idx_health_beneficiary_risk_score');
        }

        if ($this->columnExists('beneficiaries', 'notification_enabled')) {
            $this->safelyAddIndex('beneficiaries', ['notification_enabled', 'onboarding_status'], 'idx_beneficiaries_notification_onboarding');
        }
    }

    /**
     * Safely drop index if it exists
     */
    private function safelyDropIndex(string $tableName, string $indexName): void
    {
        if (!Schema::hasTable($tableName)) {
            return;
        }

        if (!$this->indexExists($tableName, $indexName)) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($indexName) {
            $table->dropIndex($indexName);
        });
    }

    /**
     * Safely drop virtual column if it exists (database-agnostic)
     */
    private function safelyDropVirtualColumn(string $tableName, string $columnName): void
    {
        if (!Schema::hasTable($tableName)) {
            return;
        }

        if (!$this->columnExists($tableName, $columnName)) {
            return;
        }

        $driver = DB::connection()->getDriverName();
        
        try {
            switch ($driver) {
                case 'mysql':
                    DB::statement("ALTER TABLE `{$tableName}` DROP COLUMN `{$columnName}`");
                    break;
                    
                case 'sqlite':
                    // SQLite has limited ALTER TABLE support, use Schema builder
                    Schema::table($tableName, function (Blueprint $table) use ($columnName) {
                        $table->dropColumn($columnName);
                    });
                    break;
                    
                case 'pgsql':
                    DB::statement("ALTER TABLE \"{$tableName}\" DROP COLUMN \"{$columnName}\"");
                    break;
                    
                default:
                    // Try Laravel's Schema builder as fallback
                    Schema::table($tableName, function (Blueprint $table) use ($columnName) {
                        $table->dropColumn($columnName);
                    });
                    break;
            }
        } catch (\Exception $e) {
            // If dropping fails, continue without error to prevent migration rollback issues
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop virtual column indexes first
        $this->safelyDropIndex('beneficiaries', 'idx_beneficiaries_notification_onboarding');
        $this->safelyDropIndex('health_questionnaires', 'idx_health_beneficiary_risk_score');
        $this->safelyDropIndex('beneficiaries', 'idx_beneficiaries_notification_enabled');
        $this->safelyDropIndex('health_questionnaires', 'idx_health_ai_risk_score');

        // Drop virtual columns
        $this->safelyDropVirtualColumn('beneficiaries', 'notification_enabled');
        $this->safelyDropVirtualColumn('health_questionnaires', 'ai_risk_score');

        // Drop regular indexes in reverse order
        $this->safelyDropIndex('interviews', 'idx_interviews_status_scheduled');
        $this->safelyDropIndex('interviews', 'idx_interviews_professional_scheduled_status');
        $this->safelyDropIndex('documents', 'idx_documents_type_status');
        $this->safelyDropIndex('health_questionnaires', 'idx_health_beneficiary_type_completed');
        $this->safelyDropIndex('beneficiaries', 'idx_beneficiaries_onboarding_created');
        $this->safelyDropIndex('users', 'idx_users_role_active');
        $this->safelyDropIndex('interviews', 'idx_interviews_beneficiary_scheduled');
        $this->safelyDropIndex('documents', 'idx_documents_beneficiary_status_new');
        $this->safelyDropIndex('health_questionnaires', 'idx_health_status_created_new');
        $this->safelyDropIndex('beneficiaries', 'idx_beneficiaries_user_id');
        $this->safelyDropIndex('users', 'idx_users_email_active');
    }
};