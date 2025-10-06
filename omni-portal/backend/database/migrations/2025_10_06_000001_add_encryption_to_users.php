<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;

/**
 * Migration: Add Field-Level Encryption to Users Table
 *
 * Implements ADR-004: Field-Level Encryption for PHI/PII
 *
 * Strategy:
 * 1. Add encrypted binary columns (cpf_encrypted, phone_encrypted, etc.)
 * 2. Add hash columns for searchable fields (cpf_hash, phone_hash)
 * 3. Backfill existing data with encryption
 * 4. Drop plaintext columns
 * 5. Rename encrypted columns to original names
 *
 * Encryption Algorithm: AES-256-GCM (via Laravel Crypt facade)
 * Hash Algorithm: SHA-256 (for searchable field lookups)
 *
 * @see docs/phase8/ENCRYPTION_POLICY.md
 * @see docs/ARCHITECTURE_DECISIONS.md - ADR-004
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up(): void
    {
        // Step 1: Add temporary encrypted columns and hash columns
        Schema::table('users', function (Blueprint $table) {
            // Encrypted binary columns (BLOB for encrypted data)
            $table->binary('cpf_encrypted')->nullable()->after('email');
            $table->binary('birthdate_encrypted')->nullable()->after('cpf_encrypted');
            $table->binary('phone_encrypted')->nullable()->after('birthdate_encrypted');
            $table->binary('address_encrypted')->nullable()->after('phone_encrypted');

            // Hash columns for searchable encrypted fields
            $table->string('cpf_hash', 64)->nullable()->unique()->after('address_encrypted')
                ->comment('SHA-256 hash of CPF for unique lookups');
            $table->string('phone_hash', 64)->nullable()->index()->after('cpf_hash')
                ->comment('SHA-256 hash of phone for lookups');

            // Add index for performance
            $table->index(['cpf_hash', 'phone_hash'], 'idx_users_encrypted_lookups');
        });

        // Step 2: Backfill existing data with encryption
        $this->migrateExistingData();

        // Step 3: Drop plaintext columns after successful migration
        if ($this->canDropColumns()) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn(['cpf', 'birthdate', 'phone', 'address']);
            });

            // Step 4: Rename encrypted columns to original names
            Schema::table('users', function (Blueprint $table) {
                $table->renameColumn('cpf_encrypted', 'cpf');
                $table->renameColumn('birthdate_encrypted', 'birthdate');
                $table->renameColumn('phone_encrypted', 'phone');
                $table->renameColumn('address_encrypted', 'address');
            });
        }

        // Log migration completion
        DB::table('audit_logs')->insert([
            'event_type' => 'migration',
            'event_action' => 'field_encryption_enabled',
            'description' => 'Field-level encryption migration completed for users table',
            'metadata' => json_encode([
                'migration' => '2025_10_06_000001_add_encryption_to_users',
                'encrypted_fields' => ['cpf', 'birthdate', 'phone', 'address'],
                'hash_fields' => ['cpf_hash', 'phone_hash'],
                'algorithm' => 'AES-256-GCM',
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     *
     * WARNING: This will DECRYPT all data and store in plaintext.
     * Only use in development/testing environments.
     *
     * @return void
     */
    public function down(): void
    {
        // Step 1: Add plaintext columns back
        Schema::table('users', function (Blueprint $table) {
            $table->string('cpf_plaintext', 14)->nullable()->after('email');
            $table->date('birthdate_plaintext')->nullable()->after('cpf_plaintext');
            $table->string('phone_plaintext', 20)->nullable()->after('birthdate_plaintext');
            $table->json('address_plaintext')->nullable()->after('phone_plaintext');
        });

        // Step 2: Decrypt existing data back to plaintext
        $this->decryptExistingData();

        // Step 3: Drop encrypted and hash columns
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('idx_users_encrypted_lookups');
            $table->dropColumn([
                'cpf', 'birthdate', 'phone', 'address',
                'cpf_hash', 'phone_hash'
            ]);
        });

        // Step 4: Rename plaintext columns back to original names
        Schema::table('users', function (Blueprint $table) {
            $table->renameColumn('cpf_plaintext', 'cpf');
            $table->renameColumn('birthdate_plaintext', 'birthdate');
            $table->renameColumn('phone_plaintext', 'phone');
            $table->renameColumn('address_plaintext', 'address');
        });

        // Log rollback
        DB::table('audit_logs')->insert([
            'event_type' => 'migration',
            'event_action' => 'field_encryption_disabled',
            'description' => 'Field-level encryption rolled back for users table',
            'metadata' => json_encode([
                'migration' => '2025_10_06_000001_add_encryption_to_users',
                'warning' => 'Data is now stored in plaintext',
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Migrate existing plaintext data to encrypted columns
     *
     * Processes data in chunks to avoid memory issues
     *
     * @return void
     */
    private function migrateExistingData(): void
    {
        $chunkSize = 100;
        $migrated = 0;
        $failed = 0;

        DB::table('users')->orderBy('id')->chunk($chunkSize, function ($users) use (&$migrated, &$failed) {
            foreach ($users as $user) {
                try {
                    $updateData = [];

                    // Encrypt CPF
                    if (!empty($user->cpf)) {
                        $updateData['cpf_encrypted'] = Crypt::encryptString($user->cpf);
                        $updateData['cpf_hash'] = hash('sha256', $user->cpf);
                    }

                    // Encrypt birthdate
                    if (!empty($user->birthdate)) {
                        $updateData['birthdate_encrypted'] = Crypt::encryptString($user->birthdate);
                    }

                    // Encrypt phone
                    if (!empty($user->phone)) {
                        $updateData['phone_encrypted'] = Crypt::encryptString($user->phone);
                        $updateData['phone_hash'] = hash('sha256', $user->phone);
                    }

                    // Encrypt address (JSON)
                    if (!empty($user->address)) {
                        $addressJson = is_string($user->address) ? $user->address : json_encode($user->address);
                        $updateData['address_encrypted'] = Crypt::encryptString($addressJson);
                    }

                    // Update user with encrypted data
                    if (!empty($updateData)) {
                        DB::table('users')->where('id', $user->id)->update($updateData);
                        $migrated++;
                    }
                } catch (\Exception $e) {
                    $failed++;
                    // Log error but continue migration
                    logger()->error('Failed to encrypt user data', [
                        'user_id' => $user->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        });

        // Log migration statistics
        logger()->info('User data encryption completed', [
            'migrated' => $migrated,
            'failed' => $failed,
            'total' => $migrated + $failed,
        ]);
    }

    /**
     * Decrypt existing encrypted data back to plaintext (for rollback)
     *
     * @return void
     */
    private function decryptExistingData(): void
    {
        $chunkSize = 100;
        $decrypted = 0;
        $failed = 0;

        DB::table('users')->orderBy('id')->chunk($chunkSize, function ($users) use (&$decrypted, &$failed) {
            foreach ($users as $user) {
                try {
                    $updateData = [];

                    // Decrypt CPF
                    if (!empty($user->cpf)) {
                        $updateData['cpf_plaintext'] = Crypt::decryptString($user->cpf);
                    }

                    // Decrypt birthdate
                    if (!empty($user->birthdate)) {
                        $updateData['birthdate_plaintext'] = Crypt::decryptString($user->birthdate);
                    }

                    // Decrypt phone
                    if (!empty($user->phone)) {
                        $updateData['phone_plaintext'] = Crypt::decryptString($user->phone);
                    }

                    // Decrypt address
                    if (!empty($user->address)) {
                        $updateData['address_plaintext'] = Crypt::decryptString($user->address);
                    }

                    // Update user with decrypted data
                    if (!empty($updateData)) {
                        DB::table('users')->where('id', $user->id)->update($updateData);
                        $decrypted++;
                    }
                } catch (\Exception $e) {
                    $failed++;
                    logger()->error('Failed to decrypt user data', [
                        'user_id' => $user->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        });

        logger()->info('User data decryption completed', [
            'decrypted' => $decrypted,
            'failed' => $failed,
            'total' => $decrypted + $failed,
        ]);
    }

    /**
     * Check if it's safe to drop columns
     *
     * Verifies that all data has been successfully migrated
     *
     * @return bool
     */
    private function canDropColumns(): bool
    {
        // Count users with plaintext data
        $plaintextCount = DB::table('users')
            ->whereNotNull('cpf')
            ->orWhereNotNull('phone')
            ->count();

        // Count users with encrypted data
        $encryptedCount = DB::table('users')
            ->whereNotNull('cpf_encrypted')
            ->orWhereNotNull('phone_encrypted')
            ->count();

        // Only drop if migration is complete
        $migrationComplete = $encryptedCount > 0 && $encryptedCount >= $plaintextCount;

        if (!$migrationComplete) {
            logger()->warning('Cannot drop plaintext columns - migration incomplete', [
                'plaintext_count' => $plaintextCount,
                'encrypted_count' => $encryptedCount,
            ]);
        }

        return $migrationComplete;
    }
};
