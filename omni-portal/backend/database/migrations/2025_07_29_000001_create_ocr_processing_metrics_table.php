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
        Schema::create('ocr_processing_metrics', function (Blueprint $table) {
            $table->id();
            $table->string('file_path');
            $table->string('service'); // 'textract' or 'tesseract'
            $table->float('processing_time')->nullable();
            $table->float('confidence_score')->nullable();
            $table->float('quality_score')->nullable();
            $table->bigInteger('file_size')->nullable();
            $table->integer('pages_processed')->default(1);
            $table->json('features_used')->nullable();
            $table->string('document_type')->nullable();
            $table->boolean('success')->default(true);
            $table->json('metrics')->nullable();
            $table->json('result_summary')->nullable();
            $table->timestamps();
            
            // Indexes for performance
            $table->index('service');
            $table->index('document_type');
            $table->index('created_at');
            $table->index(['service', 'created_at']);
            $table->index(['success', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ocr_processing_metrics');
    }
};