<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\EncryptionService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Data Migration Command: Encrypt Existing PHI Fields
 *
 * Migrates plaintext CPF, phone, and address data to encrypted format
 * with hash columns for searchable lookups.
 *
 * Process:
 * 1. Iterates through all users
 * 2. Encrypts cpf, phone, address fields using EncryptionService
 * 3. Generates SHA-256 hashes for cpf and phone
 * 4. Updates records with encrypted data and hashes
 * 5. Validates encryption/decryption cycle
 *
 * Usage:
 *   php artisan phi:migrate-encryption [--dry-run] [--batch=100]
 *
 * Options:
 *   --dry-run        Show what would be migrated without making changes
 *   --batch=100      Process users in batches (default: 100)
 *   --verify         Verify encryption after migration
 *
 * Safety Features:
 * - Batch processing to avoid memory issues
 * - Transaction support for rollback
 * - Validation of each encryption/decryption cycle
 * - Detailed progress reporting
 *
 * @package App\Console\Commands
 */
class MigratePhiFieldsEncryption extends Command
{
    /**
     * Command signature
     *
     * @var string
     */
    protected $signature = 'phi:migrate-encryption
                            {--dry-run : Show what would be migrated without making changes}
                            {--batch=100 : Batch size for processing}
                            {--verify : Verify encryption after migration}';

    /**
     * Command description
     *
     * @var string
     */
    protected $description = 'Migrate existing PHI fields (cpf, phone, address) to encrypted format with hash columns';

    /**
     * Encryption service
     *
     * @var EncryptionService
     */
    private EncryptionService $encryptionService;

    /**
     * Create a new command instance
     */
    public function __construct(EncryptionService $encryptionService)
    {
        parent::__construct();
        $this->encryptionService = $encryptionService;
    }

    /**
     * Execute the console command
     */
    public function handle(): int
    {
        $isDryRun = $this->option('dry-run');
        $batchSize = (int) $this->option('batch');
        $shouldVerify = $this->option('verify');

        $this->info('🔐 PHI Field Encryption Migration');
        $this->info('================================');
        $this->newLine();

        if ($isDryRun) {
            $this->warn('⚠️  DRY RUN MODE - No changes will be made');
            $this->newLine();
        }

        // Count total users to migrate
        $totalUsers = User::count();

        if ($totalUsers === 0) {
            $this->info('✅ No users found - nothing to migrate');
            return self::SUCCESS;
        }

        $this->info("📊 Total users to process: {$totalUsers}");
        $this->info("📦 Batch size: {$batchSize}");
        $this->newLine();

        if (!$isDryRun && !$this->confirm('Do you want to proceed with the migration?')) {
            $this->info('Migration cancelled');
            return self::SUCCESS;
        }

        $this->newLine();
        $progressBar = $this->output->createProgressBar($totalUsers);
        $progressBar->setFormat(' %current%/%max% [%bar%] %percent:3s%% %message%');

        $migrated = 0;
        $errors = 0;

        // Process in batches
        User::chunk($batchSize, function ($users) use ($isDryRun, $progressBar, &$migrated, &$errors) {
            foreach ($users as $user) {
                $progressBar->setMessage("Processing user ID: {$user->id}");

                try {
                    if ($isDryRun) {
                        // Just validate what would be encrypted
                        $this->validateUserData($user);
                    } else {
                        // Actual migration
                        $this->migrateUserEncryption($user);
                    }

                    $migrated++;
                } catch (\Exception $e) {
                    $errors++;
                    $this->error("\n❌ Error processing user {$user->id}: " . $e->getMessage());
                }

                $progressBar->advance();
            }
        });

        $progressBar->finish();
        $this->newLine(2);

        // Summary
        $this->info('📊 Migration Summary');
        $this->info('===================');
        $this->table(
            ['Metric', 'Count'],
            [
                ['Total Users', $totalUsers],
                ['Successfully Migrated', $migrated],
                ['Errors', $errors],
            ]
        );

        if ($errors > 0) {
            $this->error("⚠️  Migration completed with {$errors} errors");
            return self::FAILURE;
        }

        if ($isDryRun) {
            $this->info('✅ Dry run completed successfully - no changes made');
        } else {
            $this->info('✅ Migration completed successfully');

            if ($shouldVerify) {
                $this->newLine();
                $this->call('phi:verify-encryption');
            }
        }

        return self::SUCCESS;
    }

    /**
     * Validate user data without migration
     *
     * @param User $user
     * @return void
     */
    private function validateUserData(User $user): void
    {
        // Check which fields need encryption
        $fields = [];

        if ($user->cpf) {
            $fields[] = 'cpf';
        }
        if ($user->phone) {
            $fields[] = 'phone';
        }
        if ($user->address) {
            $fields[] = 'address';
        }

        if (!empty($fields)) {
            $this->line("  Would encrypt: " . implode(', ', $fields));
        }
    }

    /**
     * Migrate user PHI fields to encrypted format
     *
     * @param User $user
     * @return void
     */
    private function migrateUserEncryption(User $user): void
    {
        DB::transaction(function () use ($user) {
            $updates = [];

            // Encrypt CPF if present
            if ($user->cpf && !$user->cpf_hash) {
                $plainCpf = $user->cpf;
                $encrypted = $this->encryptionService->encryptPHI($plainCpf);
                $hash = $this->encryptionService->hashForLookup($plainCpf);

                // Verify encryption works
                $decrypted = $this->encryptionService->decryptPHI($encrypted);
                if ($decrypted !== $plainCpf) {
                    throw new \RuntimeException("CPF encryption validation failed for user {$user->id}");
                }

                $updates['cpf'] = $encrypted;
                $updates['cpf_hash'] = $hash;
            }

            // Encrypt phone if present
            if ($user->phone && !$user->phone_hash) {
                $plainPhone = $user->phone;
                $encrypted = $this->encryptionService->encryptPHI($plainPhone);
                $hash = $this->encryptionService->hashForLookup($plainPhone);

                // Verify encryption works
                $decrypted = $this->encryptionService->decryptPHI($encrypted);
                if ($decrypted !== $plainPhone) {
                    throw new \RuntimeException("Phone encryption validation failed for user {$user->id}");
                }

                $updates['phone'] = $encrypted;
                $updates['phone_hash'] = $hash;
            }

            // Encrypt address if present (no hash needed - not searchable)
            if ($user->address) {
                $plainAddress = $user->address;
                $encrypted = $this->encryptionService->encryptPHI($plainAddress);

                // Verify encryption works
                $decrypted = $this->encryptionService->decryptPHI($encrypted);
                if ($decrypted !== $plainAddress) {
                    throw new \RuntimeException("Address encryption validation failed for user {$user->id}");
                }

                $updates['address'] = $encrypted;
            }

            // Update user with encrypted data
            if (!empty($updates)) {
                DB::table('users')
                    ->where('id', $user->id)
                    ->update($updates);
            }
        });
    }
}
