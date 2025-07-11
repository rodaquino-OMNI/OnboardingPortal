'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiService from '@/services/api';
import type { 
  GamificationProgress, 
  GamificationStats, 
  GamificationBadge, 
  LeaderboardEntry, 
  ActivityFeedItem, 
  DashboardSummary 
} from '@/types';

interface GamificationState {
  // Data
  progress: GamificationProgress | null;
  stats: GamificationStats | null;
  badges: {
    earned: GamificationBadge[];
    available: GamificationBadge[];
  };
  leaderboard: LeaderboardEntry[];
  activityFeed: ActivityFeedItem[];
  dashboardSummary: DashboardSummary | null;
  
  // Loading states
  isLoading: boolean;
  isLoadingProgress: boolean;
  isLoadingStats: boolean;
  isLoadingBadges: boolean;
  isLoadingLeaderboard: boolean;
  isLoadingActivity: boolean;
  isLoadingDashboard: boolean;
  
  // Error states
  error: string | null;
  
  // Actions
  fetchProgress: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchBadges: () => Promise<void>;
  fetchLeaderboard: (limit?: number) => Promise<void>;
  fetchActivityFeed: (limit?: number) => Promise<void>;
  fetchDashboardSummary: () => Promise<void>;
  fetchAll: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
  
  // Real-time updates
  updateProgress: (newProgress: Partial<GamificationProgress>) => void;
  addNewBadge: (badge: GamificationBadge) => void;
  updateStats: (newStats: Partial<GamificationStats>) => void;
}

export const useGamification = create<GamificationState>()(
  persist(
    (set, get) => ({
      // Initial state
      progress: null,
      stats: null,
      badges: {
        earned: [],
        available: []
      },
      leaderboard: [],
      activityFeed: [],
      dashboardSummary: null,
      
      // Loading states
      isLoading: false,
      isLoadingProgress: false,
      isLoadingStats: false,
      isLoadingBadges: false,
      isLoadingLeaderboard: false,
      isLoadingActivity: false,
      isLoadingDashboard: false,
      
      // Error state
      error: null,
      
      // Fetch progress
      fetchProgress: async () => {
        set({ isLoadingProgress: true, error: null });
        try {
          const response = await apiService.getGamificationProgress();
          if (response.success) {
            set({ progress: response.data, isLoadingProgress: false });
          } else {
            set({ 
              error: response.error?.message || 'Failed to fetch progress',
              isLoadingProgress: false 
            });
          }
        } catch (error: any) {
          set({ 
            error: error.message || 'Failed to fetch progress',
            isLoadingProgress: false 
          });
        }
      },
      
      // Fetch stats
      fetchStats: async () => {
        set({ isLoadingStats: true, error: null });
        try {
          const response = await apiService.getGamificationStats();
          if (response.success) {
            set({ stats: response.data, isLoadingStats: false });
          } else {
            set({ 
              error: response.error?.message || 'Failed to fetch stats',
              isLoadingStats: false 
            });
          }
        } catch (error: any) {
          set({ 
            error: error.message || 'Failed to fetch stats',
            isLoadingStats: false 
          });
        }
      },
      
      // Fetch badges
      fetchBadges: async () => {
        set({ isLoadingBadges: true, error: null });
        try {
          const response = await apiService.getAchievements();
          if (response.success) {
            set({ 
              badges: {
                earned: response.data.earned || [],
                available: response.data.available || []
              },
              isLoadingBadges: false 
            });
          } else {
            set({ 
              error: response.error?.message || 'Failed to fetch badges',
              isLoadingBadges: false 
            });
          }
        } catch (error: any) {
          set({ 
            error: error.message || 'Failed to fetch badges',
            isLoadingBadges: false 
          });
        }
      },
      
      // Fetch leaderboard
      fetchLeaderboard: async (limit = 10) => {
        set({ isLoadingLeaderboard: true, error: null });
        try {
          const response = await apiService.getLeaderboard(limit);
          if (response.success) {
            set({ 
              leaderboard: response.data || [],
              isLoadingLeaderboard: false 
            });
          } else {
            set({ 
              error: response.error?.message || 'Failed to fetch leaderboard',
              isLoadingLeaderboard: false 
            });
          }
        } catch (error: any) {
          set({ 
            error: error.message || 'Failed to fetch leaderboard',
            isLoadingLeaderboard: false 
          });
        }
      },
      
      // Fetch activity feed
      fetchActivityFeed: async (limit = 20) => {
        set({ isLoadingActivity: true, error: null });
        try {
          const response = await apiService.getActivityFeed(limit);
          if (response.success) {
            set({ 
              activityFeed: response.data || [],
              isLoadingActivity: false 
            });
          } else {
            set({ 
              error: response.error?.message || 'Failed to fetch activity feed',
              isLoadingActivity: false 
            });
          }
        } catch (error: any) {
          set({ 
            error: error.message || 'Failed to fetch activity feed',
            isLoadingActivity: false 
          });
        }
      },
      
      // Fetch dashboard summary
      fetchDashboardSummary: async () => {
        set({ isLoadingDashboard: true, error: null });
        try {
          const response = await apiService.getDashboardSummary();
          if (response.success) {
            set({ 
              dashboardSummary: response.data,
              isLoadingDashboard: false 
            });
          } else {
            set({ 
              error: response.error?.message || 'Failed to fetch dashboard summary',
              isLoadingDashboard: false 
            });
          }
        } catch (error: any) {
          set({ 
            error: error.message || 'Failed to fetch dashboard summary',
            isLoadingDashboard: false 
          });
        }
      },
      
      // Fetch all data
      fetchAll: async () => {
        set({ isLoading: true, error: null });
        try {
          const { 
            fetchProgress, 
            fetchStats, 
            fetchBadges, 
            fetchLeaderboard, 
            fetchActivityFeed,
            fetchDashboardSummary
          } = get();
          
          await Promise.allSettled([
            fetchProgress(),
            fetchStats(), 
            fetchBadges(),
            fetchLeaderboard(),
            fetchActivityFeed(),
            fetchDashboardSummary()
          ]);
          
          set({ isLoading: false });
        } catch (error: any) {
          set({ 
            error: error.message || 'Failed to fetch gamification data',
            isLoading: false 
          });
        }
      },
      
      // Clear error
      clearError: () => set({ error: null }),
      
      // Reset state
      reset: () => set({
        progress: null,
        stats: null,
        badges: { earned: [], available: [] },
        leaderboard: [],
        activityFeed: [],
        dashboardSummary: null,
        isLoading: false,
        isLoadingProgress: false,
        isLoadingStats: false,
        isLoadingBadges: false,
        isLoadingLeaderboard: false,
        isLoadingActivity: false,
        isLoadingDashboard: false,
        error: null
      }),
      
      // Real-time updates
      updateProgress: (newProgress) => {
        const currentProgress = get().progress;
        if (currentProgress) {
          set({ progress: { ...currentProgress, ...newProgress } });
        }
      },
      
      addNewBadge: (badge) => {
        const currentBadges = get().badges;
        set({
          badges: {
            ...currentBadges,
            earned: [...currentBadges.earned, badge],
            available: currentBadges.available.filter(b => b.id !== badge.id)
          }
        });
      },
      
      updateStats: (newStats) => {
        const currentStats = get().stats;
        if (currentStats) {
          set({ stats: { ...currentStats, ...newStats } });
        }
      },
    }),
    {
      name: 'gamification-storage',
      partialize: (state) => ({
        progress: state.progress,
        stats: state.stats,
        badges: state.badges,
        dashboardSummary: state.dashboardSummary,
      }),
    }
  )
);