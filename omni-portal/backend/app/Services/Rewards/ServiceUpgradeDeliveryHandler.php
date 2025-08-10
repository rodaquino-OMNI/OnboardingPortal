<?php

namespace App\Services\Rewards;

use App\Models\UserReward;
use App\Models\ServiceUpgrade;
use App\Models\BeneficiaryServiceAccess;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class ServiceUpgradeDeliveryHandler implements RewardDeliveryInterface
{
    /**
     * Deliver service upgrade to user
     */
    public function deliver(UserReward $userReward): array
    {
        try {
            $reward = $userReward->reward;
            $user = $userReward->user;
            $beneficiary = $user->beneficiary;

            if (!$beneficiary) {
                throw new \Exception('Beneficiary not found for user');
            }

            $config = $reward->delivery_config;
            $serviceType = $config['service_type'] ?? 'telemedicine_premium';
            $features = $config['features'] ?? [];
            $duration = $config['duration_days'] ?? 30;

            DB::beginTransaction();

            // Create or update service access
            $serviceAccess = BeneficiaryServiceAccess::firstOrCreate(
                [
                    'beneficiary_id' => $beneficiary->id,
                    'service_type' => $serviceType,
                ],
                [
                    'access_level' => 'premium',
                    'granted_at' => now(),
                    'expires_at' => now()->addDays($duration),
                    'features' => $features,
                    'source' => 'reward',
                    'source_reference' => $userReward->redemption_code,
                ]
            );

            // If access already exists, extend it
            if (!$serviceAccess->wasRecentlyCreated) {
                $serviceAccess->update([
                    'access_level' => 'premium',
                    'expires_at' => $serviceAccess->expires_at->addDays($duration),
                    'features' => array_merge($serviceAccess->features ?? [], $features),
                ]);
            }

            // Create service upgrade record
            $upgrade = ServiceUpgrade::create([
                'beneficiary_id' => $beneficiary->id,
                'reward_id' => $reward->id,
                'service_type' => $serviceType,
                'upgrade_type' => 'premium_access',
                'features' => $features,
                'activated_at' => now(),
                'expires_at' => $serviceAccess->expires_at,
                'status' => 'active',
                'metadata' => [
                    'redemption_code' => $userReward->redemption_code,
                    'priority_level' => $config['priority_level'] ?? 'vip',
                ]
            ]);

            // Grant immediate access features
            if ($features['priority_scheduling'] ?? false) {
                $this->grantPriorityScheduling($beneficiary);
            }

            if ($features['exclusive_specialists'] ?? false) {
                $this->grantSpecialistAccess($beneficiary);
            }

            if ($features['whatsapp_support'] ?? false) {
                $this->enableWhatsAppSupport($beneficiary);
            }

            DB::commit();

            return [
                'success' => true,
                'details' => [
                    'service_type' => $serviceType,
                    'access_level' => 'premium',
                    'features' => $features,
                    'activated_at' => now()->toIso8601String(),
                    'expires_at' => $serviceAccess->expires_at->toIso8601String(),
                    'upgrade_id' => $upgrade->id,
                ]
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Service upgrade delivery failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Redeem service upgrade (activate or use the service)
     */
    public function redeem(UserReward $userReward, array $data = []): array
    {
        try {
            $beneficiary = $userReward->user->beneficiary;
            $serviceType = $userReward->reward->delivery_config['service_type'] ?? 'telemedicine_premium';

            // Check if service is active
            $serviceAccess = BeneficiaryServiceAccess::where('beneficiary_id', $beneficiary->id)
                ->where('service_type', $serviceType)
                ->where('expires_at', '>', now())
                ->first();

            if (!$serviceAccess) {
                throw new \Exception('Service upgrade not active or expired');
            }

            // Process specific redemption actions
            $action = $data['action'] ?? 'schedule';
            $result = [];

            switch ($action) {
                case 'schedule':
                    $result = $this->schedulePremiumConsultation($beneficiary, $data);
                    break;
                
                case 'access':
                    $result = $this->accessPremiumFeature($beneficiary, $data);
                    break;
                
                default:
                    $result = [
                        'access_level' => $serviceAccess->access_level,
                        'features' => $serviceAccess->features,
                        'expires_at' => $serviceAccess->expires_at->toIso8601String(),
                    ];
            }

            return [
                'success' => true,
                'service_type' => $serviceType,
                'action' => $action,
                'result' => $result,
            ];

        } catch (\Exception $e) {
            Log::error('Service redemption failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Validate if service upgrade can be delivered
     */
    public function validate(UserReward $userReward): bool
    {
        return $userReward->status === 'claimed' && !$userReward->isExpired();
    }

    /**
     * Grant priority scheduling access
     */
    protected function grantPriorityScheduling($beneficiary): void
    {
        // Update beneficiary settings
        $settings = $beneficiary->settings ?? [];
        $settings['scheduling']['priority'] = true;
        $settings['scheduling']['priority_level'] = 'vip';
        $settings['scheduling']['no_waiting'] = true;
        $beneficiary->update(['settings' => $settings]);
    }

    /**
     * Grant access to exclusive specialists
     */
    protected function grantSpecialistAccess($beneficiary): void
    {
        // Update beneficiary permissions
        $permissions = $beneficiary->permissions ?? [];
        $permissions['specialists']['exclusive_access'] = true;
        $permissions['specialists']['vip_pool'] = true;
        $beneficiary->update(['permissions' => $permissions]);
    }

    /**
     * Enable WhatsApp support
     */
    protected function enableWhatsAppSupport($beneficiary): void
    {
        // Update communication preferences
        $preferences = $beneficiary->communication_preferences ?? [];
        $preferences['whatsapp']['enabled'] = true;
        $preferences['whatsapp']['priority_support'] = true;
        $beneficiary->update(['communication_preferences' => $preferences]);
    }

    /**
     * Schedule premium consultation
     */
    protected function schedulePremiumConsultation($beneficiary, array $data): array
    {
        // This would integrate with your scheduling system
        return [
            'message' => 'Premium consultation scheduling available',
            'priority_slots' => true,
            'next_available' => now()->addHours(2)->toIso8601String(),
        ];
    }

    /**
     * Access premium feature
     */
    protected function accessPremiumFeature($beneficiary, array $data): array
    {
        $feature = $data['feature'] ?? 'dashboard';
        return [
            'feature' => $feature,
            'access_granted' => true,
            'premium_level' => 'vip',
        ];
    }
}