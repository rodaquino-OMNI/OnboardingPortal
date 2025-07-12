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
            // Fraud Detection Fields
            $table->json('response_timestamps')->nullable()->after('responses');
            $table->json('response_durations')->nullable()->after('response_timestamps');
            $table->integer('total_duration_seconds')->nullable()->after('response_durations');
            $table->boolean('has_suspicious_patterns')->default(false)->after('total_duration_seconds');
            $table->json('suspicious_patterns')->nullable()->after('has_suspicious_patterns');
            
            // Risk Scoring Fields
            $table->decimal('fraud_risk_score', 5, 2)->nullable()->after('risk_level');
            $table->json('risk_factors')->nullable()->after('fraud_risk_score');
            $table->json('consistency_checks')->nullable()->after('risk_factors');
            
            // Device and Session Tracking
            $table->string('device_fingerprint')->nullable()->after('consistency_checks');
            $table->string('ip_address')->nullable()->after('device_fingerprint');
            $table->string('user_agent')->nullable()->after('ip_address');
            $table->json('geolocation')->nullable()->after('user_agent');
            
            // Validation and Review Fields
            $table->boolean('requires_manual_review')->default(false)->after('geolocation');
            $table->string('review_reason')->nullable()->after('requires_manual_review');
            $table->timestamp('flagged_at')->nullable()->after('review_reason');
            $table->foreignId('flagged_by')->nullable()->constrained('users')->after('flagged_at');
            
            // Advanced Analytics
            $table->json('response_patterns')->nullable()->after('flagged_by');
            $table->json('ai_insights')->nullable()->after('response_patterns');
            $table->integer('revision_count')->default(0)->after('ai_insights');
            $table->json('revision_history')->nullable()->after('revision_count');
            
            // Indexes for performance
            $table->index('fraud_risk_score');
            $table->index('has_suspicious_patterns');
            $table->index('requires_manual_review');
            $table->index('device_fingerprint');
            $table->index('flagged_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('health_questionnaires', function (Blueprint $table) {
            $table->dropColumn([
                'response_timestamps',
                'response_durations',
                'total_duration_seconds',
                'has_suspicious_patterns',
                'suspicious_patterns',
                'fraud_risk_score',
                'risk_factors',
                'consistency_checks',
                'device_fingerprint',
                'ip_address',
                'user_agent',
                'geolocation',
                'requires_manual_review',
                'review_reason',
                'flagged_at',
                'flagged_by',
                'response_patterns',
                'ai_insights',
                'revision_count',
                'revision_history'
            ]);
        });
    }
};