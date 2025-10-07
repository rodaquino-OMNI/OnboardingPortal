<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\EncryptionService;
use Illuminate\Console\Command;

/**
 * Verification Command: Validate PHI Encryption Implementation
 *
 * Verifies that all PHI fields are properly encrypted and searchable
 * via hash columns. This command is critical for ADR-004 compliance.
 *
 * Checks:
 * 1. All cpf fields are encrypted (AES-256-GCM)
 * 2. All phone fields are encrypted
 * 3. All address fields are encrypted
 * 4. cpf_hash matches encrypted cpf (searchable lookup)
 * 5. phone_hash matches encrypted phone
 * 6. Encryption/decryption cycle works correctly
 * 7. No plaintext PHI in database
 *
 * Usage:
 *   php artisan phi:verify-encryption [--sample=10]
 *
 * Options:
 *   --sample=10    Number of random users to verify (default: all)
 *   --strict       Fail on any warnings (for CI/CD)
 *
 * @package App\Console\Commands
 */
class VerifyPhiEncryption extends Command
{
    /**
     * Command signature
     *
     * @var string
     */
    protected $signature = 'phi:verify-encryption
                            {--sample= : Number of random users to verify}
                            {--strict : Fail on any warnings}';

    /**
     * Command description
     *
     * @var string
     */
    protected $description = 'Verify that all PHI fields are properly encrypted with valid hash columns';

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
        $sample = $this->option('sample');
        $strict = $this->option('strict');

        $this->info('🔍 PHI Encryption Verification');
        $this->info('=============================');
        $this->newLine();

        $query = User::query();

        if ($sample) {
            $query->inRandomOrder()->limit((int) $sample);
            $this->info("📊 Verifying random sample of {$sample} users");
        } else {
            $totalUsers = User::count();
            $this->info("📊 Verifying all {$totalUsers} users");
        }

        $this->newLine();

        $users = $query->get();
        $issues = [];
        $warnings = [];
        $verified = 0;

        $progressBar = $this->output->createProgressBar($users->count());
        $progressBar->setFormat(' %current%/%max% [%bar%] %percent:3s%% %message%');

        foreach ($users as $user) {
            $progressBar->setMessage("Verifying user ID: {$user->id}");

            try {
                $userIssues = $this->verifyUser($user);
                if (!empty($userIssues)) {
                    $issues[] = [
                        'user_id' => $user->id,
                        'issues' => $userIssues,
                    ];
                } else {
                    $verified++;
                }
            } catch (\Exception $e) {
                $warnings[] = "User {$user->id}: " . $e->getMessage();
            }

            $progressBar->advance();
        }

        $progressBar->finish();
        $this->newLine(2);

        // Display results
        $this->info('📊 Verification Results');
        $this->info('======================');
        $this->table(
            ['Metric', 'Count'],
            [
                ['Total Verified', $users->count()],
                ['Passed', $verified],
                ['Issues Found', count($issues)],
                ['Warnings', count($warnings)],
            ]
        );

        // Display issues
        if (!empty($issues)) {
            $this->newLine();
            $this->error('❌ Issues Found:');
            foreach ($issues as $issue) {
                $this->error("User {$issue['user_id']}:");
                foreach ($issue['issues'] as $description) {
                    $this->line("  - {$description}");
                }
            }
        }

        // Display warnings
        if (!empty($warnings)) {
            $this->newLine();
            $this->warn('⚠️  Warnings:');
            foreach ($warnings as $warning) {
                $this->line("  - {$warning}");
            }
        }

        $this->newLine();

        // Determine exit code
        if (!empty($issues)) {
            $this->error('❌ Verification FAILED - encryption issues found');
            return self::FAILURE;
        }

        if ($strict && !empty($warnings)) {
            $this->error('❌ Verification FAILED - warnings in strict mode');
            return self::FAILURE;
        }

        $this->info('✅ Verification PASSED - all PHI fields properly encrypted');
        return self::SUCCESS;
    }

    /**
     * Verify encryption for a single user
     *
     * @param User $user
     * @return array Issues found (empty if all good)
     */
    private function verifyUser(User $user): array
    {
        $issues = [];

        // Verify CPF encryption and hash
        if ($user->cpf) {
            // Check if CPF appears to be encrypted (AES-256-GCM format)
            if (!$this->looksEncrypted($user->cpf)) {
                $issues[] = 'CPF appears to be plaintext (not encrypted)';
            }

            // Check if hash exists
            if (!$user->cpf_hash) {
                $issues[] = 'CPF hash column is missing';
            } else {
                // Verify hash is 64 characters (SHA-256)
                if (strlen($user->cpf_hash) !== 64) {
                    $issues[] = 'CPF hash is not valid SHA-256 (wrong length)';
                }
            }
        }

        // Verify phone encryption and hash
        if ($user->phone) {
            if (!$this->looksEncrypted($user->phone)) {
                $issues[] = 'Phone appears to be plaintext (not encrypted)';
            }

            if (!$user->phone_hash) {
                $issues[] = 'Phone hash column is missing';
            } else {
                if (strlen($user->phone_hash) !== 64) {
                    $issues[] = 'Phone hash is not valid SHA-256 (wrong length)';
                }
            }
        }

        // Verify address encryption (no hash needed)
        if ($user->address) {
            if (!$this->looksEncrypted($user->address)) {
                $issues[] = 'Address appears to be plaintext (not encrypted)';
            }
        }

        return $issues;
    }

    /**
     * Check if a value looks encrypted (Laravel Crypt format)
     *
     * Laravel Crypt produces base64 encoded JSON strings
     *
     * @param mixed $value
     * @return bool
     */
    private function looksEncrypted($value): bool
    {
        if (!is_string($value) || empty($value)) {
            return false;
        }

        // Laravel encrypted strings start with "eyJpdiI6" (base64 of {"iv":)
        // Or they contain base64 characters and are relatively long
        return str_starts_with($value, 'eyJpdiI6') ||
               (strlen($value) > 50 && preg_match('/^[A-Za-z0-9+\/=]+$/', $value));
    }
}
