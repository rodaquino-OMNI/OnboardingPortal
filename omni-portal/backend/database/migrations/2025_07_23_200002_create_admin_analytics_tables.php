<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations - Admin Analytics and Reporting Tables
     */
    public function up(): void
    {
        // System metrics aggregation table
        Schema::create('admin_system_metrics', function (Blueprint $table) {
            $table->id();
            $table->string('metric_type'); // user_activity, performance, security, business
            $table->string('metric_name'); // login_count, response_time, failed_logins, etc.
            $table->string('aggregation_period'); // hourly, daily, weekly, monthly
            $table->timestamp('period_start');
            $table->timestamp('period_end');
            $table->decimal('value', 15, 4);
            $table->string('unit')->nullable(); // ms, count, percentage, bytes
            $table->json('metadata')->nullable(); // Additional context
            $table->json('dimensions')->nullable(); // Breakdown by dimensions
            $table->timestamps();
            
            $table->unique(['metric_type', 'metric_name', 'aggregation_period', 'period_start'], 'idx_metrics_unique');
            $table->index(['metric_type', 'period_start']);
            $table->index('period_start');
        });

        // User behavior analytics
        Schema::create('admin_user_analytics', function (Blueprint $table) {
            $table->id();
            $table->date('date');
            $table->integer('total_users')->default(0);
            $table->integer('active_users')->default(0);
            $table->integer('new_registrations')->default(0);
            $table->integer('completed_registrations')->default(0);
            $table->decimal('registration_completion_rate', 5, 2)->default(0);
            $table->integer('total_logins')->default(0);
            $table->integer('unique_logins')->default(0);
            $table->decimal('avg_session_duration', 8, 2)->default(0); // minutes
            $table->integer('bounced_sessions')->default(0); // < 30 seconds
            $table->decimal('bounce_rate', 5, 2)->default(0);
            $table->json('top_pages')->nullable(); // Most visited pages
            $table->json('user_flow')->nullable(); // Common user paths
            $table->json('device_breakdown')->nullable(); // Desktop/mobile/tablet
            $table->json('browser_breakdown')->nullable();
            $table->json('location_breakdown')->nullable(); // Countries/cities
            $table->timestamps();
            
            $table->unique('date');
            $table->index('date');
        });

        // Business metrics and KPIs
        Schema::create('admin_business_metrics', function (Blueprint $table) {
            $table->id();
            $table->date('date');
            $table->integer('total_beneficiaries')->default(0);
            $table->integer('active_beneficiaries')->default(0);
            $table->integer('new_beneficiaries')->default(0);
            $table->integer('documents_uploaded')->default(0);
            $table->integer('documents_processed')->default(0);
            $table->integer('documents_approved')->default(0);
            $table->decimal('document_approval_rate', 5, 2)->default(0);
            $table->decimal('avg_processing_time', 8, 2)->default(0); // hours
            $table->integer('health_questionnaires_started')->default(0);
            $table->integer('health_questionnaires_completed')->default(0);
            $table->decimal('questionnaire_completion_rate', 5, 2)->default(0);
            $table->integer('interviews_scheduled')->default(0);
            $table->integer('interviews_completed')->default(0);
            $table->decimal('interview_completion_rate', 5, 2)->default(0);
            $table->integer('gamification_badges_earned')->default(0);
            $table->decimal('avg_engagement_score', 5, 2)->default(0);
            $table->json('onboarding_funnel')->nullable(); // Step-by-step conversion
            $table->json('department_breakdown')->nullable();
            $table->timestamps();
            
            $table->unique('date');
            $table->index('date');
        });

        // Performance monitoring
        Schema::create('admin_performance_metrics', function (Blueprint $table) {
            $table->id();
            $table->timestamp('recorded_at');
            $table->string('endpoint'); // API endpoint or page
            $table->string('method'); // GET, POST, etc.
            $table->decimal('response_time', 8, 3); // milliseconds
            $table->integer('status_code');
            $table->integer('memory_usage')->nullable(); // bytes
            $table->integer('cpu_usage')->nullable(); // percentage
            $table->integer('db_queries')->nullable();
            $table->decimal('db_time', 8, 3)->nullable(); // milliseconds
            $table->integer('cache_hits')->default(0);
            $table->integer('cache_misses')->default(0);
            $table->string('user_agent')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->json('headers')->nullable(); // Important headers
            $table->timestamps();
            
            $table->index(['endpoint', 'recorded_at']);
            $table->index('recorded_at');
            $table->index('status_code');
        });

        // Security metrics and alerts
        Schema::create('admin_security_metrics', function (Blueprint $table) {
            $table->id();
            $table->date('date');
            $table->integer('failed_login_attempts')->default(0);
            $table->integer('blocked_ips')->default(0);
            $table->integer('suspicious_activities')->default(0);
            $table->integer('rate_limit_hits')->default(0);
            $table->integer('csrf_token_failures')->default(0);
            $table->integer('permission_violations')->default(0);
            $table->integer('data_access_violations')->default(0);
            $table->integer('sensitive_data_accesses')->default(0);
            $table->json('threat_indicators')->nullable(); // Types of threats detected
            $table->json('vulnerability_scans')->nullable(); // Security scan results
            $table->json('compliance_checks')->nullable(); // LGPD compliance status
            $table->timestamps();
            
            $table->unique('date');
            $table->index('date');
        });

        // Custom report definitions
        Schema::create('admin_custom_reports', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->string('report_type'); // table, chart, dashboard, export
            $table->json('data_sources'); // Which tables/metrics to use
            $table->json('filters')->nullable(); // Default filters
            $table->json('columns')->nullable(); // Which columns to show
            $table->json('grouping')->nullable(); // How to group data
            $table->json('sorting')->nullable(); // Default sorting
            $table->json('visualization_config')->nullable(); // Chart configuration
            $table->string('schedule')->nullable(); // Cron expression for automated reports
            $table->json('recipients')->nullable(); // Email recipients for scheduled reports
            $table->boolean('is_public')->default(false); // Visible to all admins
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_run_at')->nullable();
            $table->json('execution_metadata')->nullable(); // Last run statistics
            $table->timestamps();
            
            $table->index(['created_by', 'is_active']);
            $table->index('is_public');
            $table->index('last_run_at');
        });

        // Report execution history
        Schema::create('admin_report_executions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->constrained('admin_custom_reports')->onDelete('cascade');
            $table->foreignId('executed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('started_at');
            $table->timestamp('completed_at')->nullable();
            $table->string('status'); // running, completed, failed, cancelled
            $table->json('parameters')->nullable(); // Execution parameters
            $table->integer('records_processed')->nullable();
            $table->text('error_message')->nullable();
            $table->string('output_format')->nullable(); // pdf, excel, csv, json
            $table->string('output_path')->nullable(); // Where the file was saved
            $table->integer('file_size')->nullable(); // bytes
            $table->decimal('execution_time', 8, 3)->nullable(); // seconds
            $table->json('metadata')->nullable();
            $table->timestamps();
            
            $table->index(['report_id', 'started_at']);
            $table->index('status');
            $table->index('started_at');
        });

        // Real-time alerts configuration
        Schema::create('admin_alert_rules', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->string('metric_source'); // Which table/metric to monitor
            $table->string('condition_type'); // threshold, anomaly, pattern
            $table->json('conditions'); // Specific conditions to check
            $table->string('severity'); // info, warning, error, critical
            $table->integer('evaluation_frequency')->default(300); // seconds
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_triggered_at')->nullable();
            $table->integer('trigger_count')->default(0);
            $table->json('notification_channels'); // email, slack, webhook, etc.
            $table->json('notification_config'); // Channel-specific configuration
            $table->boolean('auto_resolve')->default(false);
            $table->integer('auto_resolve_after')->nullable(); // minutes
            $table->json('metadata')->nullable();
            $table->timestamps();
            
            $table->index(['is_active', 'evaluation_frequency']);
            $table->index('last_triggered_at');
        });

        // Alert instances/history
        Schema::create('admin_alert_instances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('alert_rule_id')->constrained('admin_alert_rules')->onDelete('cascade');
            $table->timestamp('triggered_at');
            $table->timestamp('resolved_at')->nullable();
            $table->string('status'); // active, resolved, acknowledged, suppressed
            $table->json('trigger_data'); // Data that triggered the alert
            $table->text('message');
            $table->foreignId('acknowledged_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('acknowledged_at')->nullable();
            $table->text('acknowledgment_note')->nullable();
            $table->json('notification_log')->nullable(); // Track which notifications were sent
            $table->json('metadata')->nullable();
            $table->timestamps();
            
            $table->index(['alert_rule_id', 'triggered_at']);
            $table->index('status');
            $table->index('triggered_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('admin_alert_instances');
        Schema::dropIfExists('admin_alert_rules');
        Schema::dropIfExists('admin_report_executions');
        Schema::dropIfExists('admin_custom_reports');
        Schema::dropIfExists('admin_security_metrics');
        Schema::dropIfExists('admin_performance_metrics');
        Schema::dropIfExists('admin_business_metrics');
        Schema::dropIfExists('admin_user_analytics');
        Schema::dropIfExists('admin_system_metrics');
    }
};