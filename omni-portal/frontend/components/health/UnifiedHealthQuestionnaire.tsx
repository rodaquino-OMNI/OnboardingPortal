'use client';

import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { BaseHealthQuestionnaire, QuestionnaireConfig } from './unified/BaseHealthQuestionnaire';
import { QuestionRendererFeatureDefinition } from './unified/QuestionRenderer';
import { AIAssistantFeatureDefinition } from './unified/features/AIAssistantFeature';
import { GamificationFeatureDefinition } from './unified/features/GamificationFeature';
import { ClinicalDecisionFeature } from './unified/features/ClinicalDecisionFeature';
import { ProgressiveScreeningFeature } from './unified/features/ProgressiveScreeningFeature';
import { AccessibilityFeature } from './unified/features/AccessibilityFeature';
import { HEALTH_QUESTIONNAIRE_SECTIONS } from '@/lib/health-questionnaire-v2';

interface UnifiedHealthQuestionnaireProps {
  onComplete: (data: any) => void;
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
  userId,
  mode = 'standard',
  features = {},
  theme = 'light'
}: UnifiedHealthQuestionnaireProps) {
  // Configure features based on mode and explicit settings
  const getEnabledFeatures = () => {
    const baseFeatures = [QuestionRendererFeatureDefinition];

    // AI Assistant Feature
    if (features.ai !== false && (mode === 'conversational' || mode === 'standard')) {
      baseFeatures.push({
        ...AIAssistantFeatureDefinition,
        config: {
          ...AIAssistantFeatureDefinition.config,
          personality: mode === 'conversational' ? 'empathetic' : 'friendly'
        }
      });
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

  // Handle completion with enriched data
  const handleComplete = (data: any) => {
    const enrichedData = {
      ...data,
      userId,
      mode,
      completedAt: new Date().toISOString(),
      features: Object.keys(features).filter(f => features[f as keyof typeof features]),
      version: '2.0.0'
    };

    // Clear persisted state
    if (config.persistence?.enabled) {
      const key = config.persistence.key || 'questionnaire-state';
      localStorage.removeItem(key);
    }

    onComplete(enrichedData);
  };

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <div className={`unified-health-questionnaire theme-${theme}`}>
        <BaseHealthQuestionnaire
          config={config}
          onComplete={handleComplete}
        />
      </div>
    </ErrorBoundary>
  );
}

// Export presets for common use cases
export const QuestionnairePresets = {
  standard: {
    mode: 'standard' as const,
    features: { ai: true, gamification: true, progressive: true, accessibility: true }
  },
  conversational: {
    mode: 'conversational' as const,
    features: { ai: true, gamification: false, progressive: true, accessibility: true }
  },
  clinical: {
    mode: 'clinical' as const,
    features: { ai: false, gamification: false, clinical: true, progressive: true, accessibility: true }
  },
  gamified: {
    mode: 'gamified' as const,
    features: { ai: true, gamification: true, progressive: false, accessibility: true }
  },
  minimal: {
    mode: 'standard' as const,
    features: { ai: false, gamification: false, progressive: false, accessibility: true }
  }
};