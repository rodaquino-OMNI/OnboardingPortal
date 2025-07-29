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
            // Progressive screening specific fields
            $table->string('progressive_layer')->nullable()->after('fraud_risk_score'); // triage, targeted, specialized
            $table->json('progressive_scores')->nullable()->after('progressive_layer'); // Scores from each layer
            $table->json('progressive_actions')->nullable()->after('progressive_scores'); // Actions triggered
            $table->json('progressive_next_steps')->nullable()->after('progressive_actions'); // Next steps for user
            
            // Additional fields that the controller expects
            $table->decimal('fraud_detection_score', 5, 2)->nullable()->after('progressive_next_steps');
            $table->decimal('consistency_score', 5, 2)->nullable()->after('fraud_detection_score');
            $table->json('response_time_analysis')->nullable()->after('consistency_score');
            
            // Index for performance
            $table->index('progressive_layer');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('health_questionnaires', function (Blueprint $table) {
            $table->dropColumn([
                'progressive_layer',
                'progressive_scores',
                'progressive_actions',
                'progressive_next_steps',
                'fraud_detection_score',
                'consistency_score',
                'response_time_analysis'
            ]);
        });
    }
};