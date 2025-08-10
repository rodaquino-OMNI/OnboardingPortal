'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  rewardsApi, 
  type Reward,
  type UserReward,
  type RewardsResponse,
  type ClaimResponse,
  type RedeemResponse
} from '@/lib/api/rewards';

interface RewardsState {
  // Data states
  rewards: Reward[] | null;
  userPoints: number;
  rewardHistory: UserReward[] | null;
  
  // Loading states
  isLoadingRewards: boolean;
  isLoadingHistory: boolean;
  isClaimingReward: boolean;
  isRedeemingReward: boolean;
  
  // Error handling
  error: string | null;
  lastFetch: number | null;
  
  // Actions
  fetchRewards: () => Promise<void>;
  fetchRewardHistory: () => Promise<void>;
  claimReward: (id: number) => Promise<ClaimResponse>;
  redeemReward: (id: number, data?: any) => Promise<RedeemResponse>;
  refreshRewards: () => Promise<void>;
  clearError: () => void;
  
  // Utility methods
  getRewardById: (id: number) => Reward | null;
  getUserPoints: () => number;
  getUnlockedRewards: () => Reward[];
  getClaimedRewards: () => Reward[];
  canClaimReward: (rewardId: number) => boolean;
}

export const useRewards = create<RewardsState>()(
  persist(
    (set, get) => ({
      // Initial state
      rewards: null,
      userPoints: 0,
      rewardHistory: null,
      isLoadingRewards: false,
      isLoadingHistory: false,
      isClaimingReward: false,
      isRedeemingReward: false,
      error: null,
      lastFetch: null,
      
      // Fetch all rewards
      fetchRewards: async () => {
        set({ isLoadingRewards: true, error: null });
        try {
          const response: RewardsResponse = await rewardsApi.getRewards();
          if (response.success) {
            set({ 
              rewards: response.data.rewards,
              userPoints: response.data.user_points,
              isLoadingRewards: false,
              lastFetch: Date.now()
            });
          } else {
            throw new Error('Failed to fetch rewards');
          }
        } catch (error: any) {
          console.error('Error fetching rewards:', error);
          set({ 
            error: error.message || 'Failed to fetch rewards', 
            isLoadingRewards: false 
          });
        }
      },
      
      // Fetch reward history
      fetchRewardHistory: async () => {
        set({ isLoadingHistory: true, error: null });
        try {
          const response = await rewardsApi.getRewardHistory();
          if (response.success) {
            set({ 
              rewardHistory: response.data,
              isLoadingHistory: false,
              lastFetch: Date.now()
            });
          } else {
            throw new Error('Failed to fetch reward history');
          }
        } catch (error: any) {
          console.error('Error fetching reward history:', error);
          set({ 
            error: error.message || 'Failed to fetch reward history', 
            isLoadingHistory: false 
          });
        }
      },
      
      // Claim a reward
      claimReward: async (id: number): Promise<ClaimResponse> => {
        set({ isClaimingReward: true, error: null });
        try {
          const response = await rewardsApi.claimReward(id);
          
          if (response.success) {
            // Update the reward status in local state
            const state = get();
            if (state.rewards) {
              const updatedRewards = state.rewards.map(reward => 
                reward.id === id 
                  ? { 
                      ...reward, 
                      user_status: 'claimed',
                      can_claim: false,
                      redemption_code: response.data.redemption_code,
                      claimed_at: new Date().toISOString()
                    }
                  : reward
              );
              
              set({ 
                rewards: updatedRewards,
                userPoints: state.userPoints + (response.data.bonus_points || 0),
                isClaimingReward: false
              });
            }
            
            // Refresh reward history
            get().fetchRewardHistory();
          }
          
          set({ isClaimingReward: false });
          return response;
        } catch (error: any) {
          console.error('Error claiming reward:', error);
          set({ 
            error: error.message || 'Failed to claim reward', 
            isClaimingReward: false 
          });
          throw error;
        }
      },
      
      // Redeem a reward
      redeemReward: async (id: number, data: any = {}): Promise<RedeemResponse> => {
        set({ isRedeemingReward: true, error: null });
        try {
          const response = await rewardsApi.redeemReward(id, data);
          
          if (response.success) {
            // Update the reward status in local state
            const state = get();
            if (state.rewards) {
              const updatedRewards = state.rewards.map(reward => 
                reward.id === id 
                  ? { ...reward, user_status: 'delivered' }
                  : reward
              );
              
              set({ 
                rewards: updatedRewards,
                isRedeemingReward: false
              });
            }
            
            // Refresh reward history
            get().fetchRewardHistory();
          }
          
          set({ isRedeemingReward: false });
          return response;
        } catch (error: any) {
          console.error('Error redeeming reward:', error);
          set({ 
            error: error.message || 'Failed to redeem reward', 
            isRedeemingReward: false 
          });
          throw error;
        }
      },
      
      // Refresh all rewards data
      refreshRewards: async () => {
        await Promise.allSettled([
          get().fetchRewards(),
          get().fetchRewardHistory()
        ]);
      },
      
      // Clear error state
      clearError: () => set({ error: null }),
      
      // Utility methods
      getRewardById: (id: number) => {
        const state = get();
        return state.rewards?.find(reward => reward.id === id) || null;
      },
      
      getUserPoints: () => {
        return get().userPoints;
      },
      
      getUnlockedRewards: () => {
        const state = get();
        return state.rewards?.filter(reward => reward.is_unlocked) || [];
      },
      
      getClaimedRewards: () => {
        const state = get();
        return state.rewards?.filter(reward => 
          reward.user_status === 'claimed' || reward.user_status === 'delivered'
        ) || [];
      },
      
      canClaimReward: (rewardId: number) => {
        const state = get();
        const reward = state.rewards?.find(r => r.id === rewardId);
        return reward ? reward.can_claim : false;
      }
    }),
    {
      name: 'rewards-storage',
      // Only persist essential data
      partialize: (state) => ({ 
        rewards: state.rewards,
        userPoints: state.userPoints,
        rewardHistory: state.rewardHistory,
        lastFetch: state.lastFetch
      }),
      version: 1,
    }
  )
);