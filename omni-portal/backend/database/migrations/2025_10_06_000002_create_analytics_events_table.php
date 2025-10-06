<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: Create analytics_events table
 *
 * Purpose: Store analytics events for tracking user actions and system behavior
 * Retention: Events older than 90 days are automatically pruned
 * LGPD/HIPAA: user_id_hash is hashed, metadata contains no PII (validated at repository layer)
 *
 * Schema Version: 1.0.0
 *
 * Indexes:
 * - Primary: uuid (non-incrementing)
 * - occurred_at: For time-range queries and pruning
 * - user_id_hash: For user-specific analytics
 * - Composite: (event_name, occurred_at) for event-type reports
 * - Composite: (event_category, occurred_at) for category reports
 *
 * @see app/Services/AnalyticsEventRepository.php - Persistence layer
 * @see docs/phase8/ANALYTICS_RETENTION_POLICY.md - Retention governance
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('analytics_events', function (Blueprint $table) {
            // Primary key - UUID (non-incrementing)
            $table->uuid('id')->primary();

            // Event identification
            $table->string('event_name', 100)->index(); // e.g., 'gamification.points_earned'
            $table->string('event_category', 50)->index(); // Extracted: 'gamification', 'auth', etc.
            $table->string('schema_version', 10)->default('1.0.0'); // For schema evolution

            // User tracking (hashed for privacy)
            $table->string('user_id_hash', 64)->nullable()->index(); // SHA256 hash, never plaintext
            $table->string('session_id', 64)->nullable(); // For session correlation

            // Event data (NO PII - validated at repository layer)
            $table->json('metadata')->nullable(); // Event-specific data (points, action_type, etc.)
            $table->json('context')->nullable(); // Request context (endpoint, role, company_id)

            // Request tracking
            $table->string('ip_address', 45)->nullable(); // IPv4/IPv6
            $table->text('user_agent')->nullable(); // Browser/client info

            // Environment tracking
            $table->string('environment', 20)->default('production'); // production, staging, development

            // Timestamps
            $table->timestamp('occurred_at')->index(); // When event happened (indexed for pruning)
            $table->timestamps(); // created_at, updated_at (Laravel convention)

            // Composite indexes for common query patterns
            $table->index(['event_name', 'occurred_at'], 'idx_event_time');
            $table->index(['event_category', 'occurred_at'], 'idx_category_time');
            $table->index(['user_id_hash', 'occurred_at'], 'idx_user_time');
        });

        // Add table comment for documentation
        DB::statement("ALTER TABLE analytics_events COMMENT = 'Analytics events tracking with 90-day retention and PII detection'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('analytics_events');
    }
};
