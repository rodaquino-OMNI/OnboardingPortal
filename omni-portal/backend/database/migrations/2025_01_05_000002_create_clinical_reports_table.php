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
        Schema::create('clinical_reports', function (Blueprint $table) {
            $table->id();
            $table->uuid('report_uuid')->unique();
            
            // Report Type and Period
            $table->enum('report_type', [
                'daily_summary',
                'weekly_analysis',
                'monthly_comprehensive',
                'quarterly_trends',
                'annual_review',
                'custom_period',
                'real_time_dashboard'
            ]);
            
            $table->date('period_start');
            $table->date('period_end');
            
            // Content and Format
            $table->enum('format', ['pdf', 'excel', 'json', 'csv']);
            $table->string('file_path')->nullable();
            $table->integer('file_size')->nullable();
            
            // Report Sections
            $table->json('sections_included')->nullable(); // Default set in model
            $table->json('filters_applied')->nullable();
            
            // Statistical Summary
            $table->json('statistics')->nullable();
            $table->json('risk_distribution')->nullable();
            $table->json('alert_summary')->nullable();
            $table->json('intervention_outcomes')->nullable();
            
            // Population Metrics
            $table->integer('total_patients_analyzed');
            $table->integer('high_risk_patients');
            $table->integer('interventions_recommended');
            $table->integer('follow_ups_scheduled');
            
            // Key Findings
            $table->json('key_findings')->nullable();
            $table->json('trends_identified')->nullable();
            $table->json('recommendations')->nullable();
            
            // Generation Details
            $table->foreignId('generated_by')->nullable()->constrained('users');
            $table->timestamp('generated_at');
            $table->integer('generation_time_seconds');
            $table->enum('generation_status', ['pending', 'processing', 'completed', 'failed'])->default('pending');
            $table->text('error_message')->nullable();
            
            // Distribution
            $table->json('recipients')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->boolean('is_scheduled')->default(false);
            $table->string('schedule_cron')->nullable();
            
            // Access Control
            $table->json('authorized_viewers')->nullable();
            $table->integer('view_count')->default(0);
            $table->timestamp('last_viewed_at')->nullable();
            
            // Compliance
            $table->boolean('contains_pii')->default(false);
            $table->boolean('is_anonymized')->default(true);
            $table->json('compliance_metadata')->nullable();
            
            $table->timestamps();
            
            // Indexes
            $table->index(['report_type', 'period_start', 'period_end']);
            $table->index(['generation_status', 'created_at']);
            $table->index('generated_by');
            $table->index('is_scheduled');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('clinical_reports');
    }
};