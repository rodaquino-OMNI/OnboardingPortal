import { useCallback } from 'react';
import { useGamification } from './useGamification';
import { gamificationEvents } from '@/lib/gamification-events';
import { GamificationCalculator, POINT_VALUES } from '@/lib/gamification-calculator';
import apiService from '@/services/api';

/**
 * Hook for tracking gamification events and calculating points
 * 
 * This ensures all user actions are properly tracked and points
 * are calculated consistently using the GamificationCalculator
 */
export function useGamificationTracking() {
  const { refreshData } = useGamification();

  /**
   * Track document upload and calculate points
   */
  const trackDocumentUpload = useCallback(async (documentType: string, isFirstDocument: boolean = false) => {
    try {
      const points = GamificationCalculator.calculateActionPoints(
        'DOCUMENT_UPLOAD',
        { isFirstTime: isFirstDocument }
      );

      // Send to backend
      await apiService.post('/api/gamification/track', {
        action: 'document_upload',
        points,
        metadata: { documentType }
      });

      // Trigger event for real-time update
      await gamificationEvents.triggerEvent({
        type: 'document_upload',
        points_earned: points,
        timestamp: Date.now()
      });

      // Refresh gamification data
      await refreshData();
      
      return points;
    } catch (error) {
      console.error('Error tracking document upload:', error);
      return 0;
    }
  }, [refreshData]);

  /**
   * Track health questionnaire completion
   */
  const trackHealthQuestionnaire = useCallback(async (
    sectionsCompleted: number,
    totalSections: number,
    accuracy: number = 100
  ) => {
    try {
      let points = 0;

      // Points for sections
      points += sectionsCompleted * POINT_VALUES.HEALTH_SECTION_COMPLETE;

      // Bonus for full completion
      if (sectionsCompleted === totalSections) {
        points += GamificationCalculator.calculateActionPoints(
          'HEALTH_QUESTIONNAIRE_COMPLETE',
          { accuracy }
        );
      }

      // Send to backend
      await apiService.post('/api/gamification/track', {
        action: 'health_questionnaire',
        points,
        metadata: { 
          sectionsCompleted,
          totalSections,
          accuracy 
        }
      });

      // Trigger event
      await gamificationEvents.triggerEvent({
        type: 'health_completion',
        points_earned: points,
        timestamp: Date.now()
      });

      await refreshData();
      return points;
    } catch (error) {
      console.error('Error tracking health questionnaire:', error);
      return 0;
    }
  }, [refreshData]);

  /**
   * Track interview scheduling
   */
  const trackInterviewSchedule = useCallback(async (isReschedule: boolean = false) => {
    try {
      const action = isReschedule ? 'INTERVIEW_RESCHEDULED' : 'INTERVIEW_SCHEDULED';
      const points = POINT_VALUES[action];

      await apiService.post('/api/gamification/track', {
        action: 'interview_schedule',
        points,
        metadata: { isReschedule }
      });

      await gamificationEvents.triggerEvent({
        type: 'interview_scheduled',
        points_earned: points,
        timestamp: Date.now()
      });

      await refreshData();
      return points;
    } catch (error) {
      console.error('Error tracking interview schedule:', error);
      return 0;
    }
  }, [refreshData]);

  /**
   * Track profile updates
   */
  const trackProfileUpdate = useCallback(async (isComplete: boolean, isFirstTime: boolean = false) => {
    try {
      const action = isComplete ? 'PROFILE_COMPLETE' : 'PROFILE_UPDATE';
      const points = GamificationCalculator.calculateActionPoints(
        action as keyof typeof POINT_VALUES,
        { isFirstTime }
      );

      await apiService.post('/api/gamification/track', {
        action: 'profile_update',
        points,
        metadata: { isComplete, isFirstTime }
      });

      await gamificationEvents.triggerEvent({
        type: 'profile_update',
        points_earned: points,
        timestamp: Date.now()
      });

      await refreshData();
      return points;
    } catch (error) {
      console.error('Error tracking profile update:', error);
      return 0;
    }
  }, [refreshData]);

  /**
   * Track onboarding completion with time bonus
   */
  const trackOnboardingComplete = useCallback(async (completionTimeHours: number) => {
    try {
      const points = GamificationCalculator.calculateActionPoints(
        'ONBOARDING_COMPLETE',
        { completionTime: completionTimeHours }
      );

      await apiService.post('/api/gamification/track', {
        action: 'onboarding_complete',
        points,
        metadata: { completionTimeHours }
      });

      await refreshData();
      return points;
    } catch (error) {
      console.error('Error tracking onboarding completion:', error);
      return 0;
    }
  }, [refreshData]);

  /**
   * Track daily login and streak
   */
  const trackDailyLogin = useCallback(async (streakDays: number) => {
    try {
      const points = GamificationCalculator.calculateActionPoints(
        'DAILY_LOGIN',
        { streakDays }
      );

      // Add streak bonuses
      let bonusPoints = 0;
      if (streakDays === 7) {
        bonusPoints += POINT_VALUES.WEEKLY_STREAK;
      } else if (streakDays === 30) {
        bonusPoints += POINT_VALUES.MONTHLY_STREAK;
      }

      const totalPoints = points + bonusPoints;

      await apiService.post('/api/gamification/track', {
        action: 'daily_login',
        points: totalPoints,
        metadata: { streakDays, bonusPoints }
      });

      await refreshData();
      return totalPoints;
    } catch (error) {
      console.error('Error tracking daily login:', error);
      return 0;
    }
  }, [refreshData]);

  /**
   * Calculate potential points for an action
   */
  const calculatePotentialPoints = useCallback((
    action: keyof typeof POINT_VALUES,
    modifiers?: Parameters<typeof GamificationCalculator.calculateActionPoints>[1]
  ): number => {
    return GamificationCalculator.calculateActionPoints(action, modifiers);
  }, []);

  /**
   * Get current level information
   */
  const getLevelInfo = useCallback((totalPoints: number) => {
    return GamificationCalculator.calculateLevelProgress(totalPoints);
  }, []);

  return {
    trackDocumentUpload,
    trackHealthQuestionnaire,
    trackInterviewSchedule,
    trackProfileUpdate,
    trackOnboardingComplete,
    trackDailyLogin,
    calculatePotentialPoints,
    getLevelInfo,
  };
}