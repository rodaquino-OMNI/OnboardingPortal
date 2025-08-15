/**
 * useGamificationIntegration - React hook for gamification with new architecture
 * Maintains compatibility with existing useGamification while using new system
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGamification } from './useGamification';
import { gamificationIntegration } from '@/modules/gamification/GamificationIntegration';
import { featureFlags } from '@/lib/feature-flags';
import { eventBus } from '@/modules/events/EventBus';
import { unifiedState } from '@/modules/state/UnifiedStateAdapter';

export function useGamificationIntegrated() {
  const legacyGamification = useGamification();
  const shouldUseNew = featureFlags.get('USE_UNIFIED_STATE');
  
  const [state, setState] = useState(() => {
    if (shouldUseNew) {
      return gamificationIntegration.getState();
    }
    return {
      points: legacyGamification.progress?.total_points || 0,
      level: legacyGamification.progress?.current_level || 1,
      achievements: legacyGamification.progress?.achievements || [],
      progress: legacyGamification.progress
    };
  });

  // Initialize integration
  useEffect(() => {
    if (shouldUseNew) {
      gamificationIntegration.initialize();
    }
  }, [shouldUseNew]);

  // Subscribe to updates
  useEffect(() => {
    if (!shouldUseNew) return;

    const unsubscribers = [
      eventBus.on('gamification.points.updated', (event) => {
        setState(prev => ({
          ...prev,
          points: event.payload.points
        }));
      }),
      
      eventBus.on('gamification.level.up', (event) => {
        setState(prev => ({
          ...prev,
          level: event.payload.level
        }));
      }),
      
      eventBus.on('gamification.achievement.unlocked', (event) => {
        setState(prev => ({
          ...prev,
          achievements: [...prev.achievements, event.payload.achievementId]
        }));
      })
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [shouldUseNew]);

  // Award points function
  const awardPoints = useCallback(async (points: number, reason?: string) => {
    if (shouldUseNew) {
      await gamificationIntegration.awardPoints(points, reason);
    } else {
      // Legacy system doesn't support client-side point awarding (security)
      console.warn('[Gamification] Points must be awarded by backend');
    }
  }, [shouldUseNew]);

  // Unlock achievement function  
  const unlockAchievement = useCallback(async (achievementId: string) => {
    if (shouldUseNew) {
      await gamificationIntegration.awardAchievement(achievementId);
    } else {
      // Legacy system handles this through API
      console.log('[Gamification] Achievement unlock requested:', achievementId);
    }
  }, [shouldUseNew]);

  // Check achievement function
  const hasAchievement = useCallback((achievementId: string): boolean => {
    if (shouldUseNew) {
      return gamificationIntegration.hasAchievement(achievementId);
    }
    return legacyGamification.progress?.achievements?.includes(achievementId) || false;
  }, [shouldUseNew, legacyGamification.progress]); // All dependencies included

  // Get points to next level
  const getPointsToNextLevel = useCallback((): number => {
    if (shouldUseNew) {
      return gamificationIntegration.getPointsToNextLevel();
    }
    const currentPoints = Number(legacyGamification.progress?.total_points) || 0;
    const currentLevel = Number(legacyGamification.progress?.current_level) || 1;
    return (currentLevel * 1000) - currentPoints;
  }, [shouldUseNew, legacyGamification.progress]);

  // Refresh data
  const refresh = useCallback(async () => {
    if (shouldUseNew) {
      await gamificationIntegration.initialize();
      setState(gamificationIntegration.getState());
    } else {
      await legacyGamification.fetchAll();
    }
  }, [shouldUseNew, legacyGamification]);

  // Return unified interface
  if (shouldUseNew) {
    return {
      // State
      points: state.points,
      level: state.level,
      achievements: state.achievements,
      progress: state.progress,
      
      // Legacy compatibility
      stats: null,
      badges: null,
      leaderboard: null,
      activityFeed: null,
      
      // Loading states
      isLoading: false,
      error: null,
      
      // Actions
      awardPoints,
      unlockAchievement,
      hasAchievement,
      getPointsToNextLevel,
      refresh,
      
      // Legacy actions (no-op or adapted)
      fetchProgress: refresh,
      fetchStats: async () => {},
      fetchBadges: async () => {},
      fetchLeaderboard: async () => {},
      fetchActivityFeed: async () => {},
      fetchAll: refresh
    };
  }

  // Return legacy implementation
  return {
    // Map legacy to new interface
    points: legacyGamification.progress?.total_points || 0,
    level: legacyGamification.progress?.current_level || 1,
    achievements: legacyGamification.progress?.achievements || [],
    progress: legacyGamification.progress,
    
    // Legacy data
    stats: legacyGamification.stats,
    badges: legacyGamification.badges,
    leaderboard: legacyGamification.leaderboard,
    activityFeed: legacyGamification.activityFeed,
    
    // Loading states
    isLoading: legacyGamification.isLoading,
    error: legacyGamification.error,
    
    // Actions
    awardPoints: () => console.warn('[Gamification] Points must be awarded by backend'),
    unlockAchievement: () => console.log('[Gamification] Achievement unlock through API'),
    hasAchievement,
    getPointsToNextLevel,
    refresh: legacyGamification.fetchAll,
    
    // Legacy actions
    fetchProgress: legacyGamification.fetchProgress,
    fetchStats: legacyGamification.fetchStats,
    fetchBadges: legacyGamification.fetchBadges,
    fetchLeaderboard: legacyGamification.fetchLeaderboard,
    fetchActivityFeed: legacyGamification.fetchActivityFeed,
    fetchAll: legacyGamification.fetchAll
  };
}

// Export as default for easy migration
export default useGamificationIntegrated;