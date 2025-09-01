'use client';

import { useCallback, useRef, useEffect } from 'react';
import { HealthQuestion, QuestionValue } from '@/types/health';
import { useCancellableRequest } from '@/lib/async-utils';

export interface NavigationConfig {
  autoAdvance: boolean;
  autoAdvanceDelay: number;
  autoAdvanceTypes: Array<HealthQuestion['type']>;
  requireConfirmation: boolean;
  animationDuration: number;
  skipValidationForOptional: boolean;
}

export interface NavigationCallbacks {
  onNext: () => void;
  onPrevious: () => void;
  onValidationError: (error: string) => void;
  onProgress: (progress: number) => void;
  onNavigationStart?: () => void;
  onNavigationComplete?: () => void;
}

const DEFAULT_CONFIG: NavigationConfig = {
  autoAdvance: true,
  autoAdvanceDelay: 1800, // Standardized 1.8 seconds for optimal UX
  autoAdvanceTypes: ['scale', 'boolean'], // Only auto-advance for these types
  requireConfirmation: false,
  animationDuration: 250, // Slightly longer for smoother transitions
  skipValidationForOptional: true
};

export function useUnifiedNavigation(
  currentQuestion: HealthQuestion | null,
  questionValue: QuestionValue,
  config: Partial<NavigationConfig> = {},
  callbacks: NavigationCallbacks
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const { makeRequest, cancelAll } = useCancellableRequest();
  const autoAdvanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigationInProgressRef = useRef(false);
  
  // CRITICAL FIX: Use ref to always get current value and avoid stale closures
  const questionValueRef = useRef<QuestionValue>(questionValue);
  useEffect(() => {
    questionValueRef.current = questionValue;
  }, [questionValue]);

  // Clear any pending auto-advance on unmount or question change
  useEffect(() => {
    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
      cancelAll();
    };
  }, [currentQuestion, cancelAll]);

  // Determine if question should auto-advance with enhanced safety checks
  const shouldAutoAdvance = useCallback((question: HealthQuestion): boolean => {
    if (!finalConfig.autoAdvance || !question) return false;
    
    // Check if question type supports auto-advance
    if (!finalConfig.autoAdvanceTypes.includes(question.type)) {
      return false;
    }

    // CRITICAL FIX 1: Don't auto-advance if value is not set (but allow valid negative responses)
    if (questionValueRef.current === null || questionValueRef.current === undefined) {
      return false;
    }
    
    // Allow empty string only for text inputs, not for select/boolean questions
    if (questionValueRef.current === '' && (question.type === 'select' || question.type === 'boolean' || question.type === 'multiselect')) {
      return false;
    }

    // For array values, ensure at least one item is selected
    if (Array.isArray(questionValueRef.current) && questionValueRef.current.length === 0) {
      return false;
    }

    // Don't auto-advance required questions without confirmation
    if (question.required && finalConfig.requireConfirmation) {
      return false;
    }

    // Don't auto-advance high-risk questions (critical safety questions)
    if (question.riskWeight && question.riskWeight >= 8) {
      return false;
    }

    // Don't auto-advance clinical validation tools unless specifically configured
    if (question.metadata?.validatedTool && !finalConfig.autoAdvanceTypes.includes('clinical')) {
      // Only auto-advance clinical tools for scale questions
      return question.type === 'scale';
    }

    return true;
  }, [finalConfig]); // Removed questionValue from deps to always use ref

  // Handle response with unified behavior and better coordination
  const handleResponse = useCallback(async (
    value: QuestionValue,
    skipAutoAdvance = false
  ) => {
    if (!currentQuestion || navigationInProgressRef.current) return;

    try {
      // Clear any pending auto-advance to prevent conflicts
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }

      // Notify callbacks that response was updated
      callbacks.onProgress?.(0); // Reset progress for new response

      // Determine if we should auto-advance (with the new value)
      const shouldAdvance = !skipAutoAdvance && shouldAutoAdvance(currentQuestion);

      if (shouldAdvance) {
        navigationInProgressRef.current = true;
        callbacks.onNavigationStart?.();
        
        // Use the cancellable request system for race condition safety
        const request = makeRequest(async (abortSignal) => {
          return new Promise<void>((resolve, reject) => {
            let remainingTime = finalConfig.autoAdvanceDelay;
            const interval = 100; // Update every 100ms for smooth progress
            
            const progressInterval = setInterval(() => {
              if (abortSignal.aborted) {
                clearInterval(progressInterval);
                reject(new Error('Navigation cancelled'));
                return;
              }
              
              remainingTime -= interval;
              const progress = ((finalConfig.autoAdvanceDelay - remainingTime) / finalConfig.autoAdvanceDelay) * 100;
              callbacks.onProgress?.(Math.min(progress, 100));
              
              if (remainingTime <= 0) {
                clearInterval(progressInterval);
                resolve();
              }
            }, interval);
            
            // Store the interval reference for cleanup
            autoAdvanceTimeoutRef.current = progressInterval as any;

            abortSignal.addEventListener('abort', () => {
              clearInterval(progressInterval);
              autoAdvanceTimeoutRef.current = null;
              reject(new Error('Navigation cancelled'));
            });
          });
        });

        await request.promise;

        if (!navigationInProgressRef.current) return; // Cancelled

        // Proceed to next question
        await handleNext();
      }
    } catch (error) {
      if (error instanceof Error && error.message !== 'Navigation cancelled') {
        console.error('Navigation error:', error);
        callbacks.onValidationError?.('Erro ao processar resposta. Tente novamente.');
      }
    } finally {
      navigationInProgressRef.current = false;
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
    }
  }, [currentQuestion, shouldAutoAdvance, finalConfig.autoAdvanceDelay, makeRequest, callbacks]);

  // Handle next navigation with validation
  const handleNext = useCallback(async () => {
    if (!currentQuestion || navigationInProgressRef.current) return;

    try {
      navigationInProgressRef.current = true;
      callbacks.onNavigationStart?.();

      // CRITICAL FIX 1: Validate current question if required (but allow valid negative responses)
      // Use ref to get current value and avoid stale closures
      const currentValue = questionValueRef.current;
      
      if (currentQuestion.required && (currentValue === null || currentValue === undefined)) {
        callbacks.onValidationError('Este campo é obrigatório');
        return;
      }
      
      // For select/boolean questions, empty string is also invalid
      if (currentQuestion.required && currentValue === '' && 
          (currentQuestion.type === 'select' || currentQuestion.type === 'boolean' || currentQuestion.type === 'multiselect')) {
        callbacks.onValidationError('Este campo é obrigatório');
        return;
      }

      // Custom validation logic
      let validationError: string | null = null;

      switch (currentQuestion.type) {
        case 'number':
          if (typeof currentValue === 'number' && currentQuestion.validation) {
            const { min, max } = currentQuestion.validation;
            if (min !== undefined && currentValue < min) {
              validationError = `Valor deve ser maior ou igual a ${min}`;
            }
            if (max !== undefined && currentValue > max) {
              validationError = `Valor deve ser menor ou igual a ${max}`;
            }
          }
          break;

        case 'text':
          if (typeof currentValue === 'string' && currentQuestion.validation?.minLength) {
            if (currentValue.length < currentQuestion.validation.minLength) {
              validationError = `Resposta deve ter pelo menos ${currentQuestion.validation.minLength} caracteres`;
            }
          }
          break;

        case 'multiselect':
          if (Array.isArray(currentValue) && currentQuestion.validation?.minItems) {
            if (currentValue.length < currentQuestion.validation.minItems) {
              validationError = `Selecione pelo menos ${currentQuestion.validation.minItems} opções`;
            }
          }
          break;
      }

      if (validationError) {
        callbacks.onValidationError(validationError);
        return;
      }

      // Proceed to next question
      callbacks.onNext();
      callbacks.onNavigationComplete?.();

    } catch (error) {
      console.error('Navigation error:', error);
      callbacks.onValidationError('Erro ao navegar. Tente novamente.');
    } finally {
      navigationInProgressRef.current = false;
    }
  }, [currentQuestion, callbacks]); // Removed questionValue to use ref

  // Handle previous navigation
  const handlePrevious = useCallback(() => {
    if (navigationInProgressRef.current) return;

    // Cancel any pending auto-advance
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }

    cancelAll();
    callbacks.onPrevious();
  }, [callbacks, cancelAll]);

  // Cancel navigation
  const cancelNavigation = useCallback(() => {
    navigationInProgressRef.current = false;
    
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    
    cancelAll();
  }, [cancelAll]);

  // Get navigation state with enhanced information and validation
  const getNavigationState = useCallback(() => {
    const willAutoAdvance = currentQuestion ? shouldAutoAdvance(currentQuestion) : false;
    // CRITICAL FIX 1: Properly detect valid values (including valid negative responses)
    // TECHNICAL EXCELLENCE: Explicitly handle all valid response types including false and 0
    let hasValue = false;
    const currentValue = questionValueRef.current;
    
    if (currentValue !== null && currentValue !== undefined) {
      // Boolean questions: both true and false are valid values
      if (currentQuestion?.type === 'boolean') {
        hasValue = typeof currentValue === 'boolean';
      }
      // Select questions: 0 is a valid value (e.g., "Nunca" in PHQ-9)
      else if (currentQuestion?.type === 'select' || currentQuestion?.type === 'scale') {
        hasValue = true; // If not null/undefined, it's valid (including 0)
      }
      // Multiselect questions: check for array
      else if (currentQuestion?.type === 'multiselect') {
        hasValue = Array.isArray(currentValue) && currentValue.length > 0;
      }
      // Text questions: empty string is invalid unless explicitly allowed
      else if (currentQuestion?.type === 'text') {
        hasValue = currentValue !== '';
      }
      // Number questions: 0 is valid
      else if (currentQuestion?.type === 'number') {
        hasValue = typeof currentValue === 'number';
      }
      // Default: any non-null/undefined value is valid
      else {
        hasValue = true;
      }
    }
    
    return {
      isNavigating: navigationInProgressRef.current,
      willAutoAdvance,
      autoAdvanceDelay: finalConfig.autoAdvanceDelay,
      hasPendingAutoAdvance: autoAdvanceTimeoutRef.current !== null,
      navigationProfile: finalConfig.autoAdvance ? 'auto' : 'manual',
      remainingAutoAdvanceTime: autoAdvanceTimeoutRef.current ? finalConfig.autoAdvanceDelay : 0,
      canNavigateNext: currentQuestion ? (
        !currentQuestion.required || hasValue
      ) : false,
      canNavigatePrevious: !navigationInProgressRef.current,
      validationRequired: currentQuestion?.required || false,
      hasResponse: hasValue,
      questionType: currentQuestion?.type,
      isHighRisk: (currentQuestion?.riskWeight || 0) >= 8
    };
  }, [currentQuestion, shouldAutoAdvance, finalConfig.autoAdvanceDelay, finalConfig.autoAdvance]); // Use ref for value

  return {
    handleResponse,
    handleNext,
    handlePrevious,
    cancelNavigation,
    getNavigationState,
    shouldAutoAdvance: shouldAutoAdvance(currentQuestion!),
    config: finalConfig
  };
}

