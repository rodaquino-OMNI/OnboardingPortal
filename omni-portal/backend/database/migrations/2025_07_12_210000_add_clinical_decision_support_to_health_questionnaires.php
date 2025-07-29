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
        Schema::table('health_questionnaires', function (Blueprint $table) {
            // Clinical Decision Support Fields
            $table->json('clinical_decisions')->nullable()->after('progressive_next_steps');
            $table->json('icd10_codes')->nullable()->after('clinical_decisions');
            $table->string('severity_level')->nullable()->after('icd10_codes');
            $table->integer('confidence_score')->default(0)->after('severity_level');
            
            // Emergency Protocol Fields
            $table->json('emergency_protocol')->nullable()->after('confidence_score');
            $table->boolean('emergency_detected')->default(false)->after('emergency_protocol');
            $table->timestamp('emergency_timestamp')->nullable()->after('emergency_detected');
            
            // Clinical Recommendations
            $table->json('clinical_recommendations')->nullable()->after('emergency_timestamp');
            $table->integer('time_to_intervention')->nullable()->after('clinical_recommendations'); // hours
            $table->boolean('escalation_required')->default(false)->after('time_to_intervention');
            
            // Performance Metrics
            $table->json('assessment_metrics')->nullable()->after('escalation_required');
            $table->decimal('completion_rate', 5, 2)->default(0)->after('assessment_metrics');
            $table->integer('average_response_time')->nullable()->after('completion_rate'); // seconds
            
            // Audit and Compliance
            $table->json('audit_trail')->nullable()->after('average_response_time');
            $table->timestamp('consent_timestamp')->nullable()->after('audit_trail');
            $table->boolean('hipaa_compliant')->default(true)->after('consent_timestamp');
            $table->boolean('lgpd_compliant')->default(true)->after('hipaa_compliant');
            
            // Indexes for performance
            $table->index(['emergency_detected', 'emergency_timestamp']);
            $table->index(['severity_level', 'escalation_required']);
            $table->index(['confidence_score']);
            $table->index(['completion_rate']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('health_questionnaires', function (Blueprint $table) {
            $table->dropColumn([
                'clinical_decisions',
                'icd10_codes',
                'severity_level',
                'confidence_score',
                'emergency_protocol',
                'emergency_detected',
                'emergency_timestamp',
                'clinical_recommendations',
                'time_to_intervention',
                'escalation_required',
                'assessment_metrics',
                'completion_rate',
                'average_response_time',
                'audit_trail',
                'consent_timestamp',
                'hipaa_compliant',
                'lgpd_compliant'
            ]);
            
            $table->dropIndex(['health_questionnaires_emergency_detected_emergency_timestamp_index']);
            $table->dropIndex(['health_questionnaires_severity_level_escalation_required_index']);
            $table->dropIndex(['health_questionnaires_confidence_score_index']);
            $table->dropIndex(['health_questionnaires_completion_rate_index']);
        });
    }
};