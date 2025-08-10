<?php

namespace App\Services;

use App\Models\UserReward;
use App\Models\RewardTransaction;
use App\Models\RewardDeliveryQueue;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Exception;

class RewardDeliveryService
{
    /**
     * Process automatic delivery for a claimed reward
     */
    public function processDelivery(UserReward $userReward): bool
    {
        try {
            $reward = $userReward->reward;
            $handlerClass = $reward->getDeliveryHandler();
            
            if (!$handlerClass || !class_exists($handlerClass)) {
                Log::warning("No delivery handler found for reward type: {$reward->type}");
                return false;
            }

            $handler = new $handlerClass();
            
            // Queue the delivery if it's not instant
            if ($this->shouldQueue($reward)) {
                return $this->queueDelivery($userReward);
            }

            // Process instant delivery
            return $this->executeDelivery($userReward, $handler);

        } catch (Exception $e) {
            Log::error("Error processing reward delivery: " . $e->getMessage(), [
                'user_reward_id' => $userReward->id,
                'reward_id' => $userReward->reward_id,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Process redemption of a claimed reward
     */
    public function processRedemption(UserReward $userReward, array $data = []): array
    {
        try {
            $reward = $userReward->reward;
            $handlerClass = $reward->getDeliveryHandler();
            
            if (!$handlerClass || !class_exists($handlerClass)) {
                throw new Exception("No redemption handler found for reward type: {$reward->type}");
            }

            $handler = new $handlerClass();
            
            // Execute redemption
            $result = $handler->redeem($userReward, $data);
            
            // Update usage data
            $userReward->update([
                'usage_data' => array_merge(
                    $userReward->usage_data ?? [],
                    [
                        'redeemed_at' => now()->toIso8601String(),
                        'redemption_data' => $data,
                        'redemption_result' => $result
                    ]
                )
            ]);

            // Log redemption
            RewardTransaction::create([
                'user_id' => $userReward->user_id,
                'reward_id' => $userReward->reward_id,
                'action' => 'redeem',
                'points_at_time' => $userReward->user->beneficiary->gamification_points ?? 0,
                'metadata' => [
                    'redemption_code' => $userReward->redemption_code,
                    'data' => $data,
                    'result' => $result
                ],
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);

            return $result;

        } catch (Exception $e) {
            Log::error("Error processing reward redemption: " . $e->getMessage(), [
                'user_reward_id' => $userReward->id,
                'reward_id' => $userReward->reward_id,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Check if delivery should be queued
     */
    protected function shouldQueue($reward): bool
    {
        $queueableTypes = ['physical_item', 'service_upgrade', 'priority_access'];
        return in_array($reward->type, $queueableTypes) && 
               !($reward->delivery_config['instant'] ?? false);
    }

    /**
     * Queue delivery for async processing
     */
    protected function queueDelivery(UserReward $userReward): bool
    {
        try {
            RewardDeliveryQueue::create([
                'user_reward_id' => $userReward->id,
                'status' => 'pending',
                'scheduled_at' => now()->addMinutes(5), // Process in 5 minutes
                'delivery_payload' => [
                    'user_id' => $userReward->user_id,
                    'reward_id' => $userReward->reward_id,
                    'redemption_code' => $userReward->redemption_code,
                ]
            ]);

            return true;

        } catch (Exception $e) {
            Log::error("Error queuing reward delivery: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Execute immediate delivery
     */
    protected function executeDelivery(UserReward $userReward, $handler): bool
    {
        try {
            DB::beginTransaction();

            // Execute handler delivery
            $deliveryResult = $handler->deliver($userReward);
            
            if ($deliveryResult['success'] ?? false) {
                // Mark as delivered
                $userReward->markAsDelivered($deliveryResult['details'] ?? []);
                
                DB::commit();
                return true;
            }

            DB::rollBack();
            return false;

        } catch (Exception $e) {
            DB::rollBack();
            Log::error("Error executing reward delivery: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Process queued deliveries (called by scheduled job)
     */
    public function processQueuedDeliveries(): int
    {
        $processed = 0;
        
        $pendingDeliveries = RewardDeliveryQueue::where('status', 'pending')
            ->where(function ($query) {
                $query->whereNull('scheduled_at')
                      ->orWhere('scheduled_at', '<=', now());
            })
            ->where('attempts', '<', 3)
            ->limit(50)
            ->get();

        foreach ($pendingDeliveries as $queuedDelivery) {
            try {
                $queuedDelivery->update([
                    'status' => 'processing',
                    'attempts' => $queuedDelivery->attempts + 1
                ]);

                $userReward = $queuedDelivery->userReward;
                $reward = $userReward->reward;
                $handlerClass = $reward->getDeliveryHandler();
                
                if ($handlerClass && class_exists($handlerClass)) {
                    $handler = new $handlerClass();
                    
                    if ($this->executeDelivery($userReward, $handler)) {
                        $queuedDelivery->update([
                            'status' => 'completed',
                            'processed_at' => now()
                        ]);
                        $processed++;
                    } else {
                        throw new Exception("Delivery execution failed");
                    }
                }

            } catch (Exception $e) {
                $queuedDelivery->update([
                    'status' => $queuedDelivery->attempts >= 3 ? 'failed' : 'pending',
                    'error_message' => $e->getMessage()
                ]);
                
                Log::error("Error processing queued delivery: " . $e->getMessage(), [
                    'queue_id' => $queuedDelivery->id,
                    'user_reward_id' => $queuedDelivery->user_reward_id
                ]);
            }
        }

        return $processed;
    }

    /**
     * Retry failed deliveries
     */
    public function retryFailedDeliveries(): int
    {
        $retried = 0;
        
        $failedDeliveries = RewardDeliveryQueue::where('status', 'failed')
            ->where('attempts', '<', 5)
            ->where('updated_at', '>=', now()->subDays(7))
            ->limit(20)
            ->get();

        foreach ($failedDeliveries as $delivery) {
            $delivery->update([
                'status' => 'pending',
                'scheduled_at' => now()->addMinutes(30),
                'error_message' => null
            ]);
            $retried++;
        }

        return $retried;
    }

    /**
     * Check delivery status
     */
    public function getDeliveryStatus(UserReward $userReward): array
    {
        $queuedDelivery = RewardDeliveryQueue::where('user_reward_id', $userReward->id)
            ->latest()
            ->first();

        return [
            'delivered' => $userReward->status === 'delivered',
            'delivered_at' => $userReward->delivered_at,
            'delivery_details' => $userReward->delivery_details,
            'queue_status' => $queuedDelivery ? $queuedDelivery->status : null,
            'queue_attempts' => $queuedDelivery ? $queuedDelivery->attempts : null,
            'queue_error' => $queuedDelivery ? $queuedDelivery->error_message : null,
        ];
    }
}