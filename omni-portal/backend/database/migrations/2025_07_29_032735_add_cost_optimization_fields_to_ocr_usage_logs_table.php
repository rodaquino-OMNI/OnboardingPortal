<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('ocr_usage_logs', function (Blueprint $table) {
            // Only add columns that don't already exist
            if (!Schema::hasColumn('ocr_usage_logs', 'estimated_cost')) {
                $table->decimal('estimated_cost', 10, 4)->nullable()->after('cost');
            }
            if (!Schema::hasColumn('ocr_usage_logs', 'accuracy')) {
                $table->decimal('accuracy', 5, 4)->nullable()->after('estimated_cost');
            }
            if (!Schema::hasColumn('ocr_usage_logs', 'processing_time')) {
                $table->decimal('processing_time', 10, 3)->nullable()->after('accuracy');
            }
            // Note: metadata column already exists in the original migration
        });

        // Add indexes separately to handle existing index checks properly
        $this->addIndexIfNotExists('ocr_usage_logs', 'estimated_cost', 'ocr_usage_logs_estimated_cost_index');
        $this->addIndexIfNotExists('ocr_usage_logs', 'accuracy', 'ocr_usage_logs_accuracy_index');
        // Note: provider,created_at index already exists in the original migration
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop indexes if they exist
        $this->dropIndexIfExists('ocr_usage_logs', 'ocr_usage_logs_accuracy_index');
        $this->dropIndexIfExists('ocr_usage_logs', 'ocr_usage_logs_estimated_cost_index');
        
        // Drop columns if they exist
        Schema::table('ocr_usage_logs', function (Blueprint $table) {
            $columns = [];
            if (Schema::hasColumn('ocr_usage_logs', 'processing_time')) {
                $columns[] = 'processing_time';
            }
            if (Schema::hasColumn('ocr_usage_logs', 'accuracy')) {
                $columns[] = 'accuracy';
            }
            if (Schema::hasColumn('ocr_usage_logs', 'estimated_cost')) {
                $columns[] = 'estimated_cost';
            }
            
            if (!empty($columns)) {
                $table->dropColumn($columns);
            }
        });
    }

    /**
     * Add an index if it doesn't already exist.
     *
     * @param string $table
     * @param string|array $columns
     * @param string $indexName
     * @return void
     */
    private function addIndexIfNotExists(string $table, $columns, string $indexName): void
    {
        // Get the schema builder to access index checking methods
        $schema = Schema::getConnection()->getSchemaBuilder();
        
        // Get all indexes for the table
        $indexes = $schema->getIndexes($table);
        
        // Check if index already exists
        $indexExists = false;
        foreach ($indexes as $index) {
            if ($index['name'] === $indexName) {
                $indexExists = true;
                break;
            }
        }
        
        if (!$indexExists) {
            Schema::table($table, function (Blueprint $table) use ($columns) {
                $table->index($columns);
            });
        }
    }

    /**
     * Drop an index if it exists.
     *
     * @param string $table
     * @param string $indexName
     * @return void
     */
    private function dropIndexIfExists(string $table, string $indexName): void
    {
        // Get the schema builder to access index checking methods
        $schema = Schema::getConnection()->getSchemaBuilder();
        
        // Get all indexes for the table
        $indexes = $schema->getIndexes($table);
        
        // Check if index exists
        $indexExists = false;
        foreach ($indexes as $index) {
            if ($index['name'] === $indexName) {
                $indexExists = true;
                break;
            }
        }
        
        if ($indexExists) {
            Schema::table($table, function (Blueprint $table) use ($indexName) {
                $table->dropIndex($indexName);
            });
        }
    }
};