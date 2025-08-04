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
        // Add fields to ocr_usage_logs if it exists
        if (Schema::hasTable('ocr_usage_logs')) {
            Schema::table('ocr_usage_logs', function (Blueprint $table) {
                if (!Schema::hasColumn('ocr_usage_logs', 'estimated_cost')) {
                    $table->decimal('estimated_cost', 10, 4)->nullable()->after('cost');
                }
                if (!Schema::hasColumn('ocr_usage_logs', 'accuracy')) {
                    $table->decimal('accuracy', 5, 2)->nullable()->after('estimated_cost');
                }
                if (!Schema::hasColumn('ocr_usage_logs', 'processing_time')) {
                    $table->integer('processing_time')->nullable()->comment('Processing time in milliseconds');
                }
                if (!Schema::hasColumn('ocr_usage_logs', 'metadata')) {
                    $table->json('metadata')->nullable();
                }
                
                // Add indexes for performance (check if they don't exist)
                if (!collect(Schema::getIndexes('ocr_usage_logs'))->pluck('name')->contains('ocr_usage_logs_provider_created_at_index')) {
                    $table->index(['provider', 'created_at']);
                }
                if (!collect(Schema::getIndexes('ocr_usage_logs'))->pluck('name')->contains('ocr_usage_logs_cost_index')) {
                    $table->index('cost');
                }
            });
        }

        // Create ocr_processing_metrics table for detailed monitoring (only if it doesn't exist)
        if (!Schema::hasTable('ocr_processing_metrics')) {
            Schema::create('ocr_processing_metrics', function (Blueprint $table) {
            $table->id();
            $table->string('document_id')->nullable();
            $table->string('file_path');
            $table->string('document_type', 50);
            $table->string('processing_method', 50); // textract, tesseract, etc.
            $table->integer('processing_time'); // milliseconds
            $table->decimal('confidence_score', 5, 2);
            $table->decimal('quality_score', 5, 2);
            $table->integer('file_size');
            $table->integer('pages_processed')->default(1);
            $table->json('features_used')->nullable();
            $table->integer('forms_detected')->default(0);
            $table->integer('tables_detected')->default(0);
            $table->integer('signatures_detected')->default(0);
            $table->boolean('success')->default(true);
            $table->text('error_message')->nullable();
            $table->json('quality_metrics')->nullable();
            $table->timestamps();

            // Indexes for analytics
            $table->index(['processing_method', 'created_at']);
            $table->index(['document_type', 'created_at']);
            $table->index('confidence_score');
            $table->index('processing_time');
        });
        }

        // Create ocr_cost_predictions table (only if it doesn't exist)
        if (!Schema::hasTable('ocr_cost_predictions')) {
            Schema::create('ocr_cost_predictions', function (Blueprint $table) {
            $table->id();
            $table->string('document_type', 50);
            $table->json('features');
            $table->decimal('estimated_cost', 10, 4);
            $table->decimal('actual_cost', 10, 4)->nullable();
            $table->decimal('accuracy_rate', 5, 2)->nullable();
            $table->integer('sample_size')->default(1);
            $table->timestamps();

            $table->index(['document_type', 'created_at']);
        });
        }

        // Create ocr_alerts table (only if it doesn't exist)
        if (!Schema::hasTable('ocr_alerts')) {
            Schema::create('ocr_alerts', function (Blueprint $table) {
            $table->id();
            $table->string('type', 50); // budget_alert, performance_alert, error_alert
            $table->string('severity', 20); // info, warning, critical
            $table->string('metric', 50)->nullable();
            $table->decimal('value', 10, 2)->nullable();
            $table->decimal('threshold', 10, 2)->nullable();
            $table->text('message');
            $table->json('metadata')->nullable();
            $table->boolean('resolved')->default(false);
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['type', 'created_at']);
            $table->index(['severity', 'resolved']);
        });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('ocr_usage_logs')) {
            Schema::table('ocr_usage_logs', function (Blueprint $table) {
                $table->dropColumn(['estimated_cost', 'accuracy', 'processing_time', 'metadata']);
                $table->dropIndex(['provider', 'created_at']);
                $table->dropIndex(['cost']);
            });
        }

        Schema::dropIfExists('ocr_processing_metrics');
        Schema::dropIfExists('ocr_cost_predictions');
        Schema::dropIfExists('ocr_alerts');
    }
};