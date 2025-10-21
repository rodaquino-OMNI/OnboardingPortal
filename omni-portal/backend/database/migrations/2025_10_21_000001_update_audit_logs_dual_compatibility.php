<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: Update audit_logs table for dual compatibility
 *
 * Updates the existing audit_logs table to support both:
 * 1. 5W1H audit pattern (who/what/when/where/how)
 * 2. Simplified controller pattern (action/resource_type/resource_id)
 *
 * Changes:
 * - Add 'action' column (alias for 'what')
 * - Add 'resource_type' and 'resource_id' columns
 * - Add 'ip_address' column (raw, for AuditLog model to hash)
 * - Add 'user_agent' column
 * - Add 'phi_accessed' boolean flag
 * - Add 'occurred_at' column (alias for 'when')
 *
 * Backwards Compatibility:
 * - Existing 5W1H columns remain intact
 * - AuditLog model auto-populates 5W1H from simplified fields
 *
 * @see app/Models/AuditLog.php
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            // Simplified fields for controller compatibility
            $table->string('action')->nullable()->after('what')->comment('Simplified action identifier');
            $table->string('resource_type')->nullable()->after('action')->comment('Resource type (e.g., questionnaire_response)');
            $table->unsignedBigInteger('resource_id')->nullable()->after('resource_type')->comment('Resource ID');

            // Raw IP address (model will hash it for 'where' field)
            $table->string('ip_address', 45)->nullable()->after('where')->comment('Raw IP address (IPv4/IPv6)');
            $table->text('user_agent')->nullable()->after('ip_address')->comment('User agent string');

            // PHI access tracking
            $table->boolean('phi_accessed')->default(false)->after('user_agent')->comment('Whether PHI was accessed');

            // Alias for 'when' (more standard naming)
            $table->timestamp('occurred_at')->nullable()->after('when')->comment('When action occurred (alias for when)');

            // Indexes for new columns
            $table->index('action', 'idx_audit_logs_action');
            $table->index('resource_type', 'idx_audit_logs_resource_type');
            $table->index('phi_accessed', 'idx_audit_logs_phi_accessed');
            $table->index('occurred_at', 'idx_audit_logs_occurred_at');

            // Composite index for resource lookups
            $table->index(['resource_type', 'resource_id'], 'idx_audit_logs_resource');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex('idx_audit_logs_action');
            $table->dropIndex('idx_audit_logs_resource_type');
            $table->dropIndex('idx_audit_logs_phi_accessed');
            $table->dropIndex('idx_audit_logs_occurred_at');
            $table->dropIndex('idx_audit_logs_resource');

            $table->dropColumn([
                'action',
                'resource_type',
                'resource_id',
                'ip_address',
                'user_agent',
                'phi_accessed',
                'occurred_at',
            ]);
        });
    }
};
