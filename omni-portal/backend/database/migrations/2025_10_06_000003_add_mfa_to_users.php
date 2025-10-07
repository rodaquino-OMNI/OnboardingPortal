<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * ADR-002 P1 Gap: Multi-Factor Authentication (MFA/TOTP) Enforcement
     *
     * This migration adds MFA/TOTP support to users table:
     * - mfa_enabled: flag to indicate MFA is active
     * - mfa_secret: encrypted TOTP secret (base32 encoded)
     * - mfa_recovery_codes: encrypted JSON array of one-time recovery codes
     * - mfa_enforced_at: timestamp when MFA was enforced
     * - mfa_last_verified_at: timestamp of last successful MFA verification
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // MFA enablement flag
            $table->boolean('mfa_enabled')->default(false)->after('password');

            // Encrypted TOTP secret (base32 encoded, 32 characters)
            $table->binary('mfa_secret')->nullable()->after('mfa_enabled');

            // Encrypted JSON array of recovery codes (10 codes, 8 chars each)
            $table->text('mfa_recovery_codes')->nullable()->after('mfa_secret');

            // Timestamp when MFA was enforced for this user
            $table->timestamp('mfa_enforced_at')->nullable()->after('mfa_recovery_codes');

            // Timestamp of last successful MFA verification
            $table->timestamp('mfa_last_verified_at')->nullable()->after('mfa_enforced_at');

            // Index for performance
            $table->index('mfa_enabled', 'idx_users_mfa_enabled');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('idx_users_mfa_enabled');
            $table->dropColumn([
                'mfa_enabled',
                'mfa_secret',
                'mfa_recovery_codes',
                'mfa_enforced_at',
                'mfa_last_verified_at',
            ]);
        });
    }
};
