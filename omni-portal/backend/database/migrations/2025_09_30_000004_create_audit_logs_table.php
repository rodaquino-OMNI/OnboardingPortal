<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * WHO-WHAT-WHEN-WHERE-HOW audit logging per SECURITY_CHECKLIST.md
     * Retention: 7 years for HIPAA compliance
     */
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('who'); // user_id or 'system' or 'admin:123'
            $table->string('what'); // action name: 'registration_started', 'points_awarded', etc.
            $table->timestamp('when')->useCurrent();
            $table->string('where', 64); // IP address SHA-256 hashed for privacy
            $table->string('how'); // 'POST /api/auth/register', 'CLI artisan command', etc.
            $table->json('details')->nullable(); // Additional context (no PHI)
            $table->string('request_id', 36)->nullable(); // UUID for correlation
            $table->string('session_id', 64)->nullable(); // Session fingerprint hash

            // Indexes for querying and compliance
            $table->index(['user_id', 'when']);
            $table->index('when'); // For retention policy queries
            $table->index('what'); // For action-based queries
            $table->index('request_id'); // For request correlation
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
