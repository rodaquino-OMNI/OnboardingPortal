<?php

namespace App\Services\Rewards;

use App\Models\UserReward;
use App\Models\ShippingOrder;
use Illuminate\Support\Facades\Log;

class PhysicalItemDeliveryHandler implements RewardDeliveryInterface
{
    /**
     * Deliver physical item (create shipping order)
     */
    public function deliver(UserReward $userReward): array
    {
        try {
            $reward = $userReward->reward;
            $user = $userReward->user;
            $beneficiary = $user->beneficiary;

            if (!$beneficiary) {
                throw new \Exception('Beneficiary not found');
            }

            // Create shipping order
            $order = ShippingOrder::create([
                'user_id' => $user->id,
                'beneficiary_id' => $beneficiary->id,
                'reward_id' => $reward->id,
                'item_name' => $reward->name,
                'item_description' => $reward->description,
                'shipping_address' => $this->formatShippingAddress($beneficiary),
                'status' => 'pending',
                'tracking_number' => null,
                'estimated_delivery' => now()->addDays(7),
                'metadata' => [
                    'redemption_code' => $userReward->redemption_code,
                    'reward_config' => $reward->delivery_config,
                ]
            ]);

            return [
                'success' => true,
                'details' => [
                    'order_id' => $order->id,
                    'status' => 'Shipping order created',
                    'estimated_delivery' => $order->estimated_delivery->toIso8601String(),
                    'shipping_address' => $order->shipping_address,
                ]
            ];

        } catch (\Exception $e) {
            Log::error('Physical item delivery failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Track physical item delivery
     */
    public function redeem(UserReward $userReward, array $data = []): array
    {
        try {
            $order = ShippingOrder::where('user_id', $userReward->user_id)
                ->where('reward_id', $userReward->reward_id)
                ->latest()
                ->first();

            if (!$order) {
                throw new \Exception('Shipping order not found');
            }

            return [
                'success' => true,
                'order_status' => $order->status,
                'tracking_number' => $order->tracking_number,
                'estimated_delivery' => $order->estimated_delivery->toIso8601String(),
                'shipping_updates' => $order->shipping_updates ?? [],
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

    protected function formatShippingAddress($beneficiary): array
    {
        return [
            'name' => $beneficiary->full_name,
            'street' => $beneficiary->address . ', ' . $beneficiary->number,
            'neighborhood' => $beneficiary->neighborhood,
            'city' => $beneficiary->city,
            'state' => $beneficiary->state,
            'zip_code' => $beneficiary->zip_code,
            'country' => $beneficiary->country ?? 'BR',
            'phone' => $beneficiary->phone,
        ];
    }
}