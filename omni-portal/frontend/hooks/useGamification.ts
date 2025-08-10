'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  gamificationApi, 
  type GamificationProgress,
  type GamificationStats,
  type GamificationBadge,
  type LeaderboardEntry,
  type ActivityFeedItem,
  type DashboardSummary,
  type GamificationAchievements
} from '@/lib/api/gamification';

// Real gamification store with API integration
interface GamificationState {
  // Data states
  progress: GamificationProgress | null;
  stats: GamificationStats | null;
  badges: { earned: GamificationBadge[]; available: GamificationBadge[] } | null;
  leaderboard: LeaderboardEntry[] | null;
  activityFeed: ActivityFeedItem[] | null;
  dashboardSummary: DashboardSummary | null;
  achievements: GamificationAchievements | null;
  levels: any[] | null;
  
  // Loading states
  isLoadingProgress: boolean;
  isLoadingStats: boolean;
  isLoadingBadges: boolean;
  isLoadingLeaderboard: boolean;
  isLoadingActivity: boolean;
  isLoadingDashboard: boolean;
  isLoadingAchievements: boolean;
  isLoadingLevels: boolean;
  isLoading: boolean;
  
  // Error handling
  error: string | null;
  lastFetch: number | null;
  
  // Performance optimization
  retryCount: number;
  isOnline: boolean;
  
  // Real API actions
  fetchProgress: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchBadges: () => Promise<void>;
  fetchLeaderboard: (limit?: number) => Promise<void>;
  fetchActivityFeed: (limit?: number) => Promise<void>;
  fetchDashboardSummary: () => Promise<void>;
  fetchAchievements: () => Promise<void>;
  fetchLevels: () => Promise<void>;
  fetchAll: () => Promise<void>;
  
  // Utility actions
  clearError: () => void;
  invalidateCache: () => void;
  refreshData: () => Promise<void>;
  updateOnlineStatus: () => void;
  shouldRefresh: () => boolean;
}

