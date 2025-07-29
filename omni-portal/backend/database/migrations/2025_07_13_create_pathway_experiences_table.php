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
        Schema::create('pathway_experiences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('beneficiary_id')->constrained()->onDelete('cascade');
            $table->string('pathway', 20); // enhanced, clinical, hybrid, immersive
            $table->decimal('engagement_score', 5, 2)->default(0);
            $table->decimal('completion_rate', 5, 2)->default(0);
            $table->decimal('fraud_score', 5, 2)->default(0);
            $table->string('risk_level', 20)->default('low');
            $table->decimal('user_satisfaction', 5, 2)->default(0);
            $table->timestamps();
            
            // Indexes for analytics
            $table->index(['beneficiary_id', 'pathway']);
            $table->index(['risk_level', 'created_at']);
            $table->index('engagement_score');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pathway_experiences');
    }
};