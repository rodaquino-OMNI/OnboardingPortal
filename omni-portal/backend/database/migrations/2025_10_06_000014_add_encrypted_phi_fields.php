<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add encrypted PHI fields and hash columns for ADR-004 compliance
 *
 * This migration adds:
 * - Hash columns (cpf_hash, phone_hash) for searchable encrypted lookups
 * - Keeps existing plaintext columns temporarily for data migration
 *
 * Security Implementation:
 * - cpf_hash: SHA-256 hash for unique lookups without decryption
 * - phone_hash: SHA-256 hash for phone number lookups
 * - Existing cpf/phone/address columns will store encrypted data via EncryptsAttributes trait
 *
 * Migration Process:
 * 1. Run this migration to add hash columns
 * 2. Run data migration command: php artisan phi:migrate-encryption
 * 3. Verify encryption with: php artisan phi:verify-encryption
 * 4. Legacy plaintext columns become encrypted storage automatically
 *
 * @see App\Traits\EncryptsAttributes - Automatic encryption/decryption
 * @see App\Console\Commands\MigratePhiFieldsEncryption - Data migration
 * @see docs/phase8/ENCRYPTION_POLICY.md - Full encryption specification
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds hash columns for searchable encrypted field lookups
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // SHA-256 hash columns for encrypted field lookups (64 hex characters)
            // These enable searching encrypted fields without decryption
            $table->char('cpf_hash', 64)->nullable()->after('cpf');
            $table->char('phone_hash', 64)->nullable()->after('phone');

            // Update indexes - remove plaintext index, add hash index
            $table->dropIndex(['cpf']); // Remove plaintext index
            $table->index('cpf_hash'); // Add hash index for encrypted lookups
            $table->index('phone_hash'); // Add phone hash index

            // The existing cpf, phone, address columns will now store encrypted data
            // via the EncryptsAttributes trait - no schema changes needed for them
        });
    }

    /**
     * Reverse the migrations.
     *
     * Removes hash columns and restores original indexes
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Remove hash columns
            $table->dropIndex(['cpf_hash']);
            $table->dropIndex(['phone_hash']);
            $table->dropColumn(['cpf_hash', 'phone_hash']);

            // Restore original cpf index
            $table->index('cpf');
        });
    }
};
