import apiClient from './client';
import { GamificationBadge } from '@/types';

// Additional gamification types
export interface BadgeCriteria {
  points?: number;
  completions?: number;
  streaks?: number;
  categories?: string[];
  timeframe?: string;
  conditions?: Record<string, unknown>;
}

export interface GamificationLevel {
  number: number;
  name: string;
  title: string;
  color: string;
  icon: string;
  points_required: number;
  points_remaining?: number;
  rewards?: string[];
  benefits?: string[];
}

export interface GamificationProgress {
  total_points: number;
  current_level: {
    number: number;
    name: string;
    title: string;
    color: string;
    icon: string;
    points_required: number;
  };
  next_level: {
    number: number;
    name: string;
    title: string;
    color: string;
    icon: string;
    points_required: number;
    points_remaining: number;
  } | null;
  progress_percentage: number;
  streak_days: number;
  tasks_completed: number;
  perfect_forms: number;
  documents_uploaded: number;
  health_assessments_completed: number;
  engagement_score: number;
  last_activity_date: string | null;
  profile_completed: number;
  onboarding_completed: number;
  badges_earned: GamificationBadge[];
  achievements: GamificationAchievement[];
}

export interface GamificationBadge {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  icon_name: string;
  icon_color: string;
  category: string;
  rarity: string;
  points_value: number;
  pointsRequired: number;
  criteria: BadgeCriteria;
  earned_at?: string;
}

export interface GamificationStats {
  totalPoints: number;
  currentLevel: number;
  currentStreak: number;
  longestStreak: number;
  badgesEarned: number;
  tasksCompleted: number;
  achievementsUnlocked: number;
  current_level: number;
}

export interface LeaderboardEntry {
  id: number;
  name: string;
  points: number;
  level: number;
  rank: number;
  avatar?: string;
}

export interface ActivityFeedItem {
  id: string;
  type: 'badge_earned' | 'level_up' | 'points_earned' | 'task_completed';
  title: string;
  description: string;
  icon: string;
  points: number | null;
  timestamp: string;
}

export interface DashboardSummary {
  user: {
    name: string;
    avatar: string | null;
    member_since: string;
  };
  stats: {
    total_points: number;
    current_level: number;
    streak_days: number;
    badges_earned: number;
    badges_total: number;
    tasks_completed: number;
    engagement_score: number;
  };
  recent_achievements: Array<{
    id: number;
    name: string;
    icon: string;
    earned_at: string;
  }>;
  next_rewards: {
    next_badge: string | null;
    next_level: string | null;
    points_to_next_level: number;
  };
  // Additional properties used in the dashboard
  quick_stats?: {
    [key: string]: unknown;
  };
  recent_badges?: Array<{
    id: number;
    name: string;
    icon: string;
    earned_at: string;
  }>;
}

export interface GamificationAchievements {
  onboarding: {
    profile_completed: boolean;
    health_assessment_completed: boolean;
    documents_uploaded: boolean;
    onboarding_completed: boolean;
  };
  engagement: {
    streak_milestone_1: boolean;
    streak_milestone_2: boolean;
    streak_milestone_3: boolean;
    high_engagement: boolean;
  };
  tasks: {
    first_task: boolean;
    task_milestone_10: boolean;
    task_milestone_50: boolean;
    perfect_form_submitted: boolean;
  };
  social: {
    first_badge: boolean;
    badge_collector: boolean;
    badge_master: boolean;
  };
  points: {
    first_100_points: boolean;
    first_500_points: boolean;
    first_1000_points: boolean;
  };
  summary: {
    total: number;
    earned: number;
    percentage: number;
  };
}

