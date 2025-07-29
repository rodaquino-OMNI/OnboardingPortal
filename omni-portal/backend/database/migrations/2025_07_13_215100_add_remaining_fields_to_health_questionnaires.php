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
            // Add all missing fields that the controller tries to use
            if (!Schema::hasColumn('health_questionnaires', 'metadata')) {
                $table->json('metadata')->nullable()->after('ai_insights');
            }
            
            if (!Schema::hasColumn('health_questionnaires', 'recommendations')) {
                $table->json('recommendations')->nullable()->after('metadata');
            }
            
            // Add index for better performance (only if not exists)
            if (!collect(Schema::getConnection()->getSchemaBuilder()->getIndexes('health_questionnaires'))->pluck('name')->contains('health_questionnaires_template_id_index')) {
                $table->index('template_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('health_questionnaires', function (Blueprint $table) {
            $table->dropColumn([
                'metadata',
                'recommendations'
            ]);
        });
    }
};