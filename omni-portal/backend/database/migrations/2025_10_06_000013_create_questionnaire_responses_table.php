<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: Create questionnaire_responses table
 *
 * Implements Phase 1 - Database Schema with PHI Encryption (ADR-004)
 * Part of Slice C implementation for Health Questionnaire System
 *
 * Security Architecture:
 * - answers_encrypted_json: AES-256-GCM encrypted PHI storage
 * - answers_hash: SHA-256 hash for deduplication (non-reversible)
 * - score_redacted: Deterministic risk score (0-100) without PHI
 * - risk_band: Categorical risk level (low, moderate, high, critical)
 * - audit_ref: Links to audit_logs for compliance tracking
 *
 * CRITICAL SECURITY REQUIREMENTS:
 * 1. ALL PHI stored in answers_encrypted_json (encrypted via EncryptsAttributes trait)
 * 2. Hash column for deduplication without decryption
 * 3. Score must be deterministic (same answers = same score)
 * 4. NO PHI in score_redacted or risk_band
 * 5. Audit logging required for all create/update operations
 *
 * Performance Optimizations:
 * - Indexed on questionnaire_id, user_id for fast lookups
 * - Indexed on score_redacted, risk_band for analytics queries
 * - Indexed on answers_hash for deduplication checks
 * - Indexed on submitted_at for timeline queries
 *
 * @see docs/phase8/ENCRYPTION_POLICY.md
 * @see app/Modules/Health/Models/QuestionnaireResponse.php
 * @see app/Traits/EncryptsAttributes.php
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('questionnaire_responses', function (Blueprint $table) {
            $table->id();

            // Foreign key relationships
            $table->foreignId('questionnaire_id')
                ->constrained('questionnaires')
                ->onDelete('cascade')
                ->comment('Reference to questionnaire template version');

            $table->foreignId('user_id')
                ->constrained('users')
                ->onDelete('cascade')
                ->comment('User who submitted this response');

            // ENCRYPTED PHI STORAGE (AES-256-GCM via EncryptsAttributes trait)
            $table->text('answers_encrypted_json')
                ->comment('ENCRYPTED: User responses containing PHI (AES-256-GCM)');

            // SHA-256 hash for deduplication (non-reversible)
            $table->char('answers_hash', 64)
                ->comment('SHA-256 hash of encrypted answers for deduplication');

            // Non-PHI redacted scoring (deterministic, analytics-safe)
            $table->integer('score_redacted')
                ->unsigned()
                ->nullable()
                ->comment('Redacted risk score 0-100 (deterministic, no PHI)');

            $table->enum('risk_band', ['low', 'moderate', 'high', 'critical'])
                ->nullable()
                ->comment('Categorical risk level derived from score_redacted');

            // Lifecycle tracking
            $table->timestamp('submitted_at')
                ->nullable()
                ->comment('When user completed and submitted response');

            // Audit and compliance
            $table->string('audit_ref', 255)
                ->nullable()
                ->comment('Reference ID linking to audit_logs table');

            // Non-PHI metadata (safe for analytics)
            $table->json('metadata')
                ->nullable()
                ->comment('Non-PHI data: completion time, device info, etc.');

            // Timestamps
            $table->timestamps();

            // Performance indexes for fast queries
            $table->index('questionnaire_id', 'idx_responses_questionnaire_id');
            $table->index('user_id', 'idx_responses_user_id');
            $table->index('score_redacted', 'idx_responses_score_redacted');
            $table->index('risk_band', 'idx_responses_risk_band');
            $table->index('submitted_at', 'idx_responses_submitted_at');
            $table->index('answers_hash', 'idx_responses_answers_hash');

            // Composite index for user response history
            $table->index(['user_id', 'submitted_at'], 'idx_responses_user_timeline');

            // Composite index for risk analytics
            $table->index(['risk_band', 'score_redacted'], 'idx_responses_risk_analytics');

            // Unique constraint for deduplication
            $table->unique(['questionnaire_id', 'user_id', 'answers_hash'], 'uniq_responses_dedup');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('questionnaire_responses');
    }
};
