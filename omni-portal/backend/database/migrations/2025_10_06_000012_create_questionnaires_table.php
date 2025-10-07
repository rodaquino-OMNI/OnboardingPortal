<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: Create questionnaires table
 *
 * Implements Phase 1 - Database Schema for Health Questionnaire System
 * Part of Slice C implementation following ADR-004 encryption standards
 *
 * Schema Design:
 * - Stores questionnaire templates/versions
 * - Supports versioning for regulatory compliance
 * - JSON schema storage for flexible question structures
 * - Status tracking: draft, submitted, reviewed
 * - Multi-tenancy ready (company_id for future use)
 *
 * Security:
 * - No PHI stored in this table (template only)
 * - Foreign key constraints with cascade delete
 * - Indexed for performance (user_id, status, is_active)
 *
 * @see docs/phase8/ENCRYPTION_POLICY.md
 * @see app/Modules/Health/Models/Questionnaire.php
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('questionnaires', function (Blueprint $table) {
            $table->id();

            // Ownership and versioning
            $table->foreignId('user_id')
                ->constrained('users')
                ->onDelete('cascade')
                ->comment('Creator/owner of this questionnaire version');

            $table->integer('version')
                ->default(1)
                ->comment('Questionnaire version for change tracking');

            // Template structure (no PHI)
            $table->json('schema_json')
                ->comment('Question structure and configuration (non-PHI)');

            // Status and lifecycle
            $table->enum('status', ['draft', 'submitted', 'reviewed'])
                ->default('draft')
                ->comment('Lifecycle status of questionnaire template');

            $table->timestamp('published_at')
                ->nullable()
                ->comment('When this version was published for use');

            $table->boolean('is_active')
                ->default(false)
                ->comment('Whether this version is currently active');

            // Timestamps
            $table->timestamps();

            // Performance indexes
            $table->index('user_id', 'idx_questionnaires_user_id');
            $table->index('status', 'idx_questionnaires_status');
            $table->index('is_active', 'idx_questionnaires_is_active');
            $table->index('created_at', 'idx_questionnaires_created_at');

            // Composite index for active questionnaire lookup
            $table->index(['is_active', 'published_at'], 'idx_questionnaires_active_published');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('questionnaires');
    }
};
