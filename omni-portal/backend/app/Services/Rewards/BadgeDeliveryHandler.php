<?php

namespace App\Services\Rewards;

use App\Models\UserReward;
use App\Models\GamificationBadge;
use App\Models\BeneficiaryBadge;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class BadgeDeliveryHandler implements RewardDeliveryInterface
{
    /**
     * Deliver badge reward to user
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

            // Check if badge exists in gamification system
            $badgeCode = $reward->delivery_config['badge_code'] ?? Str::slug($reward->name);
            $badge = GamificationBadge::where('slug', $badgeCode)->first();

            if (!$badge) {
                // Create badge if it doesn't exist
                $badge = GamificationBadge::create([
                    'name' => $reward->name,
                    'slug' => $badgeCode,
                    'description' => $reward->description,
                    'icon_name' => $reward->icon ?? 'star',
                    'icon_color' => $reward->color_scheme ?? '#4CAF50',
                    'category' => 'reward',
                    'rarity' => $reward->is_premium ? 'legendary' : 'common',
                    'points_value' => $reward->delivery_config['bonus_points'] ?? 0,
                    'criteria' => ['reward_id' => $reward->id],
                    'is_active' => true,
                    'is_secret' => false,
                ]);
            }

            // Award badge to beneficiary
            $existingBadge = BeneficiaryBadge::where('beneficiary_id', $beneficiary->id)
                ->where('gamification_badge_id', $badge->id)
                ->first();

            if (!$existingBadge) {
                BeneficiaryBadge::create([
                    'beneficiary_id' => $beneficiary->id,
                    'gamification_badge_id' => $badge->id,
                    'earned_at' => now(),
                    'earned_context' => [
                        'source' => 'reward_claim',
                        'reward_id' => $reward->id,
                        'redemption_code' => $userReward->redemption_code,
                    ]
                ]);

                // Award badge points
                if ($badge->points_value > 0) {
                    $beneficiary->increment('gamification_points', $badge->points_value);
                }
            }

            return [
                'success' => true,
                'details' => [
                    'badge_id' => $badge->id,
                    'badge_name' => $badge->name,
                    'badge_slug' => $badge->slug,
                    'points_awarded' => $badge->points_value,
                    'delivered_at' => now()->toIso8601String(),
                ]
            ];

        } catch (\Exception $e) {
            Log::error('Badge delivery failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Redeem badge (badges are auto-delivered, so this is a no-op)
     */
    public function redeem(UserReward $userReward, array $data = []): array
    {
        return [
            'success' => true,
            'message' => 'Badge already active on your profile',
            'badge_id' => $userReward->delivery_details['badge_id'] ?? null,
        ];
    }

    /**
     * Validate if reward can be delivered
     */
    public function validate(UserReward $userReward): bool
    {
        return $userReward->status === 'claimed' && !$userReward->isExpired();
    }
}