'use client';

import { useState, useCallback } from 'react';
import { healthAPI, HealthQuestionnaireSubmitRequest, HealthQuestionnaireSubmitResponse } from '@/lib/api/health';
import { useGamification } from '@/hooks/useGamification';
import { triggerHealthCompletionEvent } from '@/lib/gamification-events';

interface UseQuestionnaireSubmissionOptions {
  onSuccess?: (response: HealthQuestionnaireSubmitResponse) => void;
  onError?: (error: Error) => void;
  updateGamification?: boolean;
}

export function useQuestionnaireSubmission(options: UseQuestionnaireSubmissionOptions = {}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResponse, setSubmitResponse] = useState<HealthQuestionnaireSubmitResponse | null>(null);
  
  const { fetchProgress, fetchBadges, fetchStats } = useGamification();

  const submitQuestionnaire = useCallback(async (data: HealthQuestionnaireSubmitRequest) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitResponse(null);

    try {
      // Submit to backend
      const response = await healthAPI.submitQuestionnaire(data);
      setSubmitResponse(response);

      // Trigger real-time gamification event for immediate UI updates
      if (options.updateGamification !== false) {
        const pointsEarned = response.gamification_rewards?.points_earned || 0;
        
        // Trigger event which will refresh all gamification data
        await triggerHealthCompletionEvent(pointsEarned);
        
        // Also show immediate feedback if points were earned
        if (pointsEarned > 0) {
          console.log(`🎉 Health questionnaire completed! Earned ${pointsEarned} points!`);
        }
      }

      // Call success callback
      options.onSuccess?.(response);

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar questionário';
      setSubmitError(errorMessage);
      
      // Call error callback
      options.onError?.(error instanceof Error ? error : new Error(errorMessage));
      
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [options]);

  const reset = useCallback(() => {
    setIsSubmitting(false);
    setSubmitError(null);
    setSubmitResponse(null);
  }, []);

  return {
    submitQuestionnaire,
    isSubmitting,
    submitError,
    submitResponse,
    reset
  };
}