'use client';

import React, { 
  createContext, 
  useContext, 
  useReducer, 
  useCallback, 
  useMemo,
  useEffect,
  ReactNode,
  ComponentType
} from 'react';
import { HealthQuestion, HealthSection, QuestionValue } from '@/types/health';
import { HealthQuestionnaireErrorBoundary } from '../ErrorBoundary';

// Core Types
export interface QuestionnaireState {
  currentSectionIndex: number;
  currentQuestionIndex: number;
  responses: Record<string, QuestionValue>;
  sectionProgress: Record<string, number>;
  validationErrors: Record<string, string>;
  metadata: Record<string, any>;
  flowState: 'intro' | 'screening' | 'deep_dive' | 'validation' | 'complete';
  isLoading: boolean;
  error: string | null;
}

export interface QuestionnaireConfig {
  sections: HealthSection[];
  features: QuestionnaireFeature[];
  theme?: QuestionnaireTheme;
  validation?: ValidationConfig;
  persistence?: PersistenceConfig;
  analytics?: AnalyticsConfig;
}

export interface QuestionnaireFeature {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  component?: ComponentType<any>;
  hooks?: FeatureHooks;
  config?: Record<string, any>;
}

export interface FeatureHooks {
  onInit?: (state: QuestionnaireState) => void;
  onQuestionChange?: (question: HealthQuestion, state: QuestionnaireState) => void;
  onResponseSubmit?: (questionId: string, value: QuestionValue, state: QuestionnaireState) => QuestionValue | null;
  onSectionComplete?: (sectionId: string, state: QuestionnaireState) => void;
  onComplete?: (state: QuestionnaireState) => void;
  validateResponse?: (question: HealthQuestion, value: QuestionValue) => string | null;
  transformQuestion?: (question: HealthQuestion, state: QuestionnaireState) => HealthQuestion;
}

export interface QuestionnaireTheme {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  borderRadius: string;
  animationDuration: string;
}

export interface ValidationConfig {
  mode: 'immediate' | 'on-blur' | 'on-submit';
  showErrors: boolean;
  customValidators?: Record<string, (value: QuestionValue) => string | null>;
}

export interface PersistenceConfig {
  enabled: boolean;
  key: string;
  storage: 'local' | 'session' | 'memory';
  autoSave: boolean;
  saveInterval?: number;
}

export interface AnalyticsConfig {
  enabled: boolean;
  trackEvents: boolean;
  trackTiming: boolean;
  customEvents?: Record<string, (data: any) => void>;
}

// Actions
type QuestionnaireAction = 
  | { type: 'SET_SECTION'; payload: number }
  | { type: 'SET_QUESTION'; payload: number }
  | { type: 'SET_RESPONSE'; payload: { questionId: string; value: QuestionValue } }
  | { type: 'SET_VALIDATION_ERROR'; payload: { questionId: string; error: string | null } }
  | { type: 'SET_SECTION_PROGRESS'; payload: { sectionId: string; progress: number } }
  | { type: 'SET_METADATA'; payload: { key: string; value: any } }
  | { type: 'SET_FLOW_STATE'; payload: QuestionnaireState['flowState'] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };

