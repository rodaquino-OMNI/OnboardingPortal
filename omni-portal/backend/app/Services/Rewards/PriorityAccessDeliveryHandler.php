<?php

namespace App\Services\Rewards;

use App\Models\UserReward;
use App\Models\PriorityAccess;
use Illuminate\Support\Facades\Log;

class PriorityAccessDeliveryHandler implements RewardDeliveryInterface
{
    /**
     * Grant priority access to user
     */
    public function deliver(UserReward $userReward): array
    {
        try {
            $reward = $userReward->reward;
            $user = $userReward->user;
            $beneficiary = $user->beneficiary;
            $config = $reward->delivery_config;

            // Create priority access record
            $priority = PriorityAccess::create([
                'beneficiary_id' => $beneficiary->id,
                'reward_id' => $reward->id,
                'access_type' => $config['access_type'] ?? 'general',
                'priority_level' => $config['priority_level'] ?? 'high',
                'services' => $config['services'] ?? ['scheduling', 'support', 'consultation'],
                'granted_at' => now(),
                'expires_at' => now()->addDays($config['duration_days'] ?? 30),
                'is_active' => true,
                'metadata' => [
                    'redemption_code' => $userReward->redemption_code,
                    'benefits' => $config['benefits'] ?? [],
                ]
            ]);

            // Update beneficiary priority settings
            $settings = $beneficiary->settings ?? [];
            $settings['priority'] = [
                'enabled' => true,
                'level' => $priority->priority_level,
                'services' => $priority->services,
                'expires_at' => $priority->expires_at->toIso8601String(),
            ];
            $beneficiary->update(['settings' => $settings]);

            return [
                'success' => true,
                'details' => [
                    'priority_level' => $priority->priority_level,
                    'services' => $priority->services,
                    'granted_at' => $priority->granted_at->toIso8601String(),
                    'expires_at' => $priority->expires_at->toIso8601String(),
                    'benefits' => $config['benefits'] ?? [],
                ]
            ];

        } catch (\Exception $e) {
            Log::error('Priority access delivery failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Use priority access
     */
    public function redeem(UserReward $userReward, array $data = []): array
    {
        try {
            $service = $data['service'] ?? 'scheduling';
            $beneficiary = $userReward->user->beneficiary;

            // Check active priority access
            $priority = PriorityAccess::where('beneficiary_id', $beneficiary->id)
                ->where('is_active', true)
                ->where('expires_at', '>', now())
                ->where(function ($query) use ($service) {
                    $query->whereJsonContains('services', $service)
                          ->orWhere('access_type', 'general');
                })
                ->orderBy('priority_level', 'desc')
                ->first();

            if (!$priority) {
                throw new \Exception('No active priority access for this service');
            }

            // Process priority action based on service
            $result = $this->processPriorityService($service, $priority, $data);

            // Log usage
            $usageLog = $priority->usage_log ?? [];
            $usageLog[] = [
                'service' => $service,
                'used_at' => now()->toIso8601String(),
                'action' => $data['action'] ?? 'access',
                'result' => $result,
            ];
            $priority->update(['usage_log' => $usageLog]);

            return [
                'success' => true,
                'service' => $service,
                'priority_level' => $priority->priority_level,
                'result' => $result,
            ];

        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    public function validate(UserReward $userReward): bool
    {
        return $userReward->status === 'claimed' && !$userReward->isExpired();
    }

    /**
     * Process priority service request
     */
    protected function processPriorityService(string $service, PriorityAccess $priority, array $data): array
    {
        switch ($service) {
            case 'scheduling':
                return [
                    'priority_slots_available' => true,
                    'next_available' => now()->addHours(1)->toIso8601String(),
                    'skip_queue' => true,
                ];
            
            case 'support':
                return [
                    'priority_queue_position' => 1,
                    'estimated_wait_time' => '< 2 minutes',
                    'dedicated_agent' => true,
                ];
            
            case 'consultation':
                return [
                    'specialist_access' => true,
                    'extended_time' => true,
                    'followup_included' => true,
                ];
            
            default:
                return [
                    'access_granted' => true,
                    'priority_level' => $priority->priority_level,
                ];
        }
    }
}