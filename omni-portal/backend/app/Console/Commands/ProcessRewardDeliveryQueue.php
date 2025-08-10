<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\RewardDeliveryService;

class ProcessRewardDeliveryQueue extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'rewards:process-queue {--retry-failed : Also retry failed deliveries}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Process pending reward deliveries from the queue';

    protected RewardDeliveryService $deliveryService;

    /**
     * Create a new command instance.
     */
    public function __construct(RewardDeliveryService $deliveryService)
    {
        parent::__construct();
        $this->deliveryService = $deliveryService;
    }

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Processing reward delivery queue...');
        
        // Process queued deliveries
        $processed = $this->deliveryService->processQueuedDeliveries();
        $this->info("Processed {$processed} deliveries.");
        
        // Retry failed deliveries if requested
        if ($this->option('retry-failed')) {
            $this->info('Retrying failed deliveries...');
            $retried = $this->deliveryService->retryFailedDeliveries();
            $this->info("Retried {$retried} failed deliveries.");
        }
        
        $this->info('Queue processing complete.');
        
        return Command::SUCCESS;
    }
}