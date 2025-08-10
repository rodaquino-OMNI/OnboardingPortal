<?php

namespace App\Services\Rewards;

use App\Models\UserReward;
use App\Models\FeatureAccess;
use Illuminate\Support\Facades\Log;

class FeatureUnlockDeliveryHandler implements RewardDeliveryInterface
{
    /**
     * Unlock feature for user
     */
    public function deliver(UserReward $userReward): array
    {
        try {
            $reward = $userReward->reward;
            $user = $userReward->user;
            $beneficiary = $user->beneficiary;
            $config = $reward->delivery_config;

            $features = $config['features'] ?? [];
            $unlockedFeatures = [];

            foreach ($features as $feature) {
                $access = FeatureAccess::firstOrCreate(
                    [
                        'beneficiary_id' => $beneficiary->id,
                        'feature_key' => $feature,
                    ],
                    [
                        'enabled' => true,
                        'unlocked_at' => now(),
                        'unlocked_by' => 'reward',
                        'expires_at' => isset($config['duration_days']) 
                            ? now()->addDays($config['duration_days']) 
                            : null,
                        'metadata' => [
                            'reward_id' => $reward->id,
                            'redemption_code' => $userReward->redemption_code,
                        ]
                    ]
                );

                if (!$access->wasRecentlyCreated && !$access->enabled) {
                    $access->update(['enabled' => true, 'unlocked_at' => now()]);
                }

                $unlockedFeatures[] = $feature;
            }

            // Update beneficiary permissions
            $permissions = $beneficiary->permissions ?? [];
            foreach ($unlockedFeatures as $feature) {
                $permissions['features'][$feature] = true;
            }
            $beneficiary->update(['permissions' => $permissions]);

            return [
                'success' => true,
                'details' => [
                    'unlocked_features' => $unlockedFeatures,
                    'expires_at' => isset($config['duration_days']) 
                        ? now()->addDays($config['duration_days'])->toIso8601String() 
                        : null,
                ]
            ];

        } catch (\Exception $e) {
            Log::error('Feature unlock failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Access unlocked feature
     */
    public function redeem(UserReward $userReward, array $data = []): array
    {
        try {
            $feature = $data['feature'] ?? null;
            $beneficiary = $userReward->user->beneficiary;

            if ($feature) {
                $access = FeatureAccess::where('beneficiary_id', $beneficiary->id)
                    ->where('feature_key', $feature)
                    ->where('enabled', true)
                    ->where(function ($query) {
                        $query->whereNull('expires_at')
                              ->orWhere('expires_at', '>', now());
                    })
                    ->first();

                if (!$access) {
                    throw new \Exception('Feature not unlocked or expired');
                }

                return [
                    'success' => true,
                    'feature' => $feature,
                    'access_granted' => true,
                    'expires_at' => $access->expires_at?->toIso8601String(),
                ];
            }

            // Return all unlocked features
            $features = FeatureAccess::where('beneficiary_id', $beneficiary->id)
                ->where('enabled', true)
                ->where(function ($query) {
                    $query->whereNull('expires_at')
                          ->orWhere('expires_at', '>', now());
                })
                ->pluck('feature_key')
                ->toArray();

            return [
                'success' => true,
                'unlocked_features' => $features,
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
}