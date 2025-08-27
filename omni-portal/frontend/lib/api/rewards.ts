import api from './auth';

export interface Reward {
  id: number;
  code: string;
  name: string;
  description: string;
  benefits: string[];
  points_required: number;
  type: 'badge' | 'discount' | 'service_upgrade' | 'physical_item' | 'digital_item' | 'feature_unlock' | 'priority_access';
  icon: string;
  color_scheme: string;
  is_premium: boolean;
  is_available: boolean;
  is_unlocked: boolean;
  can_claim: boolean;
  user_status: 'unlocked' | 'claimed' | 'delivered' | 'expired' | 'revoked' | null;
  redemption_code: string | null;
  claimed_at: string | null;
  delivered_at: string | null;
}

export interface UserReward {
  id: number;
  reward: {
    id: number;
    name: string;
    description: string;
    icon: string;
    points_required: number;
  };
  status: 'unlocked' | 'claimed' | 'delivered' | 'expired' | 'revoked';
  redemption_code: string | null;
  unlocked_at: string | null;
  claimed_at: string | null;
  delivered_at: string | null;
  expires_at: string | null;
}

export interface RewardsResponse {
  success: boolean;
  data: {
    rewards: Reward[];
    user_points: number;
  };
}

export interface ClaimResponse {
  success: boolean;
  message: string;
  data: {
    redemption_code: string;
    status: string;
    bonus_points: number;
  };
}

export interface RedeemResponse {
  success: boolean;
  message: string;
  data: any;
}

export interface RewardHistoryResponse {
  success: boolean;
  data: UserReward[];
}

class RewardsAPI {
  /**
   * Get all available rewards for the current user
   */
  async getRewards(): Promise<RewardsResponse> {
    try {
      const response = await api.get('/api/rewards');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Return empty rewards for unauthenticated users
        return {
          success: true,
          data: {
            rewards: [],
            user_points: 0
          }
        };
      }
      throw error;
    }
  }

  /**
   * Get a specific reward by ID
   */
  async getReward(id: number): Promise<{ success: boolean; data: Reward }> {
    try {
      const response = await api.get(`/rewards/${id}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Por favor, faça login para ver detalhes da recompensa');
      }
      throw error;
    }
  }

  /**
   * Claim a reward
   */
  async claimReward(id: number): Promise<ClaimResponse> {
    try {
      const response = await api.post(`/rewards/${id}/claim`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Por favor, faça login para resgatar recompensas');
      }
      throw error;
    }
  }

  /**
   * Redeem a claimed reward
   */
  async redeemReward(id: number, data: any = {}): Promise<RedeemResponse> {
    try {
      const response = await api.post(`/rewards/${id}/redeem`, data);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Por favor, faça login para usar recompensas');
      }
      throw error;
    }
  }

  /**
   * Get user's reward history
   */
  async getRewardHistory(): Promise<RewardHistoryResponse> {
    try {
      const response = await api.get('/api/rewards/history');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Return empty history for unauthenticated users
        return {
          success: true,
          data: []
        };
      }
      throw error;
    }
  }
}

export const rewardsApi = new RewardsAPI();

// Helper functions
export function formatRewardIcon(iconName: string): string {
  const iconMap: { [key: string]: string } = {
    'award': '🏆',
    'clock': '⏰',
    'users': '👥',
    'heart': '❤️',
    'crown': '👑',
    'star': '⭐',
    'gift': '🎁',
    'trophy': '🏆',
    'medal': '🏅',
    'diamond': '💎',
  };
  
  return iconMap[iconName] || '🎯';
}

export function getRewardColorClass(colorScheme: string): string {
  const colorMap: { [key: string]: string } = {
    'from-green-400 to-green-600': 'bg-gradient-to-r from-green-400 to-green-600',
    'from-yellow-400 to-orange-500': 'bg-gradient-to-r from-yellow-400 to-orange-500',
    'from-blue-400 to-blue-600': 'bg-gradient-to-r from-blue-400 to-blue-600',
    'from-red-400 to-pink-600': 'bg-gradient-to-r from-red-400 to-pink-600',
    'from-purple-500 to-pink-600': 'bg-gradient-to-r from-purple-500 to-pink-600',
  };
  
  return colorMap[colorScheme] || 'bg-gradient-to-r from-gray-400 to-gray-600';
}