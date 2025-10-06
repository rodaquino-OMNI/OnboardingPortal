<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Points transactions with idempotency per GAMIFICATION_SPEC.md
     */
    public function up(): void
    {
        Schema::create('points_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('idempotency_key', 64)->unique();
            $table->string('action', 50); // 'registration', 'profile_complete', 'document_approved', etc.
            $table->integer('points');
            $table->json('metadata')->nullable();
            $table->timestamp('processed_at')->useCurrent();
            $table->string('source', 50)->default('system'); // 'system', 'manual', 'bonus'

            // Indexes for performance
            $table->index(['user_id', 'processed_at']);
            $table->index('action');
            $table->index('processed_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('points_transactions');
    }
};
