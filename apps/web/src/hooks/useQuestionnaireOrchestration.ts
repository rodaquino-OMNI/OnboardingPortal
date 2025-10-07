/**
 * Health Questionnaire Orchestration Hook
 *
 * ADR-003 Compliance: Uses SWR for server state, local state for UI
 * Handles schema fetching, draft auto-save, submission, and analytics
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { useFeatureFlag } from '@/providers/FeatureFlagProvider';
import {
  trackHealthSchemaFetched,
  trackHealthQuestionnaireStarted,
  trackHealthPageTurn,
  trackHealthQuestionnaireSubmitted,
} from '@/lib/analytics/health-events';
import {
  evaluateBranchingLogic,
  shouldShowQuestion as checkQuestionVisibility,
  BranchingRule,
  Question,
  calculatePHQ9Score,
  calculateGAD7Score,
  determineRiskBand,
} from '@/lib/questionnaire/branching';

// Types
export interface QuestionnaireSchema {
  id: number;
  version: number;
  title: string;
  description: string;
  questions: Question[];
  branching_rules: BranchingRule[];
}

export interface QuestionnaireResponse {
  id: number;
  questionnaire_id: number;
  version: number;
  answers: Record<string, any>;
  risk_band: string;
  phq9_score?: number;
  gad7_score?: number;
  is_draft: boolean;
  submitted_at?: string;
}

interface UseQuestionnaireOrchestrationOptions {
  questionnaireId?: number;
  enableDraftAutoSave?: boolean;
  autoSaveDelayMs?: number;
}

interface QuestionnaireOrchestration {
  // Schema fetching
  schema: QuestionnaireSchema | null;
  isLoadingSchema: boolean;
  schemaError: Error | null;

  // Draft state
  draftResponse: QuestionnaireResponse | null;
  currentAnswers: Record<string, any>;
  saveDraft: (answers: Record<string, any>) => Promise<void>;

  // Submission
  submit: (answers: Record<string, any>) => Promise<QuestionnaireResponse>;
  isSubmitting: boolean;
  submitError: Error | null;

  // Navigation
  currentStep: number;
  totalSteps: number;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;

  // Branching logic
  visibleQuestions: Question[];
  shouldShowQuestion: (questionId: string) => boolean;

  // Analytics
  trackSchemaFetched: () => void;
  trackPageTurn: (pageNumber: number, dwellMs: number) => void;
  trackSubmission: (durationMs: number) => void;
}

/**
 * Fetcher function for SWR
 */
const fetcher = async (url: string) => {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Debounce utility
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
    }, waitMs);
  };
}

/**
 * Main orchestration hook for health questionnaires
 */
