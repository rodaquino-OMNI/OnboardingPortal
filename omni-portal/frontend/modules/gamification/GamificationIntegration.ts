/**
 * Gamification Integration - Ensures gamification works with new architecture
 * Maintains backward compatibility while leveraging new event system
 */

import { eventBus, EventTypes } from '@/modules/events/EventBus';
import { unifiedState } from '@/modules/state/UnifiedStateAdapter';
import { apiGateway } from '@/modules/api/ApiGateway';

export interface GamificationEvent {
  type: 'points_earned' | 'achievement_unlocked' | 'level_up' | 'badge_earned';
  userId: string;
  data: {
    points?: number;
    achievement?: string;
    level?: number;
    badge?: string;
    reason?: string;
  };
  timestamp: number;
}

export class GamificationIntegration {
  private static instance: GamificationIntegration;
  private initialized = false;
  private eventQueue: GamificationEvent[] = [];
  private processing = false;

  private constructor() {
    this.setupEventListeners();
    this.migrateExistingData();
  }

  static getInstance(): GamificationIntegration {
    if (!GamificationIntegration.instance) {
      GamificationIntegration.instance = new GamificationIntegration();
    }
    return GamificationIntegration.instance;
  }

  /**
   * Initialize gamification integration
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if gamification API is available
      const response = await apiGateway.execute({
        request: {
          method: 'GET',
          endpoint: '/api/gamification/progress',
          cache: true
        }
      });

      if (response.success) {
        console.log('[GamificationIntegration] API connection verified');
        
        // Store initial data in unified state
        if (response.data) {
          unifiedState.set('gamification', 'progress', response.data);
        }
      }

      this.initialized = true;
      console.log('[GamificationIntegration] Initialized successfully');
      
      // Process any queued events
      await this.processEventQueue();
      
    } catch (error) {
      console.error('[GamificationIntegration] Initialization failed:', error);
      // Don't throw - gamification should not break the app
    }
  }

  /**
   * Set up event listeners for gamification events
   */
  private setupEventListeners(): void {
    // Listen for auth events that affect gamification
    eventBus.on(EventTypes.AUTH_LOGIN, async (event) => {
      const userId = event.payload.user?.id;
      if (userId) {
        await this.syncUserProgress(userId);
      }
    });

    eventBus.on(EventTypes.AUTH_LOGOUT, () => {
      this.clearUserData();
    });

    // Listen for health questionnaire completion
    eventBus.on(EventTypes.HEALTH_QUESTIONNAIRE_COMPLETE, async (event) => {
      await this.awardPoints(100, 'health_questionnaire_complete');
    });

    // Listen for profile updates
    eventBus.on(EventTypes.USER_PROFILE_UPDATED, async (event) => {
      const profile = event.payload;
      
      // Check profile completion percentage
      const requiredFields = ['name', 'email', 'phone', 'birthDate', 'address'];
      const filledFields = requiredFields.filter(field => profile[field]);
      const completionPercentage = (filledFields.length / requiredFields.length) * 100;
      
      if (completionPercentage === 100) {
        await this.awardAchievement('profile_complete');
        await this.awardPoints(50, 'profile_completion');
      }
    });

    // Listen for custom gamification events
    eventBus.on('gamification.points.add', async (event) => {
      const { points, reason } = event.payload;
      await this.awardPoints(points, reason);
    });

    eventBus.on('gamification.achievement.unlock', async (event) => {
      const { achievement } = event.payload;
      await this.awardAchievement(achievement);
    });
  }

  /**
   * Migrate existing gamification data to new system
   */
  private async migrateExistingData(): Promise<void> {
    try {
      // Check for existing data in localStorage
      const existingData = localStorage.getItem('gamification-storage');
      
      if (existingData) {
        const parsed = JSON.parse(existingData);
        
        // Migrate to unified state
        if (parsed.state?.progress) {
          unifiedState.set('gamification', 'progress', parsed.state.progress);
        }
        if (parsed.state?.stats) {
          unifiedState.set('gamification', 'stats', parsed.state.stats);
        }
        if (parsed.state?.badges) {
          unifiedState.set('gamification', 'badges', parsed.state.badges);
        }
        
        console.log('[GamificationIntegration] Migrated existing data');
      }
    } catch (error) {
      console.error('[GamificationIntegration] Migration failed:', error);
    }
  }

