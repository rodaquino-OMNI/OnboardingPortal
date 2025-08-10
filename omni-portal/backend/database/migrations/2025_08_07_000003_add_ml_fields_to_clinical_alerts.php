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
        Schema::table('clinical_alerts', function (Blueprint $table) {
            // ML prediction fields
            $table->json('predicted_outcomes')->nullable()->after('outcome_metrics');
            $table->float('prediction_confidence', 3, 2)->nullable()->after('predicted_outcomes');
            $table->json('similar_cases')->nullable()->after('prediction_confidence');
            $table->json('recommended_interventions_ml')->nullable()->after('similar_cases');
            
            // Webhook notification fields
            $table->timestamp('webhook_notified_at')->nullable()->after('resolved_at');
            $table->enum('webhook_notification_status', ['pending', 'delivered', 'failed', 'failed_permanently'])
                ->nullable()
                ->after('webhook_notified_at');
            $table->text('webhook_error')->nullable()->after('webhook_notification_status');
            
            // Cost analysis fields
            $table->decimal('estimated_cost_impact', 10, 2)->nullable()->after('webhook_error');
            $table->decimal('actual_cost_impact', 10, 2)->nullable()->after('estimated_cost_impact');
            
            // Add indexes for new fields
            $table->index('webhook_notification_status');
            $table->index('prediction_confidence');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('clinical_alerts', function (Blueprint $table) {
            // Remove indexes first
            $table->dropIndex(['webhook_notification_status']);
            $table->dropIndex(['prediction_confidence']);
            
            // Remove columns
            $table->dropColumn([
                'predicted_outcomes',
                'prediction_confidence',
                'similar_cases',
                'recommended_interventions_ml',
                'webhook_notified_at',
                'webhook_notification_status',
                'webhook_error',
                'estimated_cost_impact',
                'actual_cost_impact'
            ]);
        });
    }
};