export function useQuestionnaireOrchestration(
  options: UseQuestionnaireOrchestrationOptions = {}
): QuestionnaireOrchestration {
  const {
    questionnaireId = 1,
    enableDraftAutoSave = true,
    autoSaveDelayMs = 3000,
  } = options;

  // Feature flag check
  const sliceC_health = useFeatureFlag('sliceC_health');

  // Timing refs for analytics
  const schemaFetchStartTime = useRef<number>(0);
  const questionnaireStartTime = useRef<number>(0);
  const pageStartTime = useRef<number>(0);

  // SWR for schema fetching
  const {
    data: schema,
    error: schemaError,
    isLoading: isLoadingSchema,
  } = useSWR<QuestionnaireSchema>(
    sliceC_health ? `/api/v1/health/schema?version=latest` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      onSuccess: (data) => {
        const latency = performance.now() - schemaFetchStartTime.current;
        trackHealthSchemaFetched(data.version, latency);
      },
    }
  );

  // Initialize schema fetch timing
  useEffect(() => {
    if (sliceC_health && !schema && !schemaError) {
      schemaFetchStartTime.current = performance.now();
    }
  }, [sliceC_health, schema, schemaError]);

  // Local state for UI navigation
  const [currentStep, setCurrentStep] = useState(0);
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<Error | null>(null);
  const [draftResponse, setDraftResponse] = useState<QuestionnaireResponse | null>(null);

  // Track questionnaire start
  useEffect(() => {
    if (schema && questionnaireStartTime.current === 0) {
      questionnaireStartTime.current = performance.now();
      trackHealthQuestionnaireStarted(schema.version);
    }
  }, [schema]);

  // Track page start time
  useEffect(() => {
    pageStartTime.current = performance.now();
  }, [currentStep]);

  // Draft auto-save with debounce
  const saveDraftInternal = useCallback(
    async (answers: Record<string, any>) => {
      if (!enableDraftAutoSave) return;

      try {
        const response = await fetch('/api/v1/health/response', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            questionnaire_id: questionnaireId,
            answers,
            is_draft: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`Draft save failed: ${response.statusText}`);
        }

        const result = await response.json();
        setDraftResponse(result);
      } catch (error) {
        console.error('Failed to save draft:', error);
      }
    },
    [questionnaireId, enableDraftAutoSave]
  );

  const saveDraft = useMemo(
    () => debounce(saveDraftInternal, autoSaveDelayMs),
    [saveDraftInternal, autoSaveDelayMs]
  );

  // Update answers and trigger auto-save
  const updateAnswers = useCallback(
    async (newAnswers: Record<string, any>) => {
      setCurrentAnswers(newAnswers);
      saveDraft(newAnswers);
    },
    [saveDraft]
  );

  // Submit final answers
  const submit = useCallback(
    async (answers: Record<string, any>): Promise<QuestionnaireResponse> => {
      setIsSubmitting(true);
      setSubmitError(null);

      const startTime = performance.now();

      try {
        const response = await fetch('/api/v1/health/response', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            questionnaire_id: questionnaireId,
            answers,
            is_draft: false,
          }),
        });

        if (!response.ok) {
          throw new Error(`Submission failed: ${response.statusText}`);
        }

        const result: QuestionnaireResponse = await response.json();

        // Track submission
        const duration = performance.now() - questionnaireStartTime.current;
        trackHealthQuestionnaireSubmitted(
          schema?.version || 1,
          duration,
          result.risk_band
        );

        // Invalidate SWR cache for responses
        mutate(`/api/v1/health/response/${questionnaireId}`);

        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Submission failed');
        setSubmitError(err);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [questionnaireId, schema]
  );

  // Branching logic - determine visible questions
  const visibleQuestions = useMemo(() => {
    if (!schema) return [];

    const baseQuestions = schema.questions;
    const additionalQuestions = evaluateBranchingLogic(
      schema.branching_rules,
      currentAnswers
    );

    return [...baseQuestions, ...additionalQuestions];
  }, [schema, currentAnswers]);

  // Check if specific question should be shown
  const shouldShowQuestion = useCallback(
    (questionId: string): boolean => {
      return checkQuestionVisibility(questionId, visibleQuestions);
    },
    [visibleQuestions]
  );

  // Navigation helpers
  const totalSteps = visibleQuestions.length;

  const nextStep = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      const dwellTime = performance.now() - pageStartTime.current;
      trackHealthPageTurn(schema?.version || 1, currentStep + 1, dwellTime);
      setCurrentStep(s => s + 1);
    }
  }, [currentStep, totalSteps, schema]);

  const previousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback(
    (step: number) => {
      if (step >= 0 && step < totalSteps) {
        setCurrentStep(step);
      }
    },
    [totalSteps]
  );

  // Analytics helpers
  const trackSchemaFetched = useCallback(() => {
    if (schema) {
      const latency = performance.now() - schemaFetchStartTime.current;
      trackHealthSchemaFetched(schema.version, latency);
    }
  }, [schema]);

  const trackPageTurnManual = useCallback(
    (pageNumber: number, dwellMs: number) => {
      if (schema) {
        trackHealthPageTurn(schema.version, pageNumber, dwellMs);
      }
    },
    [schema]
  );

  const trackSubmissionManual = useCallback(
    (durationMs: number) => {
      if (schema) {
        const phq9Score = calculatePHQ9Score(currentAnswers);
        const gad7Score = calculateGAD7Score(currentAnswers);
        const band = determineRiskBand(phq9Score, gad7Score);

        trackHealthQuestionnaireSubmitted(schema.version, durationMs, band);
      }
    },
    [schema, currentAnswers]
  );

  return {
    schema: schema || null,
    isLoadingSchema,
    schemaError: schemaError || null,
    draftResponse,
    currentAnswers,
    saveDraft: updateAnswers,
    submit,
    isSubmitting,
    submitError,
    currentStep,
    totalSteps,
    nextStep,
    previousStep,
    goToStep,
    visibleQuestions,
    shouldShowQuestion,
    trackSchemaFetched,
    trackPageTurn: trackPageTurnManual,
    trackSubmission: trackSubmissionManual,
  };
}
