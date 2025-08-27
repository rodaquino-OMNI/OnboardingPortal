import apiService from '@/services/api';
import type { HealthAssessmentResults } from '@/lib/unified-health-flow';
import { logger } from '@/lib/logger';

export interface HealthQuestionnaireSubmitRequest {
  questionnaire_type: 'unified' | 'smart' | 'progressive' | 'dual-pathway';
  responses: Record<string, any>;
  metadata: {
    version: string;
    completed_at: string;
    time_taken_seconds: number;
    domains_completed: string[];
    risk_scores?: Record<string, number>;
    validation_pairs?: Record<string, any>;
    fraud_score?: number;
  };
  session_id?: string;
  user_id?: string;
}

export interface HealthQuestionnaireSubmitResponse {
  success: boolean;
  questionnaire_id: string;
  risk_assessment: {
    overall_risk: 'low' | 'moderate' | 'high' | 'critical';
    domain_risks: Record<string, 'low' | 'moderate' | 'high' | 'critical'>;
    recommendations: string[];
    requires_immediate_attention: boolean;
  };
  gamification_rewards?: {
    points_earned: number;
    badges_earned: string[];
    level_progress: {
      current_level: number;
      current_xp: number;
      next_level_xp: number;
    };
    achievements_unlocked: string[];
  };
  next_steps: {
    action: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
  }[];
}

class HealthAPI {
  /**
   * Submit health questionnaire responses
   */
  async submitQuestionnaire(
    data: HealthQuestionnaireSubmitRequest
  ): Promise<HealthQuestionnaireSubmitResponse> {
    try {
      const response = await apiService.post(
        `/health-questionnaires/submit-${data.questionnaire_type}`,
        data
      );
      
      // FIX: Add defensive check for response.data existence
      if (!response || !response.data) {
        logger.error('Invalid response from server: No data received', null, null, 'HealthAPI');
        throw new Error('Invalid response from server');
      }
      
      // Update gamification state if rewards are returned
      if (response.data && typeof response.data === 'object' && 'gamification_rewards' in response.data && (response.data as any).gamification_rewards) {
        // Trigger gamification update event
        window.dispatchEvent(new CustomEvent('gamification:update', {
          detail: (response.data as any).gamification_rewards
        }));
      }
      
      return response.data as HealthQuestionnaireSubmitResponse;
    } catch (error) {
      logger.error('Error submitting health questionnaire', error, null, 'HealthAPI');
      // FIX: Return a default response structure on error to prevent undefined access
      if (error instanceof Error && error.message.includes('500')) {
        logger.warn('Server error detected, returning fallback response', null, 'HealthAPI');
        return {
          success: false,
          questionnaire_id: `error-${Date.now()}`,
          risk_assessment: {
            overall_risk: 'low',
            domain_risks: {},
            recommendations: [],
            requires_immediate_attention: false,
          },
          next_steps: []
        } as HealthQuestionnaireSubmitResponse;
      }
      throw error;
    }
  }

  /**
   * Get questionnaire templates
   */
  async getTemplates() {
    try {
      const response = await apiService.get('/health-questionnaires/templates');
      return response.data;
    } catch (error) {
      logger.error('Error fetching questionnaire templates', error, null, 'HealthAPI');
      throw error;
    }
  }

  /**
   * Start a new questionnaire session
   */
  async startQuestionnaire(templateId: string) {
    try {
      const response = await apiService.post('/health-questionnaires/start', {
        template_id: templateId
      });
      return response.data;
    } catch (error) {
      logger.error('Error starting questionnaire', error, null, 'HealthAPI');
      throw error;
    }
  }

  /**
   * Save questionnaire progress (auto-save)
   */
  async saveProgress(questionnaireId: string, responses: Record<string, any>) {
    try {
      const response = await apiService.put(
        `/health-questionnaires/${questionnaireId}/responses`,
        { responses }
      );
      return response.data;
    } catch (error) {
      logger.error('Error saving questionnaire progress', error, null, 'HealthAPI');
      throw error;
    }
  }

  /**
   * Get AI insights for responses
   */
  async getAIInsights(questionnaireId: string, domain: string) {
    try {
      const response = await apiService.post(
        `/health-questionnaires/${questionnaireId}/ai-insights`,
        { domain }
      );
      return response.data;
    } catch (error) {
      logger.error('Error getting AI insights', error, null, 'HealthAPI');
      throw error;
    }
  }

  /**
   * Convert UnifiedHealthFlow results to submission format
   */
  prepareSubmissionData(
    results: HealthAssessmentResults,
    questionnaireType: 'unified' | 'smart' | 'progressive' | 'dual-pathway' = 'unified',
    startTime: Date
  ): HealthQuestionnaireSubmitRequest {
    const endTime = new Date();
    const timeTakenSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

    return {
      questionnaire_type: questionnaireType,
      responses: results.responses,
      metadata: {
        version: '2.0.0',
        completed_at: endTime.toISOString(),
        time_taken_seconds: timeTakenSeconds,
        domains_completed: results.completedDomains,
        risk_scores: results.riskScores,
        fraud_score: results.fraudDetectionScore
      }
    };
  }
}

export const healthAPI = new HealthAPI();