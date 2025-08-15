<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddProcessingFieldsToHealthQuestionnaires extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('health_questionnaires', function (Blueprint $table) {
            // Add processing status JSON field to track coordination
            $table->json('processing_status')->nullable()->after('fraud_risk_score');
            
            // Add risk scores snapshot to preserve original values for gamification
            $table->json('risk_scores_snapshot')->nullable()->after('processing_status');
            
            // Add index for querying processing status
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('health_questionnaires', function (Blueprint $table) {
            $table->dropColumn(['processing_status', 'risk_scores_snapshot']);
            $table->dropIndex(['created_at']);
        });
    }
}