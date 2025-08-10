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
        Schema::create('clinical_alerts', function (Blueprint $table) {
            $table->id();
            $table->uuid('alert_uuid')->unique();
            
            // Foreign Keys
            $table->foreignId('beneficiary_id')->constrained()->cascadeOnDelete();
            $table->foreignId('questionnaire_id')->nullable()->constrained('health_questionnaires');
            
            // Alert Classification
            $table->enum('alert_type', [
                'risk_threshold',      // Score exceeded threshold
                'risk_trend',         // Worsening trend detected
                'population_outlier', // Statistical outlier
                'combined_factors',   // Multiple risk factors
                'follow_up_due'      // Scheduled follow-up needed
            ]);
            
            $table->enum('category', [
                'mental_health',
                'substance_abuse',
                'cardiovascular',
                'chronic_disease',
                'allergy_safety',
                'preventive_care'
            ]);
            
            $table->enum('priority', ['low', 'medium', 'high', 'urgent', 'emergency']);
            
            // Risk Data
            $table->integer('risk_score');
            $table->json('risk_factors')->nullable();
            $table->json('risk_scores_detail')->nullable();
            
            // Alert Content
            $table->string('title');
            $table->text('message');
            $table->json('clinical_recommendations')->nullable();
            $table->json('intervention_options')->nullable();
            
            // Workflow Status
            $table->enum('status', [
                'pending',
                'acknowledged',
                'in_progress',
                'resolved',
                'escalated',
                'dismissed'
            ])->default('pending');
            
            // Assignment and Tracking
            $table->foreignId('assigned_to')->nullable()->constrained('users');
            $table->foreignId('acknowledged_by')->nullable()->constrained('users');
            $table->foreignId('resolved_by')->nullable()->constrained('users');
            
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('escalated_at')->nullable();
            
            // SLA Tracking
            $table->integer('sla_hours')->default(24);
            $table->timestamp('sla_deadline');
            $table->boolean('sla_breached')->default(false);
            
            // Clinical Notes
            $table->text('clinical_notes')->nullable();
            $table->text('resolution_notes')->nullable();
            
            // Metadata
            $table->json('metadata')->nullable();
            $table->json('audit_trail')->nullable();
            
            $table->timestamps();
            
            // Indexes for Performance
            $table->index(['status', 'priority']);
            $table->index(['beneficiary_id', 'created_at']);
            $table->index(['category', 'status']);
            $table->index(['assigned_to', 'status']);
            $table->index('sla_deadline');
            $table->index(['alert_type', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('clinical_alerts');
    }
};