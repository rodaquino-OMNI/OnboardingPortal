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
            // Add new OCR processing fields
            $table->json('extracted_data')->nullable()->after('ocr_data');
            $table->json('validation_results')->nullable()->after('extracted_data');
            $table->string('validation_status')->nullable()->after('validation_results');
            $table->string('processing_method')->nullable()->after('validation_status');
            $table->decimal('quality_score', 5, 2)->nullable()->after('processing_method');
            $table->decimal('confidence_score', 5, 2)->nullable()->after('quality_score');
            $table->timestamp('processing_started_at')->nullable()->after('confidence_score');
            $table->timestamp('processing_completed_at')->nullable()->after('processing_started_at');
            $table->text('error_message')->nullable()->after('processing_completed_at');

            // Add indexes for better query performance
            $table->index(['status', 'processing_method']);
            $table->index(['validation_status']);
            $table->index(['processing_started_at', 'processing_completed_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            // Drop indexes first
            $table->dropIndex(['status', 'processing_method']);
            $table->dropIndex(['validation_status']);
            $table->dropIndex(['processing_started_at', 'processing_completed_at']);

            // Drop columns
            $table->dropColumn([
                'extracted_data',
                'validation_results',
                'validation_status',
                'processing_method',
                'quality_score',
                'confidence_score',
                'processing_started_at',
                'processing_completed_at',
                'error_message'
            ]);
        });
    }
};