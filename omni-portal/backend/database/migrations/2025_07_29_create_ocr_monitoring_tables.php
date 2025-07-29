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
        // OCR Processing Metrics table
        Schema::create('ocr_processing_metrics', function (Blueprint $table) {
            $table->id();
            $table->string('file_path');
            $table->float('processing_time')->comment('Processing time in seconds');
            $table->float('confidence_score')->comment('Average confidence score 0-1');
            $table->float('quality_score')->nullable()->comment('Document quality score 0-1');
            $table->bigInteger('file_size')->comment('File size in bytes');
            $table->integer('pages_processed')->default(1);
            $table->json('features_used')->nullable()->comment('Array of Textract features used');
            $table->integer('forms_detected')->default(0);
            $table->integer('tables_detected')->default(0);
            $table->boolean('success')->default(true);
            $table->json('metadata')->nullable()->comment('Additional processing metadata');
            $table->timestamps();
            
            // Indexes for performance
            $table->index('created_at');
            $table->index('success');
            $table->index(['created_at', 'success']);
            $table->index('confidence_score');
            $table->index('processing_time');
        });

        // OCR Alerts table
        Schema::create('ocr_alerts', function (Blueprint $table) {
            $table->id();
            $table->string('type')->comment('Alert type: high_processing_time, low_confidence, etc');
            $table->enum('severity', ['info', 'warning', 'error', 'critical']);
            $table->text('message');
            $table->json('metadata')->nullable();
            $table->enum('status', ['active', 'acknowledged', 'resolved'])->default('active');
            $table->text('resolution')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('type');
            $table->index('severity');
            $table->index('status');
            $table->index(['created_at', 'status']);
        });

        // Performance Reports table
        Schema::create('performance_reports', function (Blueprint $table) {
            $table->id();
            $table->string('period')->comment('Report period: 1h, 24h, 7d, 30d');
            $table->timestamp('generated_at');
            $table->json('performance')->comment('Performance metrics data');
            $table->json('recommendations')->nullable()->comment('Generated recommendations');
            $table->json('alerts')->nullable()->comment('Active alerts at time of report');
            $table->timestamps();
            
            // Indexes
            $table->index('period');
            $table->index('generated_at');
        });

        // Monitoring Events table for real-time tracking
        Schema::create('ocr_monitoring_events', function (Blueprint $table) {
            $table->id();
            $table->string('event_type')->comment('Event type: monitoring_started, monitoring_stopped, etc');
            $table->string('service')->default('textract');
            $table->json('event_data')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();
            
            // Indexes
            $table->index('event_type');
            $table->index('service');
            $table->index('occurred_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ocr_monitoring_events');
        Schema::dropIfExists('performance_reports');
        Schema::dropIfExists('ocr_alerts');
        Schema::dropIfExists('ocr_processing_metrics');
    }
};