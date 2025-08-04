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
        Schema::table('documents', function (Blueprint $table) {
            // Add new OCR processing fields (only if they don't exist)
            if (!Schema::hasColumn('documents', 'extracted_data')) {
                $table->json('extracted_data')->nullable()->after('ocr_data');
            }
            if (!Schema::hasColumn('documents', 'validation_results')) {
                $table->json('validation_results')->nullable()->after('extracted_data');
            }
            if (!Schema::hasColumn('documents', 'validation_status')) {
                $table->string('validation_status')->nullable()->after('validation_results');
            }
            if (!Schema::hasColumn('documents', 'processing_method')) {
                $table->string('processing_method')->nullable()->after('validation_status');
            }
            if (!Schema::hasColumn('documents', 'quality_score')) {
                $table->decimal('quality_score', 5, 2)->nullable()->after('processing_method');
            }
            if (!Schema::hasColumn('documents', 'confidence_score')) {
                $table->decimal('confidence_score', 5, 2)->nullable()->after('quality_score');
            }
            if (!Schema::hasColumn('documents', 'processing_started_at')) {
                $table->timestamp('processing_started_at')->nullable()->after('confidence_score');
            }
            if (!Schema::hasColumn('documents', 'processing_completed_at')) {
                $table->timestamp('processing_completed_at')->nullable()->after('processing_started_at');
            }
            if (!Schema::hasColumn('documents', 'error_message')) {
                $table->text('error_message')->nullable()->after('processing_completed_at');
            }
        });

        // Add indexes separately with existence checks
        if (!$this->indexExists('documents', 'documents_status_processing_method_index')) {
            Schema::table('documents', function (Blueprint $table) {
                $table->index(['status', 'processing_method']);
            });
        }
        if (!$this->indexExists('documents', 'documents_validation_status_index')) {
            Schema::table('documents', function (Blueprint $table) {
                $table->index(['validation_status']);
            });
        }
        if (!$this->indexExists('documents', 'documents_processing_started_at_processing_completed_at_index')) {
            Schema::table('documents', function (Blueprint $table) {
                $table->index(['processing_started_at', 'processing_completed_at']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop indexes first (only if they exist)
        if ($this->indexExists('documents', 'documents_status_processing_method_index')) {
            Schema::table('documents', function (Blueprint $table) {
                $table->dropIndex(['status', 'processing_method']);
            });
        }
        if ($this->indexExists('documents', 'documents_validation_status_index')) {
            Schema::table('documents', function (Blueprint $table) {
                $table->dropIndex(['validation_status']);
            });
        }
        if ($this->indexExists('documents', 'documents_processing_started_at_processing_completed_at_index')) {
            Schema::table('documents', function (Blueprint $table) {
                $table->dropIndex(['processing_started_at', 'processing_completed_at']);
            });
        }

        // Drop columns (only if they exist)
        Schema::table('documents', function (Blueprint $table) {
            $columnsToDrop = [];
            
            if (Schema::hasColumn('documents', 'extracted_data')) {
                $columnsToDrop[] = 'extracted_data';
            }
            if (Schema::hasColumn('documents', 'validation_results')) {
                $columnsToDrop[] = 'validation_results';
            }
            if (Schema::hasColumn('documents', 'validation_status')) {
                $columnsToDrop[] = 'validation_status';
            }
            if (Schema::hasColumn('documents', 'processing_method')) {
                $columnsToDrop[] = 'processing_method';
            }
            if (Schema::hasColumn('documents', 'quality_score')) {
                $columnsToDrop[] = 'quality_score';
            }
            if (Schema::hasColumn('documents', 'confidence_score')) {
                $columnsToDrop[] = 'confidence_score';
            }
            if (Schema::hasColumn('documents', 'processing_started_at')) {
                $columnsToDrop[] = 'processing_started_at';
            }
            if (Schema::hasColumn('documents', 'processing_completed_at')) {
                $columnsToDrop[] = 'processing_completed_at';
            }
            if (Schema::hasColumn('documents', 'error_message')) {
                $columnsToDrop[] = 'error_message';
            }

            if (!empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }

    /**
     * Check if an index exists on a table
     */
    private function indexExists(string $table, string $indexName): bool
    {
        try {
            $indexes = Schema::getConnection()->getSchemaBuilder()->getIndexes($table);
            return collect($indexes)->pluck('name')->contains($indexName);
        } catch (Exception $e) {
            return false;
        }
    }
};