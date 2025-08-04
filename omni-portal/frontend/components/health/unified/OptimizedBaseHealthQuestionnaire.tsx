'use client';

import React, { useReducer, useCallback, useEffect, useMemo, memo } from 'react';
import { 
  useAutoSave, 
  useThrottledProgress,
  ResponseCache,
  PERFORMANCE_CONFIG 
} from '@/lib/health-questionnaire-performance';
// Simple debounce implementation
function debounce<T extends (...args: any[]) => any>(func: T, wait: number) {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Optimized version of BaseHealthQuestionnaire with performance enhancements

export interface OptimizedQuestionnaireProps {
  config: QuestionnaireConfig;
  onComplete: (responses: Record<string, any>) => void;
  onProgressUpdate?: (progress: number) => void;
}

// Response cache instance
const responseCache = new ResponseCache();

export const OptimizedBaseHealthQuestionnaire = memo(function OptimizedBaseHealthQuestionnaire({
  config,
  onComplete,
  onProgressUpdate
}: OptimizedQuestionnaireProps) {
  // Memoized initial state
  const initialState = useMemo(() => ({
    currentSectionIndex: 0,
    currentQuestionIndex: 0,
    responses: responseCache.get('responses') || {},
    validationErrors: {},
    sectionProgress: config.sections.map(() => 0),
    startTime: Date.now(),
    lastSaveTime: Date.now()
  }), [config.sections]);

  const [state, dispatch] = useReducer(questionnaireReducer, initialState);

  // Memoized progress calculation
  const progress = useMemo(() => {
    const totalQuestions = config.sections.reduce(
      (sum, section) => sum + section.questions.length, 
      0
    );
    const answeredQuestions = Object.keys(state.responses).length;
    return totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;
  }, [config.sections, state.responses]);

  // Use throttled progress updates
  useThrottledProgress(onProgressUpdate || (() => {}), progress);

  // Optimized response setter with caching
  const setResponse = useCallback((questionId: string, value: any) => {
    dispatch({ type: 'SET_RESPONSE', payload: { questionId, value } });
    
    // Update cache
    responseCache.set(questionId, value);
    responseCache.set('responses', { ...state.responses, [questionId]: value });
  }, [state.responses]);

  // Auto-save with debouncing
  const saveResponses = useCallback(async (responses: Record<string, any>) => {
    if (config.persistence?.enabled) {
      try {
        const key = config.persistence.key || 'questionnaire-state';
        localStorage.setItem(key, JSON.stringify({
          responses,
          currentSectionIndex: state.currentSectionIndex,
          currentQuestionIndex: state.currentQuestionIndex,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('Failed to save questionnaire state:', error);
      }
    }
  }, [config.persistence, state.currentSectionIndex, state.currentQuestionIndex]);

  // Use auto-save hook
  useAutoSave(
    saveResponses,
    state.responses,
    config.persistence?.autoSave ?? true
  );

  // Optimized navigation with preloading
  const navigateToQuestion = useCallback((sectionIndex: number, questionIndex: number) => {
    // Use requestAnimationFrame for smooth transitions
    requestAnimationFrame(() => {
      dispatch({
        type: 'NAVIGATE_TO_QUESTION',
        payload: { sectionIndex, questionIndex }
      });
    });
  }, []);

  // Memoized section getter
  const currentSection = useMemo(() => 
    config.sections[state.currentSectionIndex] || null,
    [config.sections, state.currentSectionIndex]
  );

  // Memoized visible questions
  const visibleQuestions = useMemo(() => {
    if (!currentSection) return [];
    
    return currentSection.questions.filter(question => {
      if (!question.conditionalOn) return true;
      
      const conditionValue = state.responses[question.conditionalOn.questionId];
      if (question.conditionalOn.values.includes('*')) {
        return conditionValue !== undefined && conditionValue !== null;
      }
      
      return question.conditionalOn.values.includes(conditionValue);
    });
  }, [currentSection, state.responses]);

  // Current question
  const currentQuestion = visibleQuestions[state.currentQuestionIndex] || null;

  // Optimized validation with memoization
  const validateQuestion = useMemo(() => 
    debounce((question: HealthQuestion, value: any): string | null => {
      if (question.required && !value) {
        return 'Este campo é obrigatório';
      }

      if (question.validation && question.type === 'number' && typeof value === 'number') {
        if (question.validation.min && value < question.validation.min) {
          return `Valor deve ser maior ou igual a ${question.validation.min}`;
        }
        if (question.validation.max && value > question.validation.max) {
          return `Valor deve ser menor ou igual a ${question.validation.max}`;
        }
      }

      return null;
    }, PERFORMANCE_CONFIG.VALIDATION_DEBOUNCE),
    []
  );

  // Optimized next question navigation
  const nextQuestion = useCallback(() => {
    if (!currentQuestion) return;

    // Skip animation frame if already at max performance
    const navigate = () => {
      if (state.currentQuestionIndex < visibleQuestions.length - 1) {
        navigateToQuestion(state.currentSectionIndex, state.currentQuestionIndex + 1);
      } else if (state.currentSectionIndex < config.sections.length - 1) {
        navigateToQuestion(state.currentSectionIndex + 1, 0);
      } else {
        // Complete questionnaire
        onComplete(state.responses);
      }
    };

    // Use immediate navigation for better perceived performance
    navigate();
  }, [
    currentQuestion,
    state.currentQuestionIndex,
    state.currentSectionIndex,
    visibleQuestions.length,
    config.sections.length,
    navigateToQuestion,
    onComplete,
    state.responses
  ]);

  // Previous question navigation
  const previousQuestion = useCallback(() => {
    if (state.currentQuestionIndex > 0) {
      navigateToQuestion(state.currentSectionIndex, state.currentQuestionIndex - 1);
    } else if (state.currentSectionIndex > 0) {
      const prevSection = config.sections[state.currentSectionIndex - 1];
      const prevQuestions = prevSection.questions.length;
      navigateToQuestion(state.currentSectionIndex - 1, prevQuestions - 1);
    }
  }, [
    state.currentQuestionIndex,
    state.currentSectionIndex,
    config.sections,
    navigateToQuestion
  ]);

  // Clean up cache on unmount
  useEffect(() => {
    return () => {
      // Keep some responses in cache for session persistence
      if (responseCache.size > PERFORMANCE_CONFIG.MAX_CACHED_RESPONSES / 2) {
        responseCache.clear();
      }
    };
  }, []);

  // Render optimized features
  return (
    <QuestionnaireProvider
      value={{
        state,
        currentSection,
        currentQuestion,
        visibleQuestions,
        setResponse,
        validateQuestion,
        nextQuestion,
        previousQuestion,
        calculateProgress: () => progress
      }}
    >
      <div className="optimized-questionnaire">
        {config.features
          .filter(feature => feature.enabled)
          .sort((a, b) => (b.priority || 0) - (a.priority || 0))
          .map(feature => (
            <feature.component
              key={feature.id}
              config={feature.config}
              onProgressUpdate={onProgressUpdate}
            />
          ))}
      </div>
    </QuestionnaireProvider>
  );
});

// Optimized reducer with minimal state updates
function questionnaireReducer(state: any, action: any) {
  switch (action.type) {
    case 'SET_RESPONSE':
      // Only update if value actually changed
      if (state.responses[action.payload.questionId] === action.payload.value) {
        return state;
      }
      return {
        ...state,
        responses: {
          ...state.responses,
          [action.payload.questionId]: action.payload.value
        },
        lastSaveTime: Date.now()
      };
      
    case 'NAVIGATE_TO_QUESTION':
      // Only update if navigation actually changed
      if (
        state.currentSectionIndex === action.payload.sectionIndex &&
        state.currentQuestionIndex === action.payload.questionIndex
      ) {
        return state;
      }
      return {
        ...state,
        currentSectionIndex: action.payload.sectionIndex,
        currentQuestionIndex: action.payload.questionIndex
      };
      
    default:
      return state;
  }
}

// Context provider (imported from original)
import { QuestionnaireProvider, QuestionnaireConfig, HealthQuestion } from './BaseHealthQuestionnaire';