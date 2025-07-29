<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('health_questionnaires', function (Blueprint $table) {
            // Add template_id field that the controller expects
            $table->foreignId('template_id')->nullable()->after('beneficiary_id')->constrained('questionnaire_templates')->onDelete('set null');
            
            // Add missing fields that the controller expects
            if (!Schema::hasColumn('health_questionnaires', 'responses')) {
                $table->json('responses')->nullable()->after('custom_responses');
            }
            
            if (!Schema::hasColumn('health_questionnaires', 'current_section')) {
                $table->string('current_section')->nullable()->after('responses');
            }
            
            if (!Schema::hasColumn('health_questionnaires', 'started_at')) {
                $table->timestamp('started_at')->nullable()->after('current_section');
            }
            
            if (!Schema::hasColumn('health_questionnaires', 'last_saved_at')) {
                $table->timestamp('last_saved_at')->nullable()->after('started_at');
            }
            
            if (!Schema::hasColumn('health_questionnaires', 'risk_scores')) {
                $table->json('risk_scores')->nullable()->after('last_saved_at');
            }
            
            if (!Schema::hasColumn('health_questionnaires', 'ai_insights')) {
                $table->json('ai_insights')->nullable()->after('risk_scores');
            }
        });
        
        // Update status enum to include new values
        DB::statement("UPDATE health_questionnaires SET status = 'draft' WHERE status NOT IN ('draft', 'completed', 'reviewed', 'archived')");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('health_questionnaires', function (Blueprint $table) {
            $table->dropForeign(['template_id']);
            $table->dropColumn([
                'template_id',
                'responses',
                'current_section',
                'started_at',
                'last_saved_at',
                'risk_scores',
                'ai_insights'
            ]);
        });
    }
};