// Navigation behavior configurations for different question flows
export const NAVIGATION_PROFILES = {
  // Conservative: Minimal auto-advance, user controls flow
  conservative: {
    autoAdvance: false,
    autoAdvanceDelay: 0,
    autoAdvanceTypes: [],
    requireConfirmation: true,
    animationDuration: 200
  } as Partial<NavigationConfig>,

  // Standard: Balanced auto-advance for simple questions - STANDARDIZED TIMING
  standard: {
    autoAdvance: true,
    autoAdvanceDelay: 1800, // Standardized across all profiles
    autoAdvanceTypes: ['boolean', 'scale'],
    requireConfirmation: false,
    animationDuration: 250
  } as Partial<NavigationConfig>,

  // Fast: Quick auto-advance for experienced users - REDUCED VARIABILITY
  fast: {
    autoAdvance: true,
    autoAdvanceDelay: 1200, // Reduced from 800 for better UX
    autoAdvanceTypes: ['boolean', 'scale', 'select'],
    requireConfirmation: false,
    animationDuration: 200
  } as Partial<NavigationConfig>,

  // Clinical: Safety-first approach for medical questionnaires - STANDARDIZED TIMING
  clinical: {
    autoAdvance: true,
    autoAdvanceDelay: 2200, // Slightly longer for critical safety
    autoAdvanceTypes: ['scale'], // Only scales auto-advance
    requireConfirmation: true,
    animationDuration: 300,
    skipValidationForOptional: false
  } as Partial<NavigationConfig>,

  // NEW: Consistent profile for health questionnaires
  health: {
    autoAdvance: true,
    autoAdvanceDelay: 1800, // Same as standard for consistency
    autoAdvanceTypes: ['boolean', 'scale'],
    requireConfirmation: false,
    animationDuration: 250,
    skipValidationForOptional: false // Always validate for health data
  } as Partial<NavigationConfig>
};