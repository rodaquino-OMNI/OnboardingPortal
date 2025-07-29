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
        Schema::table('ocr_usage_logs', function (Blueprint $table) {
            $table->decimal('estimated_cost', 10, 4)->nullable()->after('cost');
            $table->decimal('accuracy', 5, 4)->nullable()->after('estimated_cost');
            $table->decimal('processing_time', 10, 3)->nullable()->after('accuracy');
            $table->json('metadata')->nullable()->after('processing_time');
            
            // Add indexes for reporting
            $table->index('estimated_cost');
            $table->index('accuracy');
            $table->index(['provider', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ocr_usage_logs', function (Blueprint $table) {
            $table->dropIndex(['provider', 'created_at']);
            $table->dropIndex(['accuracy']);
            $table->dropIndex(['estimated_cost']);
            
            $table->dropColumn(['estimated_cost', 'accuracy', 'processing_time', 'metadata']);
        });
    }
};