// Reducer
const questionnaireReducer = (
  state: QuestionnaireState,
  action: QuestionnaireAction
): QuestionnaireState => {
  switch (action.type) {
    case 'SET_SECTION':
      return { ...state, currentSectionIndex: action.payload };
    case 'SET_QUESTION':
      return { ...state, currentQuestionIndex: action.payload };
    case 'SET_RESPONSE':
      return {
        ...state,
        responses: {
          ...state.responses,
          [action.payload.questionId]: action.payload.value
        }
      };
    case 'SET_VALIDATION_ERROR':
      if (action.payload.error === null) {
        const { [action.payload.questionId]: _, ...rest } = state.validationErrors;
        return { ...state, validationErrors: rest };
      }
      return {
        ...state,
        validationErrors: {
          ...state.validationErrors,
          [action.payload.questionId]: action.payload.error
        }
      };
    case 'SET_SECTION_PROGRESS':
      return {
        ...state,
        sectionProgress: {
          ...state.sectionProgress,
          [action.payload.sectionId]: action.payload.progress
        }
      };
    case 'SET_METADATA':
      return {
        ...state,
        metadata: {
          ...state.metadata,
          [action.payload.key]: action.payload.value
        }
      };
    case 'SET_FLOW_STATE':
      return { ...state, flowState: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
};

// Initial State
const initialState: QuestionnaireState = {
  currentSectionIndex: 0,
  currentQuestionIndex: 0,
  responses: {},
  sectionProgress: {},
  validationErrors: {},
  metadata: {},
  flowState: 'intro',
  isLoading: false,
  error: null
};

// Context
interface QuestionnaireContextValue {
  state: QuestionnaireState;
  dispatch: React.Dispatch<QuestionnaireAction>;
  config: QuestionnaireConfig;
  // Helper methods
  setResponse: (questionId: string, value: QuestionValue) => void;
  validateQuestion: (question: HealthQuestion, value: QuestionValue) => string | null;
  nextQuestion: () => void;
  previousQuestion: () => void;
  getCurrentSection: () => HealthSection | null;
  getCurrentQuestion: () => HealthQuestion | null;
  getVisibleQuestions: () => HealthQuestion[];
  calculateProgress: () => number;
}

const QuestionnaireContext = createContext<QuestionnaireContextValue | null>(null);

export const useQuestionnaire = () => {
  const context = useContext(QuestionnaireContext);
  if (!context) {
    throw new Error('useQuestionnaire must be used within QuestionnaireProvider');
  }
  return context;
};

// Provider Component
interface QuestionnaireProviderProps {
  config: QuestionnaireConfig;
  onComplete: (data: any) => void;
  children: ReactNode;
}

export function QuestionnaireProvider({ 
  config, 
  onComplete, 
  children 
}: QuestionnaireProviderProps) {
  const [state, dispatch] = useReducer(questionnaireReducer, initialState);

  // Initialize features
  useEffect(() => {
    config.features
      .filter(f => f.enabled)
      .sort((a, b) => b.priority - a.priority)
      .forEach(feature => {
        feature.hooks?.onInit?.(state);
      });
  }, []);

  // Auto-save with persistence
  useEffect(() => {
    if (config.persistence?.enabled && config.persistence.autoSave) {
      const saveInterval = setInterval(() => {
        saveState(state);
      }, config.persistence.saveInterval || 30000);
      return () => clearInterval(saveInterval);
    }
  }, [state, config.persistence]);

  // Save state helper
  const saveState = useCallback((state: QuestionnaireState) => {
    if (!config.persistence?.enabled) return;
    
    const key = config.persistence.key || 'questionnaire-state';
    const data = JSON.stringify(state);
    
    switch (config.persistence.storage) {
      case 'local':
        localStorage.setItem(key, data);
        break;
      case 'session':
        sessionStorage.setItem(key, data);
        break;
      case 'memory':
        // In-memory storage would be handled by a separate service
        break;
    }
  }, [config.persistence]);

  // Get current section
  const getCurrentSection = useCallback(() => {
    return config.sections[state.currentSectionIndex] || null;
  }, [config.sections, state.currentSectionIndex]);

  // Get visible questions based on conditions with enhanced logic
  const getVisibleQuestions = useCallback(() => {
    const section = getCurrentSection();
    if (!section) return [];

    return section.questions.filter(question => {
      if (!question.conditionalOn) return true;
      
      const conditionValue = state.responses[question.conditionalOn.questionId];
      
      // Handle wildcard conditions
      if (question.conditionalOn.values.includes('*')) {
        return conditionValue !== undefined && conditionValue !== null && conditionValue !== '';
      }
      
      // Handle array values (for multiselect conditions)
      if (Array.isArray(conditionValue)) {
        return question.conditionalOn.values.some(val => conditionValue.includes(val));
      }
      
      // Handle exact value matching with type coercion
      return question.conditionalOn.values.some(val => {
        // Handle string/number type matching
        if (typeof val === 'string' && typeof conditionValue === 'number') {
          return val === String(conditionValue);
        }
        if (typeof val === 'number' && typeof conditionValue === 'string') {
          return String(val) === conditionValue;
        }
        return val === conditionValue;
      });
    });
  }, [getCurrentSection, state.responses]);

  // Get current question with bounds checking
  const getCurrentQuestion = useCallback(() => {
    const visibleQuestions = getVisibleQuestions();
    
    // Handle index out of bounds
    if (state.currentQuestionIndex >= visibleQuestions.length) {
      // If we're past the end, we've completed this section
      return null;
    }
    
    if (state.currentQuestionIndex < 0) {
      // If we're before the start, go to first question
      return visibleQuestions[0] || null;
    }
    
    return visibleQuestions[state.currentQuestionIndex] || null;
  }, [getVisibleQuestions, state.currentQuestionIndex]);

  // Validate question with feature hooks
  const validateQuestion = useCallback((
    question: HealthQuestion, 
    value: QuestionValue
  ): string | null => {
    // Built-in validation with explicit null/undefined checking
    // TECHNICAL EXCELLENCE FIX: Never use implicit boolean conversion on numeric values
    // because !0 === true, which would incorrectly invalidate legitimate zero responses
    if (question.required) {
      // Type-aware validation - check for actual emptiness, not falsy values
      if (value === null || value === undefined) {
        return 'Este campo é obrigatório';
      }
      
      // For string values, check for empty strings (but allow '0' as valid)
      if (typeof value === 'string' && value.trim() === '') {
        return 'Este campo é obrigatório';
      }
      
      // For array values (multiselect), check for empty arrays
      if (Array.isArray(value) && value.length === 0) {
        return 'Este campo é obrigatório';
      }
    }

    if (question.validation) {
      if (question.type === 'number' && typeof value === 'number') {
        if (question.validation.min && value < question.validation.min) {
          return `Valor deve ser maior ou igual a ${question.validation.min}`;
        }
        if (question.validation.max && value > question.validation.max) {
          return `Valor deve ser menor ou igual a ${question.validation.max}`;
        }
      }
    }

    // Custom validators from config
    if (config.validation?.customValidators?.[question.id]) {
      const customError = config.validation.customValidators[question.id](value);
      if (customError) return customError;
    }

    // Feature validation hooks
    for (const feature of config.features.filter(f => f.enabled)) {
      if (feature.hooks?.validateResponse) {
        const error = feature.hooks.validateResponse(question, value);
        if (error) return error;
      }
    }

    return null;
  }, [config]);

  // Set response with feature hooks
  const setResponse = useCallback((questionId: string, value: QuestionValue) => {
    const question = getCurrentQuestion();
    if (!question || question.id !== questionId) return;

    // Run feature hooks before setting response
    let processedValue = value;
    for (const feature of config.features.filter(f => f.enabled)) {
      if (feature.hooks?.onResponseSubmit) {
        const result = feature.hooks.onResponseSubmit(questionId, processedValue, state);
        if (result !== null) processedValue = result;
      }
    }

    dispatch({ type: 'SET_RESPONSE', payload: { questionId, value: processedValue } });

    // Validate if configured for immediate validation
    if (config.validation?.mode === 'immediate') {
      const error = validateQuestion(question, processedValue);
      dispatch({ 
        type: 'SET_VALIDATION_ERROR', 
        payload: { questionId, error } 
      });
    }
  }, [getCurrentQuestion, config, state, validateQuestion]);

  // Navigation helpers with enhanced bounds checking
  const nextQuestion = useCallback(() => {
    const visibleQuestions = getVisibleQuestions();
    const currentQuestion = getCurrentQuestion();
    
    // Handle case where visible questions changed and index is out of bounds
    if (state.currentQuestionIndex >= visibleQuestions.length) {
      // We've completed the section, proceed to next section
      const section = getCurrentSection();
      if (section) {
        dispatch({ 
          type: 'SET_SECTION_PROGRESS', 
          payload: { sectionId: section.id, progress: 100 } 
        });

        // Run section complete hooks
        config.features
          .filter(f => f.enabled)
          .forEach(feature => {
            feature.hooks?.onSectionComplete?.(section.id, state);
          });

        // Move to next section or complete
        if (state.currentSectionIndex < config.sections.length - 1) {
          dispatch({ type: 'SET_SECTION', payload: state.currentSectionIndex + 1 });
          dispatch({ type: 'SET_QUESTION', payload: 0 });
        } else {
          dispatch({ type: 'SET_FLOW_STATE', payload: 'complete' });
          
          // Run complete hooks
          config.features
            .filter(f => f.enabled)
            .forEach(feature => {
              feature.hooks?.onComplete?.(state);
            });

          // Call parent onComplete
          onComplete({
            responses: state.responses,
            metadata: state.metadata,
            timestamp: new Date().toISOString()
          });
        }
      }
      return;
    }
    
    if (!currentQuestion) return;

    // Clear any existing validation errors for current question
    dispatch({ 
      type: 'SET_VALIDATION_ERROR', 
      payload: { questionId: currentQuestion.id, error: null } 
    });

    // Validate current question
    const error = validateQuestion(currentQuestion, state.responses[currentQuestion.id]);
    if (error) {
      dispatch({ 
        type: 'SET_VALIDATION_ERROR', 
        payload: { questionId: currentQuestion.id, error } 
      });
      return;
    }

    if (state.currentQuestionIndex < visibleQuestions.length - 1) {
      dispatch({ type: 'SET_QUESTION', payload: state.currentQuestionIndex + 1 });
    } else {
      // Complete section
      const section = getCurrentSection();
      if (section) {
        dispatch({ 
          type: 'SET_SECTION_PROGRESS', 
          payload: { sectionId: section.id, progress: 100 } 
        });

        // Run section complete hooks
        config.features
          .filter(f => f.enabled)
          .forEach(feature => {
            feature.hooks?.onSectionComplete?.(section.id, state);
          });

        // Move to next section or complete
        if (state.currentSectionIndex < config.sections.length - 1) {
          dispatch({ type: 'SET_SECTION', payload: state.currentSectionIndex + 1 });
          dispatch({ type: 'SET_QUESTION', payload: 0 });
        } else {
          dispatch({ type: 'SET_FLOW_STATE', payload: 'complete' });
          
          // Run complete hooks
          config.features
            .filter(f => f.enabled)
            .forEach(feature => {
              feature.hooks?.onComplete?.(state);
            });

          // Call parent onComplete
          onComplete({
            responses: state.responses,
            metadata: state.metadata,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }, [
    getVisibleQuestions, 
    getCurrentQuestion, 
    getCurrentSection,
    validateQuestion, 
    state, 
    config,
    onComplete
  ]);

  const previousQuestion = useCallback(() => {
    if (state.currentQuestionIndex > 0) {
      dispatch({ type: 'SET_QUESTION', payload: state.currentQuestionIndex - 1 });
    } else if (state.currentSectionIndex > 0) {
      dispatch({ type: 'SET_SECTION', payload: state.currentSectionIndex - 1 });
      
      // Set to last visible question of previous section (not just last question)
      const prevSectionIndex = state.currentSectionIndex - 1;
      const prevSection = config.sections[prevSectionIndex];
      if (prevSection) {
        // We need to calculate visible questions for the previous section
        // For now, use the total questions count as an approximation
        // This could be improved by calculating visible questions for previous section
        const lastQuestionIndex = Math.max(0, prevSection.questions.length - 1);
        dispatch({ type: 'SET_QUESTION', payload: lastQuestionIndex });
      }
    }
    
    // Clear any validation errors when going back
    const currentQuestion = getCurrentQuestion();
    if (currentQuestion) {
      dispatch({ 
        type: 'SET_VALIDATION_ERROR', 
        payload: { questionId: currentQuestion.id, error: null } 
      });
    }
  }, [state, config.sections, getCurrentQuestion]);

  // Calculate overall progress
  const calculateProgress = useCallback(() => {
    const totalSections = config.sections.length;
    
    if (totalSections === 0) return 0;

    // Count total questions across all sections
    let totalQuestions = 0;
    let completedQuestions = 0;
    
    // Count questions from all sections
    for (let i = 0; i < totalSections; i++) {
      const section = config.sections[i];
      if (section) {
        totalQuestions += section.questions.length;
        
        // Count completed questions from previous sections
        if (i < state.currentSectionIndex) {
          completedQuestions += section.questions.length;
        }
        // Count completed questions in current section
        else if (i === state.currentSectionIndex) {
          completedQuestions += state.currentQuestionIndex;
        }
      }
    }

    if (totalQuestions === 0) return 0;

    // Calculate progress as percentage of total questions
    const progress = (completedQuestions / totalQuestions) * 100;
    return Math.round(Math.min(progress, 100));
  }, [config.sections, state]);

  const contextValue: QuestionnaireContextValue = {
    state,
    dispatch,
    config,
    setResponse,
    validateQuestion,
    nextQuestion,
    previousQuestion,
    getCurrentSection,
    getCurrentQuestion,
    getVisibleQuestions,
    calculateProgress
  };

  return (
    <QuestionnaireContext.Provider value={contextValue}>
      {children}
    </QuestionnaireContext.Provider>
  );
}

// Base Questionnaire Component
export function BaseHealthQuestionnaire({ 
  config, 
  onComplete,
  onProgressUpdate
}: {
  config: QuestionnaireConfig;
  onComplete: (data: any) => void;
  onProgressUpdate?: (progress: number) => void;
}) {
  return (
    <HealthQuestionnaireErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Health questionnaire error:', error);
        // Could also send to error tracking service here
      }}
      resetKeys={[config]}
    >
      <QuestionnaireProvider config={config} onComplete={onComplete}>
        <div className="health-questionnaire">
          {/* Feature components will be rendered here */}
          {config.features
            .filter(f => f.enabled && f.component)
            .sort((a, b) => b.priority - a.priority)
            .map(feature => {
              const Component = feature.component!;
              return <Component key={feature.id} {...feature.config} onProgressUpdate={onProgressUpdate} />;
            })}
        </div>
      </QuestionnaireProvider>
    </HealthQuestionnaireErrorBoundary>
  );
}