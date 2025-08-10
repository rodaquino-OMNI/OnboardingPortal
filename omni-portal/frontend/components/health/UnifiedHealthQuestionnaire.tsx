'use client';

import React, { useState, useRef } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { BaseHealthQuestionnaire, QuestionnaireConfig } from './unified/BaseHealthQuestionnaire';
import { QuestionRendererFeatureDefinition } from './unified/QuestionRenderer';
// AI Assistant feature removed for clean clinical UX
import { GamificationFeatureDefinition } from './unified/features/GamificationFeature';
import { ClinicalDecisionFeature } from './unified/features/ClinicalDecisionFeature';
import { ProgressiveScreeningFeature } from './unified/features/ProgressiveScreeningFeature';
import { AccessibilityFeature } from './unified/features/AccessibilityFeature';
import { HEALTH_QUESTIONNAIRE_SECTIONS } from '@/lib/health-questionnaire-v2';
import { healthAPI } from '@/lib/api/health';
import { useGamification } from '@/hooks/useGamification';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Loader2 } from 'lucide-react';

interface UnifiedHealthQuestionnaireProps {
  onComplete: (data: any) => void;
  onProgressUpdate?: (progress: number) => void;
  userId?: string;
  mode?: 'standard' | 'conversational' | 'clinical' | 'gamified';
  features?: {
    ai?: boolean;
    gamification?: boolean;
    clinical?: boolean;
    progressive?: boolean;
    accessibility?: boolean;
  };
  theme?: 'light' | 'dark' | 'high-contrast';
}

// Error Fallback Component
function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
      <h2 className="text-lg font-semibold text-red-800 mb-2">
        Erro no Questionário de Saúde
      </h2>
      <p className="text-red-600 mb-4">
        Ocorreu um erro técnico. Seus dados estão seguros.
      </p>
      <details className="mb-4">
        <summary className="cursor-pointer text-sm text-red-700">
          Detalhes do erro
        </summary>
        <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto">
          {error.message}
        </pre>
      </details>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
      >
        Tentar Novamente
      </button>
    </div>
  );
}

