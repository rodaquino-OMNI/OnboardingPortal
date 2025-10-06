<?php

namespace App\Console\Commands;

use App\Services\AnalyticsEventRepository;
use Illuminate\Console\Command;

/**
 * PruneAnalyticsEvents - Prune old analytics events
 *
 * Purpose: Delete analytics events older than retention period (90 days default)
 * Compliance: LGPD/HIPAA data retention governance
 * Schedule: Runs daily via Laravel scheduler
 *
 * Usage:
 * - Default: php artisan analytics:prune (90 days)
 * - Custom: php artisan analytics:prune --days=30
 *
 * @see app/Services/AnalyticsEventRepository.php
 * @see docs/phase8/ANALYTICS_RETENTION_POLICY.md
 */
class PruneAnalyticsEvents extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'analytics:prune
                            {--days=90 : Number of days to retain analytics events}
                            {--dry-run : Show what would be deleted without actually deleting}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Prune analytics events older than retention period (default: 90 days)';

    /**
     * Execute the console command.
     */
    public function handle(AnalyticsEventRepository $repository): int
    {
        $days = (int) $this->option('days');
        $dryRun = $this->option('dry-run');
        $cutoffDate = now()->subDays($days);

        $this->info("Pruning analytics events older than {$days} days (before {$cutoffDate->toDateString()})");

        if ($dryRun) {
            $count = \App\Models\AnalyticsEvent::olderThan($cutoffDate)->count();
            $this->warn("DRY RUN: Would delete {$count} events");
            return self::SUCCESS;
        }

        try {
            $deletedCount = $repository->pruneOlderThan($cutoffDate);

            if ($deletedCount > 0) {
                $this->info("Successfully deleted {$deletedCount} analytics events");
            } else {
                $this->info("No analytics events to prune");
            }

            return self::SUCCESS;
        } catch (\Exception $e) {
            $this->error("Failed to prune analytics events: {$e->getMessage()}");
            return self::FAILURE;
        }
    }
}