export const gamificationApi = {
  /**
   * Get gamification progress for the authenticated user
   */
  getProgress: async (): Promise<GamificationProgress> => {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: GamificationProgress;
      }>('/gamification/progress');
      
      return response.data.data;
    } catch (error: unknown) {
      // If user is not authenticated, return default progress
      if ((error as any)?.response?.status === 401) {
        const publicResponse = await api.get<{success: boolean; data: GamificationProgress}>('/gamification/public/progress');
        return publicResponse.data.data;
      }
      throw error;
    }
  },

  /**
   * Get gamification statistics for the authenticated user
   */
  getStats: async (): Promise<GamificationStats> => {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: GamificationStats;
      }>('/gamification/stats');
      
      return response.data.data;
    } catch (error: unknown) {
      // If user is not authenticated, return default stats instead of calling non-existent public endpoint
      if ((error as any)?.response?.status === 401 || (error as any)?.response?.status === 500) {
        console.warn('Gamification stats requires authentication, returning default values');
        return {
          totalPoints: 0,
          currentLevel: 1,
          currentStreak: 0,
          longestStreak: 0,
          badgesEarned: 0,
          tasksCompleted: 0,
          achievementsUnlocked: 0,
          current_level: 1,
        };
      }
      throw error;
    }
  },

  /**
   * Get badges for the authenticated user
   */
  getBadges: async (): Promise<{ earned: GamificationBadge[]; available: GamificationBadge[] }> => {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: { earned: GamificationBadge[]; available: GamificationBadge[] };
      }>('/gamification/badges');
      
      return response.data.data;
    } catch (error: unknown) {
      // If user is not authenticated, return default badges
      if ((error as any)?.response?.status === 401) {
        const publicResponse = await api.get<{success: boolean; data: { earned: GamificationBadge[]; available: GamificationBadge[] }}>('/gamification/public/badges');
        return publicResponse.data.data;
      }
      throw error;
    }
  },

  /**
   * Get leaderboard for the user's company
   */
  getLeaderboard: async (limit: number = 10): Promise<LeaderboardEntry[]> => {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: LeaderboardEntry[];
      }>(`/gamification/leaderboard?limit=${limit}`);
      
      return response.data.data;
    } catch (error: unknown) {
      // If user is not authenticated, return empty leaderboard
      if ((error as any)?.response?.status === 401) {
        const publicResponse = await api.get<{success: boolean; data: LeaderboardEntry[]}>('/gamification/public/leaderboard');
        return publicResponse.data.data;
      }
      throw error;
    }
  },

  /**
   * Get activity feed for the authenticated user
   */
  getActivityFeed: async (limit: number = 20): Promise<ActivityFeedItem[]> => {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: ActivityFeedItem[];
      }>(`/gamification/activity-feed?limit=${limit}`);
      
      return response.data.data;
    } catch (error: unknown) {
      // If user is not authenticated, return empty activity feed
      if ((error as any)?.response?.status === 401 || (error as any)?.response?.status === 500) {
        console.warn('Gamification activity feed requires authentication, returning empty array');
        return [];
      }
      throw error;
    }
  },

  /**
   * Get dashboard summary for the authenticated user
   */
  getDashboard: async (): Promise<DashboardSummary> => {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: DashboardSummary;
      }>('/gamification/dashboard');
      
      return response.data.data;
    } catch (error: unknown) {
      // If user is not authenticated, return default dashboard
      if ((error as any)?.response?.status === 401 || (error as any)?.response?.status === 500) {
        console.warn('Gamification dashboard requires authentication, returning default values');
        return {
          user: {
            name: 'Guest User',
            avatar: null,
            member_since: new Date().toISOString(),
          },
          stats: {
            total_points: 0,
            current_level: 1,
            streak_days: 0,
            badges_earned: 0,
            badges_total: 0,
            tasks_completed: 0,
            engagement_score: 0,
          },
          recent_achievements: [],
          next_rewards: {
            next_badge: null,
            next_level: null,
            points_to_next_level: 100,
          },
        };
      }
      throw error;
    }
  },

  /**
   * Get achievements for the authenticated user
   */
  getAchievements: async (): Promise<GamificationAchievements> => {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: GamificationAchievements;
      }>('/gamification/achievements');
      
      return response.data.data;
    } catch (error: unknown) {
      // If user is not authenticated, return default achievements
      if ((error as any)?.response?.status === 401 || (error as any)?.response?.status === 500) {
        console.warn('Gamification achievements requires authentication, returning default values');
        return {
          onboarding: {
            profile_completed: false,
            health_assessment_completed: false,
            documents_uploaded: false,
            onboarding_completed: false,
          },
          engagement: {
            streak_milestone_1: false,
            streak_milestone_2: false,
            streak_milestone_3: false,
            high_engagement: false,
          },
          tasks: {
            first_task: false,
            task_milestone_10: false,
            task_milestone_50: false,
            perfect_form_submitted: false,
          },
          social: {
            first_badge: false,
            badge_collector: false,
            badge_master: false,
          },
          points: {
            first_100_points: false,
            first_500_points: false,
            first_1000_points: false,
          },
          summary: {
            total: 0,
            earned: 0,
            percentage: 0,
          },
        };
      }
      throw error;
    }
  },

  /**
   * Get available levels
   */
  getLevels: async (): Promise<GamificationLevel[]> => {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: GamificationLevel[];
      }>('/gamification/levels');
      
      return response.data.data;
    } catch (error: unknown) {
      // If user is not authenticated, use public endpoint
      if ((error as any)?.response?.status === 401) {
        const publicResponse = await api.get<{success: boolean; data: GamificationLevel[]}>('/gamification/public/levels');
        return publicResponse.data.data;
      }
      throw error;
    }
  },
};