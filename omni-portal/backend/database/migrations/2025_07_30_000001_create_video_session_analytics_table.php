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
        Schema::create('video_session_analytics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('video_session_id')->constrained()->onDelete('cascade');
            $table->json('analytics_data'); // Comprehensive analytics data
            $table->decimal('engagement_score', 3, 2)->nullable(); // 0.00 to 1.00
            $table->json('compliance_status')->nullable(); // HIPAA compliance tracking
            $table->json('quality_metrics')->nullable(); // Video/audio quality data
            $table->json('participant_analytics')->nullable(); // Per-participant metrics
            $table->json('technical_performance')->nullable(); // Performance metrics
            $table->json('cost_analysis')->nullable(); // Cost breakdown
            $table->timestamp('analyzed_at')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('video_session_id');
            $table->index('engagement_score');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('video_session_analytics');
    }
};
