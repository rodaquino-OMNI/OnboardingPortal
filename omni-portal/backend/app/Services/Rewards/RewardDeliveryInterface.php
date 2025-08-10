<?php

namespace App\Services\Rewards;

use App\Models\UserReward;

interface RewardDeliveryInterface
{
    /**
     * Deliver the reward to the user
     */
    public function deliver(UserReward $userReward): array;

    /**
     * Redeem the reward (use the claimed reward)
     */
    public function redeem(UserReward $userReward, array $data = []): array;

    /**
     * Validate if the reward can be delivered
     */
    public function validate(UserReward $userReward): bool;
}