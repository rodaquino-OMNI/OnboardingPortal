<?php

namespace App\Services\Rewards;

use App\Models\UserReward;
use App\Models\DiscountCode;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class DiscountDeliveryHandler implements RewardDeliveryInterface
{
    /**
     * Deliver discount code to user
     */
    public function deliver(UserReward $userReward): array
    {
        try {
            $reward = $userReward->reward;
            $config = $reward->delivery_config;
            
            // Generate unique discount code
            $discountCode = $this->generateDiscountCode($userReward);
            
            // Create discount record
            $discount = DiscountCode::create([
                'code' => $discountCode,
                'user_id' => $userReward->user_id,
                'reward_id' => $reward->id,
                'discount_type' => $config['discount_type'] ?? 'percentage',
                'discount_value' => $config['discount_value'] ?? 10,
                'applicable_to' => $config['applicable_to'] ?? 'all',
                'minimum_amount' => $config['minimum_amount'] ?? 0,
                'valid_from' => now(),
                'valid_until' => now()->addDays($config['validity_days'] ?? 30),
                'max_uses' => $config['max_uses'] ?? 1,
                'used_count' => 0,
                'metadata' => [
                    'redemption_code' => $userReward->redemption_code,
                    'reward_name' => $reward->name,
                ]
            ]);

            return [
                'success' => true,
                'details' => [
                    'discount_code' => $discountCode,
                    'discount_type' => $discount->discount_type,
                    'discount_value' => $discount->discount_value,
                    'valid_until' => $discount->valid_until->toIso8601String(),
                    'applicable_to' => $discount->applicable_to,
                ]
            ];

        } catch (\Exception $e) {
            Log::error('Discount delivery failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Redeem discount code
     */
    public function redeem(UserReward $userReward, array $data = []): array
    {
        try {
            $code = $data['code'] ?? $userReward->delivery_details['discount_code'] ?? null;
            
            $discount = DiscountCode::where('code', $code)
                ->where('user_id', $userReward->user_id)
                ->where('valid_until', '>', now())
                ->where('used_count', '<', \DB::raw('max_uses'))
                ->first();

            if (!$discount) {
                throw new \Exception('Invalid or expired discount code');
            }

            // Apply discount to order/service
            $orderAmount = $data['order_amount'] ?? 0;
            $discountAmount = $this->calculateDiscount($discount, $orderAmount);

            // Mark as used
            $discount->increment('used_count');
            $discount->update([
                'last_used_at' => now(),
                'usage_details' => array_merge($discount->usage_details ?? [], [
                    [
                        'used_at' => now()->toIso8601String(),
                        'order_amount' => $orderAmount,
                        'discount_applied' => $discountAmount,
                    ]
                ])
            ]);

            return [
                'success' => true,
                'discount_applied' => $discountAmount,
                'final_amount' => max(0, $orderAmount - $discountAmount),
                'remaining_uses' => $discount->max_uses - $discount->used_count,
            ];

        } catch (\Exception $e) {
            Log::error('Discount redemption failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Validate discount code
     */
    public function validate(UserReward $userReward): bool
    {
        return $userReward->status === 'claimed' && !$userReward->isExpired();
    }

    /**
     * Generate unique discount code
     */
    protected function generateDiscountCode(UserReward $userReward): string
    {
        $prefix = strtoupper(substr($userReward->reward->code, 0, 3));
        do {
            $code = $prefix . '-' . strtoupper(Str::random(8));
        } while (DiscountCode::where('code', $code)->exists());
        
        return $code;
    }

    /**
     * Calculate discount amount
     */
    protected function calculateDiscount(DiscountCode $discount, float $orderAmount): float
    {
        if ($orderAmount < $discount->minimum_amount) {
            return 0;
        }

        if ($discount->discount_type === 'percentage') {
            return round($orderAmount * ($discount->discount_value / 100), 2);
        } else {
            return min($discount->discount_value, $orderAmount);
        }
    }
}