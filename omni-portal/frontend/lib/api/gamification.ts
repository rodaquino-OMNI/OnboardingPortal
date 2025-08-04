import api from './auth';

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
  badges_earned: any;
  achievements: any;
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
  criteria: any;
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
    const response = await api.get<{
      success: boolean;
      data: GamificationProgress;
    }>('/gamification/progress');
    
    return response.data.data;
  },

  /**
   * Get gamification statistics for the authenticated user
   */
  getStats: async (): Promise<GamificationStats> => {
    const response = await api.get<{
      success: boolean;
      data: GamificationStats;
    }>('/gamification/stats');
    
    return response.data.data;
  },

  /**
   * Get badges for the authenticated user
   */
  getBadges: async (): Promise<{ earned: GamificationBadge[]; available: GamificationBadge[] }> => {
    const response = await api.get<{
      success: boolean;
      data: { earned: GamificationBadge[]; available: GamificationBadge[] };
    }>('/gamification/badges');
    
    return response.data.data;
  },

  /**
   * Get leaderboard for the user's company
   */
  getLeaderboard: async (limit: number = 10): Promise<LeaderboardEntry[]> => {
    const response = await api.get<{
      success: boolean;
      data: LeaderboardEntry[];
    }>(`/gamification/leaderboard?limit=${limit}`);
    
    return response.data.data;
  },

  /**
   * Get activity feed for the authenticated user
   */
  getActivityFeed: async (limit: number = 20): Promise<ActivityFeedItem[]> => {
    const response = await api.get<{
      success: boolean;
      data: ActivityFeedItem[];
    }>(`/gamification/activity-feed?limit=${limit}`);
    
    return response.data.data;
  },

  /**
   * Get dashboard summary for the authenticated user
   */
  getDashboard: async (): Promise<DashboardSummary> => {
    const response = await api.get<{
      success: boolean;
      data: DashboardSummary;
    }>('/gamification/dashboard');
    
    return response.data.data;
  },

  /**
   * Get achievements for the authenticated user
   */
  getAchievements: async (): Promise<GamificationAchievements> => {
    const response = await api.get<{
      success: boolean;
      data: GamificationAchievements;
    }>('/gamification/achievements');
    
    return response.data.data;
  },

  /**
   * Get available levels
   */
  getLevels: async (): Promise<any[]> => {
    const response = await api.get<{
      success: boolean;
      data: any[];
    }>('/gamification/levels');
    
    return response.data.data;
  },
};