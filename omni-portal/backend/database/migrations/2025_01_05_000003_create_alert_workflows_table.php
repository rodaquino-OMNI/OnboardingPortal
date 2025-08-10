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
        Schema::create('alert_workflows', function (Blueprint $table) {
            $table->id();
            $table->uuid('workflow_uuid')->unique();
            
            // Related Alert
            $table->foreignId('alert_id')->constrained('clinical_alerts')->cascadeOnDelete();
            $table->foreignId('beneficiary_id')->constrained()->cascadeOnDelete();
            
            // Workflow Step
            $table->enum('action_type', [
                'alert_created',
                'alert_acknowledged',
                'assessment_scheduled',
                'intervention_planned',
                'patient_contacted',
                'follow_up_scheduled',
                'escalated_to_specialist',
                'resolved',
                'closed_no_action'
            ]);
            
            // Action Details
            $table->text('action_description');
            $table->json('action_metadata')->nullable();
            
            // Performed By
            $table->foreignId('performed_by')->constrained('users');
            $table->string('performer_role')->nullable();
            
            // Clinical Details
            $table->text('clinical_notes')->nullable();
            $table->json('assessments_performed')->nullable();
            $table->json('interventions_applied')->nullable();
            
            // Next Steps
            $table->json('next_actions')->nullable();
            $table->timestamp('next_review_date')->nullable();
            $table->foreignId('assigned_to_next')->nullable()->constrained('users');
            
            // Outcomes
            $table->enum('outcome', [
                'pending',
                'successful',
                'partially_successful',
                'unsuccessful',
                'patient_declined',
                'not_applicable'
            ])->nullable();
            
            $table->json('outcome_metrics')->nullable();
            
            // Timestamps
            $table->timestamp('action_timestamp');
            $table->timestamps();
            
            // Indexes
            $table->index(['alert_id', 'action_timestamp']);
            $table->index(['beneficiary_id', 'action_type']);
            $table->index(['performed_by', 'action_timestamp']);
            $table->index('next_review_date');
        });
        
        // Create intervention_templates table
        Schema::create('intervention_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description');
            
            $table->enum('risk_category', [
                'mental_health',
                'substance_abuse',
                'cardiovascular',
                'chronic_disease',
                'allergy_safety',
                'preventive_care'
            ]);
            
            $table->enum('risk_level', ['low', 'medium', 'high', 'critical']);
            
            // Template Content
            $table->json('recommended_actions');
            $table->json('resources_needed');
            $table->json('expected_outcomes');
            $table->integer('typical_duration_days');
            
            // Evidence Base
            $table->text('clinical_guidelines')->nullable();
            $table->json('evidence_references')->nullable();
            $table->float('success_rate')->nullable();
            
            // Usage
            $table->boolean('is_active')->default(true);
            $table->integer('times_used')->default(0);
            $table->timestamp('last_used_at')->nullable();
            
            $table->timestamps();
            
            // Indexes
            $table->index(['risk_category', 'risk_level']);
            $table->index('is_active');
        });
        
        // Create alert_escalation_rules table
        Schema::create('alert_escalation_rules', function (Blueprint $table) {
            $table->id();
            
            $table->enum('trigger_type', [
                'sla_breach',
                'risk_score_increase',
                'no_response',
                'critical_finding',
                'manual_escalation'
            ]);
            
            $table->json('trigger_conditions');
            
            $table->enum('escalation_level', [
                'team_lead',
                'department_head',
                'medical_director',
                'emergency_response'
            ]);
            
            $table->json('notification_channels'); // email, sms, push, system
            $table->json('recipients_roles');
            
            $table->boolean('is_active')->default(true);
            $table->integer('times_triggered')->default(0);
            
            $table->timestamps();
            
            // Indexes
            $table->index(['trigger_type', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('alert_escalation_rules');
        Schema::dropIfExists('intervention_templates');
        Schema::dropIfExists('alert_workflows');
    }
};