export const useGamification = create<GamificationState>()(
  persist(
    (set, get) => ({
      // Initial state
      progress: null,
      stats: null,
      badges: null,
      leaderboard: null,
      activityFeed: null,
      dashboardSummary: null,
      achievements: null,
      levels: null,
      isLoadingProgress: false,
      isLoadingStats: false,
      isLoadingBadges: false,
      isLoadingLeaderboard: false,
      isLoadingActivity: false,
      isLoadingDashboard: false,
      isLoadingAchievements: false,
      isLoadingLevels: false,
      isLoading: false,
      error: null,
      lastFetch: null,
      retryCount: 0,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      
      // Real API fetch methods with retry logic and offline support
      fetchProgress: async () => {
        const state = get();
        
        // Skip if offline and we have cached data
        if (!state.isOnline && state.progress && state.lastFetch) {
          const cacheAge = Date.now() - state.lastFetch;
          if (cacheAge < 10 * 60 * 1000) { // 10 minutes cache
            console.log('Using cached progress data (offline)');
            return;
          }
        }
        
        set({ isLoadingProgress: true, error: null });
        
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            const progress = await gamificationApi.getProgress();
            set({ 
              progress,
              isLoadingProgress: false,
              lastFetch: Date.now(),
              retryCount: 0,
              error: null
            });
            return;
          } catch (error: any) {
            retryCount++;
            console.error(`Error fetching progress (attempt ${retryCount}):`, error);
            
            if (retryCount >= maxRetries) {
              // Check if we have cached data to fall back on
              if (state.progress && state.lastFetch) {
                const cacheAge = Date.now() - state.lastFetch;
                if (cacheAge < 30 * 60 * 1000) { // 30 minutes fallback
                  console.log('Using cached progress data due to API failure');
                  set({ isLoadingProgress: false, error: null });
                  return;
                }
              }
              
              set({ 
                error: error.message || 'Failed to fetch progress', 
                isLoadingProgress: false,
                retryCount
              });
            } else {
              // Wait before retry with exponential backoff
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
            }
          }
        }
      },
      
      fetchStats: async () => {
        set({ isLoadingStats: true, error: null });
        try {
          const stats = await gamificationApi.getStats();
          set({ 
            stats,
            isLoadingStats: false,
            lastFetch: Date.now()
          });
        } catch (error: any) {
          console.error('Error fetching gamification stats:', error);
          set({ 
            error: error.message || 'Failed to fetch stats', 
            isLoadingStats: false 
          });
        }
      },
      
      fetchBadges: async () => {
        set({ isLoadingBadges: true, error: null });
        try {
          const badges = await gamificationApi.getBadges();
          set({ 
            badges,
            isLoadingBadges: false,
            lastFetch: Date.now()
          });
        } catch (error: any) {
          console.error('Error fetching gamification badges:', error);
          set({ 
            error: error.message || 'Failed to fetch badges', 
            isLoadingBadges: false 
          });
        }
      },
      
      fetchLeaderboard: async (limit = 10) => {
        set({ isLoadingLeaderboard: true, error: null });
        try {
          const leaderboard = await gamificationApi.getLeaderboard(limit);
          set({ 
            leaderboard,
            isLoadingLeaderboard: false,
            lastFetch: Date.now()
          });
        } catch (error: any) {
          console.error('Error fetching leaderboard:', error);
          set({ 
            error: error.message || 'Failed to fetch leaderboard', 
            isLoadingLeaderboard: false 
          });
        }
      },
      
      fetchActivityFeed: async (limit = 20) => {
        set({ isLoadingActivity: true, error: null });
        try {
          const activityFeed = await gamificationApi.getActivityFeed(limit);
          set({ 
            activityFeed,
            isLoadingActivity: false,
            lastFetch: Date.now()
          });
        } catch (error: any) {
          console.error('Error fetching activity feed:', error);
          set({ 
            error: error.message || 'Failed to fetch activity', 
            isLoadingActivity: false 
          });
        }
      },
      
      fetchDashboardSummary: async () => {
        set({ isLoadingDashboard: true, error: null });
        try {
          const dashboardSummary = await gamificationApi.getDashboard();
          set({ 
            dashboardSummary,
            isLoadingDashboard: false,
            lastFetch: Date.now()
          });
        } catch (error: any) {
          console.error('Error fetching dashboard:', error);
          set({ 
            error: error.message || 'Failed to fetch dashboard', 
            isLoadingDashboard: false 
          });
        }
      },
      
      fetchAchievements: async () => {
        set({ isLoadingAchievements: true, error: null });
        try {
          const achievements = await gamificationApi.getAchievements();
          set({ 
            achievements,
            isLoadingAchievements: false,
            lastFetch: Date.now()
          });
        } catch (error: any) {
          console.error('Error fetching achievements:', error);
          set({ 
            error: error.message || 'Failed to fetch achievements', 
            isLoadingAchievements: false 
          });
        }
      },
      
      fetchLevels: async () => {
        set({ isLoadingLevels: true, error: null });
        try {
          const levels = await gamificationApi.getLevels();
          set({ 
            levels,
            isLoadingLevels: false,
            lastFetch: Date.now()
          });
        } catch (error: any) {
          console.error('Error fetching levels:', error);
          set({ 
            error: error.message || 'Failed to fetch levels', 
            isLoadingLevels: false 
          });
        }
      },
      
      fetchAll: async () => {
        const state = get();
        
        // Prevent duplicate fetches - check if already loading
        if (state.isLoading) {
          console.log('[fetchAll] Already loading, skipping duplicate request');
          return;
        }
        
        // Check cache freshness - skip if data was fetched recently
        if (state.lastFetch) {
          const cacheAge = Date.now() - state.lastFetch;
          if (cacheAge < 5000) { // 5 seconds minimum between fetches
            console.log('[fetchAll] Data is fresh (fetched', cacheAge, 'ms ago), skipping');
            return;
          }
        }
        
        set({ isLoading: true, error: null });
        try {
          const { 
            fetchProgress, 
            fetchStats, 
            fetchBadges, 
            fetchLeaderboard, 
            fetchActivityFeed, 
            fetchDashboardSummary,
            fetchAchievements,
            fetchLevels
          } = get();
          
          // Fetch all data in parallel for better performance
          await Promise.allSettled([
            fetchProgress(),
            fetchStats(),
            fetchBadges(),
            fetchLeaderboard(),
            fetchActivityFeed(),
            fetchDashboardSummary(),
            fetchAchievements(),
            fetchLevels()
          ]);
          
          set({ isLoading: false, lastFetch: Date.now() });
        } catch (error: any) {
          console.error('Error fetching all gamification data:', error);
          set({ 
            error: error.message || 'Failed to fetch data', 
            isLoading: false 
          });
        }
      },
      
      // Utility methods
      clearError: () => set({ error: null }),
      
      invalidateCache: () => {
        set({ 
          progress: null,
          stats: null,
          badges: null,
          leaderboard: null,
          activityFeed: null,
          dashboardSummary: null,
          achievements: null,
          levels: null,
          lastFetch: null
        });
      },
      
      refreshData: async () => {
        const { invalidateCache, fetchAll } = get();
        
        // Update online status
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        set({ isOnline });
        
        // Only refresh if online or forced
        if (isOnline) {
          invalidateCache();
          await fetchAll();
        } else {
          console.log('Offline - skipping data refresh');
        }
      },
      
      // Network status awareness
      updateOnlineStatus: () => {
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        set({ isOnline });
      },
      
      // Smart cache invalidation
      shouldRefresh: () => {
        const state = get();
        if (!state.lastFetch) return true;
        
        const cacheAge = Date.now() - state.lastFetch;
        const maxAge = state.isOnline ? 5 * 60 * 1000 : 30 * 60 * 1000; // 5min online, 30min offline
        
        return cacheAge > maxAge;
      }
    }),
    {
      name: 'gamification-storage',
      // Only persist essential data - not loading states or errors
      partialize: (state) => ({ 
        progress: state.progress,
        stats: state.stats,
        badges: state.badges,
        dashboardSummary: state.dashboardSummary,
        achievements: state.achievements,
        lastFetch: state.lastFetch
      }),
      // Add version for cache invalidation when structure changes
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          // Clear old cache structure when migrating
          return {
            progress: null,
            stats: null,
            badges: null,
            dashboardSummary: null,
            achievements: null,
            lastFetch: null
          };
        }
        return persistedState;
      }
    }
  )
);