'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { BaseHealthQuestionnaire, QuestionnaireConfig } from './unified/BaseHealthQuestionnaire';
import { useSafeQuestionnaireOptimization } from '@/hooks/useSafeQuestionnaireOptimization';
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

// PERFORMANCE OPTIMIZATION: Memoize Error Fallback Component
const ErrorFallback = memo(function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
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
});

// PERFORMANCE OPTIMIZATION: Memoize UnifiedHealthQuestionnaire component
const OptimizedUnifiedHealthQuestionnaire = memo(function OptimizedUnifiedHealthQuestionnaire({
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
  
  // INTEGRATION: Safe optimization features
  const optimization = useSafeQuestionnaireOptimization({
    enableCache: true,
    enableTouchOptimization: true,
    enablePerformanceMonitoring: true,
    debugMode: false
  });
  
  // Monitor optimization health
  useEffect(() => {
    const metrics = optimization.getMetrics();
    if (!metrics.isHealthy) {
      console.warn('[UnifiedHealthQuestionnaire] Optimization unhealthy:', metrics);
    }
  }, [optimization]);
  
  // PERFORMANCE OPTIMIZATION: Memoize features configuration to prevent recalculation
  const enabledFeatures = useMemo(() => {
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
  }, [features, mode]);

  // PERFORMANCE OPTIMIZATION: Memoize theme configuration to prevent recalculation
  const themeConfig = useMemo(() => {
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
  }, [theme]);

  // Build configuration
  console.log('[UnifiedHealthQuestionnaire] Loading sections:', HEALTH_QUESTIONNAIRE_SECTIONS?.length || 0, 'sections');
  console.log('[UnifiedHealthQuestionnaire] First section:', HEALTH_QUESTIONNAIRE_SECTIONS?.[0]);
  console.log('[UnifiedHealthQuestionnaire] Enabled features:', enabledFeatures.map(f => f.name));
  
  // PERFORMANCE OPTIMIZATION: Memoize configuration object to prevent recreation
  const config: QuestionnaireConfig = useMemo(() => ({
    sections: HEALTH_QUESTIONNAIRE_SECTIONS as any,
    features: enabledFeatures,
    theme: themeConfig,
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
  }), [enabledFeatures, themeConfig, userId]);

  // PERFORMANCE OPTIMIZATION: Memoize calculation functions
  const calculateBasicRiskScore = useCallback(() => {
    return { totalScore: 0, categories: {} };
  }, []);

  const getRiskLevel = useCallback((score: number): string => {
    if (score >= 100) return 'critical';
    if (score >= 75) return 'high';
    if (score >= 50) return 'moderate';
    return 'low';
  }, []);

  const generateRecommendations = useCallback(() => {
    return ['Manter hábitos saudáveis atuais', 'Realizar check-ups regulares'];
  }, []);

  // Handle completion with enriched data and backend submission
  const handleComplete = useCallback(async (data: any) => {
    console.log('[UnifiedHealthQuestionnaire] handleComplete - Raw data received:', data);
    
    // Extract responses properly - data contains { responses, metadata, timestamp }
    const responses = data.responses || {};
    const metadata = data.metadata || {};
    
    // Calculate completed domains based on responses
    const completedDomains: string[] = [];
    const domainResponses: Record<string, number> = {};
    
    // Group responses by section/domain
    HEALTH_QUESTIONNAIRE_SECTIONS.forEach(section => {
      const sectionResponses = section.questions.filter(q => 
        responses[q.id] !== undefined && responses[q.id] !== null
      );
      if (sectionResponses.length > 0) {
        completedDomains.push(section.id);
        domainResponses[section.id] = sectionResponses.length;
      }
    });
    
    const riskScoreData = calculateBasicRiskScore();
    
    // Create properly structured HealthAssessmentResults
    const healthAssessmentResults = {
      completedDomains,
      riskLevel: getRiskLevel(riskScoreData.totalScore),
      totalRiskScore: riskScoreData.totalScore,
      riskScores: riskScoreData.categories,
      recommendations: generateRecommendations(),
      nextSteps: [
        'Agendar consulta médica para revisão',
        'Baixar relatório de saúde em PDF',
        'Compartilhar resultados com profissional de saúde'
      ],
      responses,
      metadata: {
        ...metadata,
        userId,
        mode,
        completedAt: new Date().toISOString(),
        features: Object.keys(features).filter(f => features[f as keyof typeof features]),
        version: '2.0.0'
      }
    };

    console.log('[UnifiedHealthQuestionnaire] Structured healthAssessmentResults:', healthAssessmentResults);

    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      // Prepare submission data
      const submissionData = healthAPI.prepareSubmissionData(
        {
          responses: responses,
          completedDomains: completedDomains,
          riskScores: riskScoreData.categories,
          fraudDetectionScore: 0,
          timestamp: new Date().toISOString(),
          nextSteps: [],
          recommendations: [],
          totalRiskScore: 0,
          riskLevel: 'low' as const
        },
        mode === 'clinical' ? 'smart' : 'unified',
        startTimeRef.current
      );
      
      // FIX: Submit with correct data structure for backend
      const correctSubmissionData = {
        questionnaire_type: (mode === 'clinical' ? 'smart' : 'unified') as "progressive" | "unified" | "smart" | "dual-pathway",
        responses: responses,
        metadata: {
          version: '2.0.0',
          completed_at: new Date().toISOString(),
          time_taken_seconds: Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000),
          domains_completed: completedDomains,
          risk_scores: riskScoreData.categories,
          validation_pairs: {},
          fraud_score: 0
        },
        // Required fields at root level
        risk_scores: riskScoreData.categories,
        completed_domains: completedDomains,
        total_risk_score: riskScoreData.totalScore,
        risk_level: getRiskLevel(riskScoreData.totalScore),
        recommendations: generateRecommendations(),
        next_steps: healthAssessmentResults.nextSteps,
        fraud_detection_score: 0,
        timestamp: new Date().toISOString(),
        session_id: `session-${Date.now()}`,
        user_id: userId || 'anonymous'
      };
      
      // Submit to backend with correct endpoint
      const result = await healthAPI.submitQuestionnaire(correctSubmissionData);
      
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
      
      // Call parent onComplete with properly structured results
      onComplete({
        ...healthAssessmentResults,
        submission_result: result
      });
    } catch (error) {
      console.error('[UnifiedHealthQuestionnaire] Submission error:', error);
      setSubmitError('Erro ao enviar questionário. Por favor, tente novamente.');
      
      // Still call onComplete with structured data to allow navigation even on error
      onComplete(healthAssessmentResults);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    calculateBasicRiskScore,
    getRiskLevel,
    generateRecommendations,
    userId,
    mode,
    features,
    config.persistence,
    onComplete,
    fetchProgress,
    fetchBadges
  ]);

  // PERFORMANCE OPTIMIZATION: Memoize submission status components
  const submissionStatusComponent = useMemo(() => {
    if (!isSubmitting && !submitError && !submitSuccess) return null;
    
    return (
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
          <Alert variant="error">
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
    );
  }, [isSubmitting, submitError, submitSuccess]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <div className={`unified-health-questionnaire theme-${theme}`}>
        {/* Show submission status */}
        {submissionStatusComponent}
        
        <BaseHealthQuestionnaire
          config={config}
          onComplete={handleComplete}
          {...(onProgressUpdate && { onProgressUpdate })}
        />
      </div>
    </ErrorBoundary>
  );
});

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

export { OptimizedUnifiedHealthQuestionnaire };