  /**
   * Award points to user
   */
  async awardPoints(points: number, reason?: string): Promise<void> {
    try {
      // Get current user
      const user = unifiedState.get('auth', 'user');
      if (!user?.id) {
        console.warn('[GamificationIntegration] No user logged in');
        return;
      }

      // Queue event
      const event: GamificationEvent = {
        type: 'points_earned',
        userId: user.id,
        data: { points, reason },
        timestamp: Date.now()
      };
      
      this.eventQueue.push(event);
      
      // Process immediately if online
      await this.processEventQueue();
      
      // Update local state optimistically
      const currentPoints = unifiedState.get<number>('gamification', 'points') || 0;
      const newPoints = currentPoints + points;
      unifiedState.set('gamification', 'points', newPoints);
      
      // Check for level up
      const newLevel = Math.floor(newPoints / 1000) + 1;
      const currentLevel = unifiedState.get<number>('gamification', 'level') || 1;
      
      if (newLevel > currentLevel) {
        await this.levelUp(newLevel);
      }
      
      // Emit event for UI updates
      eventBus.emit('gamification.points.updated', { 
        points: newPoints, 
        added: points,
        reason 
      });
      
    } catch (error) {
      console.error('[GamificationIntegration] Failed to award points:', error);
    }
  }

  /**
   * Award achievement to user
   */
  async awardAchievement(achievementId: string): Promise<void> {
    try {
      const user = unifiedState.get('auth', 'user');
      if (!user?.id) return;

      // Check if already earned
      const achievements = unifiedState.get<string[]>('gamification', 'achievements') || [];
      if (achievements.includes(achievementId)) {
        console.log('[GamificationIntegration] Achievement already earned:', achievementId);
        return;
      }

      // Add to achievements
      achievements.push(achievementId);
      unifiedState.set('gamification', 'achievements', achievements);

      // Send to backend
      const response = await apiGateway.execute({
        request: {
          method: 'POST',
          endpoint: '/api/gamification/achievements',
          body: { achievementId }
        }
      });

      if (response.success) {
        // Award points for achievement
        await this.awardPoints(200, `achievement_${achievementId}`);
        
        // Emit event for UI
        eventBus.emit('gamification.achievement.unlocked', { 
          achievementId,
          timestamp: Date.now()
        });
      }
      
    } catch (error) {
      console.error('[GamificationIntegration] Failed to award achievement:', error);
    }
  }

  /**
   * Handle level up
   */
  private async levelUp(newLevel: number): Promise<void> {
    unifiedState.set('gamification', 'level', newLevel);
    
    // Award level up bonus
    const bonus = newLevel * 100;
    
    // Send to backend
    await apiGateway.execute({
      request: {
        method: 'POST',
        endpoint: '/api/gamification/level-up',
        body: { level: newLevel, bonus }
      }
    });
    
    // Emit event
    eventBus.emit('gamification.level.up', { 
      level: newLevel,
      bonus
    });
  }

  /**
   * Sync user progress from backend
   */
  private async syncUserProgress(userId: string): Promise<void> {
    try {
      const response = await apiGateway.execute({
        request: {
          method: 'GET',
          endpoint: `/api/gamification/progress/${userId}`,
          cache: false
        }
      });

      if (response.success && response.data) {
        // Update unified state with backend data
        unifiedState.set('gamification', 'progress', response.data);
        unifiedState.set('gamification', 'points', response.data.totalPoints || 0);
        unifiedState.set('gamification', 'level', response.data.currentLevel || 1);
        unifiedState.set('gamification', 'achievements', response.data.achievements || []);
        
        console.log('[GamificationIntegration] Synced user progress');
      }
    } catch (error) {
      console.error('[GamificationIntegration] Failed to sync progress:', error);
    }
  }

  /**
   * Process queued events
   */
  private async processEventQueue(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) return;
    
    this.processing = true;
    
    try {
      // Process events in batch
      const events = [...this.eventQueue];
      this.eventQueue = [];
      
      if (events.length > 0) {
        const response = await apiGateway.execute({
          request: {
            method: 'POST',
            endpoint: '/api/gamification/events',
            body: { events }
          }
        });
        
        if (!response.success) {
          // Re-queue failed events
          this.eventQueue.push(...events);
        }
      }
    } catch (error) {
      console.error('[GamificationIntegration] Failed to process events:', error);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Clear user data on logout
   */
  private clearUserData(): void {
    unifiedState.clear('gamification');
    this.eventQueue = [];
  }

  /**
   * Get current gamification state
   */
  getState() {
    return {
      points: unifiedState.get('gamification', 'points') || 0,
      level: unifiedState.get('gamification', 'level') || 1,
      achievements: unifiedState.get('gamification', 'achievements') || [],
      progress: unifiedState.get('gamification', 'progress') || null
    };
  }

  /**
   * Check if a specific achievement is earned
   */
  hasAchievement(achievementId: string): boolean {
    const achievements = unifiedState.get<string[]>('gamification', 'achievements') || [];
    return achievements.includes(achievementId);
  }

  /**
   * Get points to next level
   */
  getPointsToNextLevel(): number {
    const currentPoints = unifiedState.get<number>('gamification', 'points') || 0;
    const currentLevel = unifiedState.get<number>('gamification', 'level') || 1;
    const nextLevelPoints = currentLevel * 1000;
    return Math.max(0, nextLevelPoints - currentPoints);
  }
}

// Export singleton instance
export const gamificationIntegration = GamificationIntegration.getInstance();