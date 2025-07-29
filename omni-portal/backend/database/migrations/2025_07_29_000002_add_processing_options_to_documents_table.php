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
        Schema::table('documents', function (Blueprint $table) {
            // Add missing fields
            if (!Schema::hasColumn('documents', 'type')) {
                $table->string('type')->nullable()->after('document_type');
            }
            
            if (!Schema::hasColumn('documents', 'original_filename')) {
                $table->string('original_filename')->nullable()->after('original_name');
            }
            
            if (!Schema::hasColumn('documents', 'description')) {
                $table->text('description')->nullable()->after('document_category');
            }
            
            if (!Schema::hasColumn('documents', 'processed_at')) {
                $table->timestamp('processed_at')->nullable()->after('processing_completed_at');
            }
            
            if (!Schema::hasColumn('documents', 'processing_options')) {
                $table->json('processing_options')->nullable()->after('processing_method');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn([
                'type',
                'original_filename',
                'description',
                'processed_at',
                'processing_options'
            ]);
        });
    }
};