export function UnifiedHealthQuestionnaire({
  onComplete,
  onProgressUpdate,
  userId,
  mode = 'standard',
  features = {},
  theme = 'light'
}: UnifiedHealthQuestionnaireProps) {
  console.log('[UnifiedHealthQuestionnaire] Rendering with props:', {
    userId,
    mode,
    features,
    theme
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const startTimeRef = useRef(new Date());
  const { fetchProgress, fetchBadges } = useGamification();
  // Configure features based on mode and explicit settings
  const getEnabledFeatures = () => {
    const baseFeatures = [QuestionRendererFeatureDefinition];

    // AI Assistant Feature
    if (features.ai !== false && (mode === 'conversational' || mode === 'standard')) {
      // AI Assistant feature removed for clean clinical UX
    }

    // Gamification Feature
    if (features.gamification !== false && (mode === 'gamified' || mode === 'standard')) {
      baseFeatures.push(GamificationFeatureDefinition);
    }

    // Clinical Decision Support
    if (features.clinical !== false && (mode === 'clinical' || features.clinical)) {
      baseFeatures.push(ClinicalDecisionFeature);
    }

    // Progressive Screening
    if (features.progressive !== false) {
      baseFeatures.push(ProgressiveScreeningFeature);
    }

    // Accessibility
    if (features.accessibility !== false) {
      baseFeatures.push(AccessibilityFeature);
    }

    return baseFeatures;
  };

  // Configure theme
  const getTheme = () => {
    switch (theme) {
      case 'dark':
        return {
          primaryColor: '#3B82F6',
          secondaryColor: '#8B5CF6',
          fontFamily: 'Inter, system-ui, sans-serif',
          borderRadius: '0.5rem',
          animationDuration: '300ms'
        };
      case 'high-contrast':
        return {
          primaryColor: '#000000',
          secondaryColor: '#FFFFFF',
          fontFamily: 'Inter, system-ui, sans-serif',
          borderRadius: '0.25rem',
          animationDuration: '0ms'
        };
      default:
        return {
          primaryColor: '#3B82F6',
          secondaryColor: '#8B5CF6',
          fontFamily: 'Inter, system-ui, sans-serif',
          borderRadius: '0.5rem',
          animationDuration: '300ms'
        };
    }
  };

  // Build configuration
  console.log('[UnifiedHealthQuestionnaire] Loading sections:', HEALTH_QUESTIONNAIRE_SECTIONS?.length || 0, 'sections');
  console.log('[UnifiedHealthQuestionnaire] First section:', HEALTH_QUESTIONNAIRE_SECTIONS?.[0]);
  console.log('[UnifiedHealthQuestionnaire] Enabled features:', getEnabledFeatures().map(f => f.name));
  
  const config: QuestionnaireConfig = {
    sections: HEALTH_QUESTIONNAIRE_SECTIONS,
    features: getEnabledFeatures(),
    theme: getTheme(),
    validation: {
      mode: 'on-blur',
      showErrors: true
    },
    persistence: {
      enabled: true,
      key: `health-questionnaire-${userId || 'anonymous'}`,
      storage: 'local',
      autoSave: true,
      saveInterval: 10000 // 10 seconds
    },
    analytics: {
      enabled: true,
      trackEvents: true,
      trackTiming: true
    }
  };

  // Handle completion with enriched data and backend submission
  const handleComplete = async (data: any) => {
    const enrichedData = {
      ...data,
      userId,
      mode,
      completedAt: new Date().toISOString(),
      features: Object.keys(features).filter(f => features[f as keyof typeof features]),
      version: '2.0.0'
    };

    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      // Prepare submission data
      const submissionData = healthAPI.prepareSubmissionData(
        {
          responses: enrichedData,
          completedDomains: Object.keys(data).filter(key => key.startsWith('domain_')),
          riskScores: {},
          validationPairs: {},
          fraudScore: 0,
          sessionId: `session-${Date.now()}`,
          userId: userId || 'anonymous'
        },
        mode === 'clinical' ? 'smart' : 'unified',
        startTimeRef.current
      );
      
      // Submit to backend
      const result = await healthAPI.submitQuestionnaire(submissionData);
      
      // Update gamification state if enabled
      if (features.gamification !== false && result.gamification_rewards) {
        await Promise.all([
          fetchProgress(),
          fetchBadges()
        ]);
      }
      
      setSubmitSuccess(true);
      
      // Clear persisted state
      if (config.persistence?.enabled) {
        const key = config.persistence.key || 'questionnaire-state';
        localStorage.removeItem(key);
      }
      
      // Call parent onComplete with full results
      onComplete({
        ...enrichedData,
        submission_result: result
      });
    } catch (error) {
      console.error('[UnifiedHealthQuestionnaire] Submission error:', error);
      setSubmitError('Erro ao enviar questionário. Por favor, tente novamente.');
      
      // Still call onComplete to allow navigation even on error
      onComplete(enrichedData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <div className={`unified-health-questionnaire theme-${theme}`}>
        {/* Show submission status */}
        {(isSubmitting || submitError || submitSuccess) && (
          <div className="mb-4">
            {isSubmitting && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  Enviando suas respostas...
                </AlertDescription>
              </Alert>
            )}
            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
            {submitSuccess && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Questionário enviado com sucesso!
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
        
        <BaseHealthQuestionnaire
          config={config}
          onComplete={handleComplete}
          onProgressUpdate={onProgressUpdate}
        />
      </div>
    </ErrorBoundary>
  );
}

// Export presets for common use cases
export const QuestionnairePresets = {
  standard: {
    mode: 'standard' as const,
    features: { ai: true, gamification: true, progressive: true, accessibility: false }
  },
  conversational: {
    mode: 'conversational' as const,
    features: { ai: true, gamification: false, progressive: true, accessibility: false }
  },
  clinical: {
    mode: 'clinical' as const,
    features: { ai: false, gamification: false, clinical: true, progressive: true, accessibility: false }
  },
  gamified: {
    mode: 'gamified' as const,
    features: { ai: true, gamification: true, progressive: false, accessibility: false }
  },
  minimal: {
    mode: 'standard' as const,
    features: { ai: false, gamification: false, progressive: false, accessibility: false }
  }
};