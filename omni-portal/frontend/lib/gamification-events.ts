'use client';

import { useGamification } from '@/hooks/useGamification';

/**
 * Gamification Event System
 * 
 * This module provides real-time updates for gamification data
 * when key events occur (like health questionnaire completion)
 */

export interface GamificationEvent {
  type: 'health_completion' | 'document_upload' | 'profile_update' | 'interview_scheduled';
  points_earned?: number;
  badges_earned?: string[];
  level_up?: boolean;
  timestamp: number;
}

class GamificationEventManager {
  private listeners: Set<(event: GamificationEvent) => void> = new Set();
  private refreshTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Add event listener for gamification updates
   */
  addEventListener(listener: (event: GamificationEvent) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Trigger gamification refresh after an event
   */
  async triggerEvent(event: GamificationEvent): Promise<void> {
    try {
      console.log('Gamification event triggered:', event);
      
      // Notify all listeners
      this.listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in gamification event listener:', error);
        }
      });

      // Debounce refresh calls to avoid excessive API requests
      const refreshKey = event.type;
      this.debounceRefresh(refreshKey);
      
    } catch (error) {
      console.error('Error triggering gamification event:', error);
    }
  }

  /**
   * Debounced refresh to avoid excessive API calls
   */
  private debounceRefresh(key: string, delay: number = 1000): void {
    // Clear existing timeout
    const existingTimeout = this.refreshTimeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      try {
        const gamificationStore = useGamification.getState();
        console.log('Refreshing gamification data after event:', key);
        await gamificationStore.refreshData();
      } catch (error) {
        console.error('Error refreshing gamification data:', error);
      } finally {
        this.refreshTimeouts.delete(key);
      }
    }, delay);

    this.refreshTimeouts.set(key, timeout);
  }

  /**
   * Clear all pending refreshes (useful for cleanup)
   */
  clearPendingRefreshes(): void {
    this.refreshTimeouts.forEach(timeout => clearTimeout(timeout));
    this.refreshTimeouts.clear();
  }
}

// Global instance
export const gamificationEvents = new GamificationEventManager();

/**
 * Hook for components to listen to gamification events
 */
export function useGamificationEvents() {
  const addListener = (listener: (event: GamificationEvent) => void) => {
    return gamificationEvents.addEventListener(listener);
  };

  const triggerEvent = (event: Omit<GamificationEvent, 'timestamp'>) => {
    return gamificationEvents.triggerEvent({
      ...event,
      timestamp: Date.now()
    });
  };

  return {
    addListener,
    triggerEvent
  };
}

/**
 * Trigger gamification refresh after health questionnaire completion
 */
export async function triggerHealthCompletionEvent(points?: number): Promise<void> {
  await gamificationEvents.triggerEvent({
    type: 'health_completion',
    points_earned: points,
    timestamp: Date.now()
  });
}

/**
 * Trigger gamification refresh after document upload
 */
export async function triggerDocumentUploadEvent(points?: number): Promise<void> {
  await gamificationEvents.triggerEvent({
    type: 'document_upload',
    points_earned: points,
    timestamp: Date.now()
  });
}

/**
 * Trigger gamification refresh after profile update
 */
export async function triggerProfileUpdateEvent(points?: number): Promise<void> {
  await gamificationEvents.triggerEvent({
    type: 'profile_update',
    points_earned: points,
    timestamp: Date.now()
  });
}

/**
 * Trigger gamification refresh after interview scheduling
 */
export async function triggerInterviewScheduledEvent(points?: number): Promise<void> {
  await gamificationEvents.triggerEvent({
    type: 'interview_scheduled',
    points_earned: points,
    timestamp: Date.now()
  });
}

/**
 * Automatic session storage for offline resilience
 */
class GamificationSessionManager {
  private static readonly STORAGE_KEY = 'gamification_session_data';
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Store gamification data in session storage with timestamp
   */
  static store(data: any): void {
    try {
      const sessionData = {
        data,
        timestamp: Date.now(),
        version: 1
      };
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Error storing gamification session data:', error);
    }
  }

  /**
   * Retrieve gamification data from session storage if still valid
   */
  static retrieve(): any | null {
    try {
      const stored = sessionStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const sessionData = JSON.parse(stored);
      const age = Date.now() - sessionData.timestamp;

      // Return data if within cache duration
      if (age < this.CACHE_DURATION) {
        return sessionData.data;
      }

      // Clear expired data
      this.clear();
      return null;
    } catch (error) {
      console.error('Error retrieving gamification session data:', error);
      return null;
    }
  }

  /**
   * Clear session storage
   */
  static clear(): void {
    try {
      sessionStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing gamification session data:', error);
    }
  }
}

export { GamificationSessionManager };