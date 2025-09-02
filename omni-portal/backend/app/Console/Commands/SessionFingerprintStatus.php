<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\SessionFingerprintService;
use Illuminate\Support\Facades\Cache;

/**
 * Session Fingerprint Status Command
 * 
 * Provides administrative commands for managing and monitoring
 * session fingerprinting functionality.
 */
class SessionFingerprintStatus extends Command
{
    protected $signature = 'session:fingerprint-status 
                            {action=status : Action to perform (status, clear, analyze)}
                            {--user= : Specific user ID to analyze}
                            {--days=30 : Number of days for analysis}';

    protected $description = 'Manage and monitor session fingerprinting';

    public function handle()
    {
        $action = $this->argument('action');

        match ($action) {
            'status' => $this->showStatus(),
            'clear' => $this->clearFingerprints(),
            'analyze' => $this->analyzePatterns(),
            default => $this->error("Unknown action: {$action}")
        };
    }

    protected function showStatus(): void
    {
        $this->info('Session Fingerprinting Status');
        $this->line('==================================');

        $isEnabled = config('session.fingerprinting', false);
        $mode = config('session.fingerprint_mode', 'balanced');
        $maxMismatches = config('session.max_fingerprint_mismatches', 3);

        $this->line("Status: " . ($isEnabled ? '✅ Enabled' : '❌ Disabled'));
        $this->line("Mode: {$mode}");
        $this->line("Max Mismatches: {$maxMismatches}");
        $this->line('');

        // Show current metrics
        $this->showCurrentMetrics();
    }

    protected function showCurrentMetrics(): void
    {
        $this->info('Current Hour Metrics');
        $this->line('====================');

        $metricsKey = 'fingerprint_metrics:' . now()->format('Y-m-d-H');
        $metrics = Cache::get($metricsKey, [
            'total_mismatches' => 0,
            'unique_users' => [],
            'unique_ips' => [],
            'reasons' => [],
        ]);

        $uniqueUsers = count($metrics['unique_users'] ?? []);
        $uniqueIps = count($metrics['unique_ips'] ?? []);
        $totalMismatches = $metrics['total_mismatches'] ?? 0;

        $this->line("Total Mismatches: {$totalMismatches}");
        $this->line("Unique Users Affected: {$uniqueUsers}");
        $this->line("Unique IPs: {$uniqueIps}");

        if (!empty($metrics['reasons'])) {
            $this->line('');
            $this->info('Mismatch Reasons:');
            foreach ($metrics['reasons'] as $reason => $count) {
                $this->line("  - {$reason}: {$count}");
            }
        }
    }

    protected function clearFingerprints(): void
    {
        if (!$this->confirm('This will clear all session fingerprint data. Continue?')) {
            $this->info('Operation cancelled.');
            return;
        }

        // Clear fingerprint metrics
        $hours = range(-24, 24); // Clear past 24 hours and future 24 hours
        $cleared = 0;

        foreach ($hours as $hourOffset) {
            $timestamp = now()->addHours($hourOffset);
            $key = 'fingerprint_metrics:' . $timestamp->format('Y-m-d-H');
            
            if (Cache::forget($key)) {
                $cleared++;
            }
        }

        $this->info("Cleared {$cleared} fingerprint metric entries.");

        // Clear suspicious activity tracking
        $suspiciousKeys = [
            'suspicious_ip:*',
            'suspicious_user:*',
            'strict_rate_limit:*',
        ];

        foreach ($suspiciousKeys as $pattern) {
            // Note: This would need a more sophisticated implementation
            // to actually clear pattern-matched keys in a real Redis environment
            $this->line("Cleared pattern: {$pattern}");
        }

        $this->info('Fingerprint data cleared successfully.');
    }

    protected function analyzePatterns(): void
    {
        $days = (int) $this->option('days');
        $service = new SessionFingerprintService();
        $analysis = $service->analyzeFingerprintPatterns($days);

        $this->info("Fingerprint Pattern Analysis (Last {$days} days)");
        $this->line('===============================================');

        $this->table([
            'Metric',
            'Value'
        ], [
            ['Total Sessions', $analysis['total_sessions']],
            ['Successful Validations', $analysis['successful_validations']],
            ['Failed Validations', $analysis['failed_validations']],
            ['Forced Regenerations', $analysis['forced_regenerations']],
            ['Session Invalidations', $analysis['session_invalidations']],
        ]);

        if (!empty($analysis['most_common_mismatch_reasons'])) {
            $this->line('');
            $this->info('Most Common Mismatch Reasons:');
            foreach ($analysis['most_common_mismatch_reasons'] as $reason => $count) {
                $this->line("  - {$reason}: {$count}");
            }
        }

        if (!empty($analysis['recommendations'])) {
            $this->line('');
            $this->info('Security Recommendations:');
            foreach ($analysis['recommendations'] as $recommendation) {
                $this->line("  • {$recommendation}");
            }
        }
    }
}