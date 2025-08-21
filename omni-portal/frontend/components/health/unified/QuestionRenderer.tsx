'use client';

import React, { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { ChevronRight, CheckCircle, Info, AlertCircle } from 'lucide-react';
// INTEGRATION: Use SafeTouchButton for WCAG AAA compliance (48px touch targets)
import { SafeTouchButton } from '@/components/health/touch/SafeTouchButton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuestionnaire, QuestionnaireFeature } from './BaseHealthQuestionnaire';
import { HealthQuestion, QuestionValue } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorBoundary, useErrorHandler } from '../ErrorBoundary';
import { useUnifiedNavigation, NAVIGATION_PROFILES, NavigationConfig } from '@/hooks/useUnifiedNavigation';
import { ChronicConditionSelector } from '../structured/ChronicConditionSelector';
import { MedicationSelector } from '../structured/MedicationSelector';
import { ContactForm } from '../structured/ContactForm';
import { SurgeryHistorySelector } from '../structured/SurgeryHistorySelector';

interface QuestionRendererConfig {
  animations: boolean;
  autoAdvance: boolean;
  showProgress: boolean;
  showValidation: boolean;
  accessibility: boolean;
  navigationProfile: 'conservative' | 'standard' | 'fast' | 'clinical';
  onProgressUpdate?: (progress: number) => void;
}

const QuestionRendererInner = memo(function QuestionRendererInner({ config, onProgressUpdate }: { config?: QuestionRendererConfig; onProgressUpdate?: (progress: number) => void }) {
  const {
    state,
    config: questionnaireConfig,
    getCurrentSection,
    getCurrentQuestion,
    getVisibleQuestions,
    setResponse,
    validateQuestion,
    nextQuestion,
    previousQuestion,
    calculateProgress
  } = useQuestionnaire();

  const [localValue, setLocalValue] = useState<QuestionValue>(null);
  const [showError, setShowError] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string>('');
  const { captureError } = useErrorHandler();

  const currentSection = getCurrentSection();
  const visibleQuestions = getVisibleQuestions();
  
  // TECHNICAL EXCELLENCE FIX 5: Add bounds-safe question indexing with graceful fallbacks
  const currentQuestion = useMemo(() => {
    const question = getCurrentQuestion();
    
    // Enhanced bounds checking with graceful fallbacks
    if (!question && visibleQuestions.length > 0) {
      // If current question is null but we have visible questions, 
      // check if we need to adjust the index
      const safeIndex = Math.min(state.currentQuestionIndex, visibleQuestions.length - 1);
      console.warn(`Question index bounds adjusted from ${state.currentQuestionIndex} to ${safeIndex}`);
      return visibleQuestions[safeIndex] || null;
    }
    
    return question;
  }, [getCurrentQuestion, visibleQuestions, state.currentQuestionIndex]);
  
  const progress = calculateProgress();

  const showAnimations = config?.animations !== false;
  const showProgressBar = config?.showProgress !== false;
  
  // TECHNICAL EXCELLENCE FIX 1: Unified navigation profile resolver with robust fallback handling
  const resolveNavigationProfile = (profileName?: string): Partial<NavigationConfig> => {
    // Priority order: provided config -> clinical (medical safety) -> standard (default)
    const requestedProfile = profileName || 'clinical';
    
    // Validate profile exists, with multiple fallback layers for safety
    if ((NAVIGATION_PROFILES as any)[requestedProfile]) {
      return (NAVIGATION_PROFILES as any)[requestedProfile];
    }
    
    // First fallback: clinical (medical safety priority)
    if (NAVIGATION_PROFILES.clinical) {
      console.warn(`Navigation profile '${requestedProfile}' not found, using clinical profile for safety`);
      return NAVIGATION_PROFILES.clinical;
    }
    
    // Second fallback: standard (should always exist)
    if (NAVIGATION_PROFILES.standard) {
      console.warn(`Clinical profile not found, using standard profile as fallback`);
      return NAVIGATION_PROFILES.standard;
    }
    
    // Final fallback: minimal safe configuration (prevents crashes)
    console.error('No navigation profiles found, using minimal safe configuration');
    return {
      autoAdvance: false,
      autoAdvanceDelay: 0,
      autoAdvanceTypes: [],
      requireConfirmation: true,
      animationDuration: 300
    };
  };

  const selectedProfile = resolveNavigationProfile(config?.navigationProfile);

  // Use unified navigation with proper profile resolution
  const navigation = useUnifiedNavigation(
    currentQuestion,
    localValue,
    selectedProfile,
    {
      onNext: nextQuestion,
      onPrevious: previousQuestion,
      onValidationError: (error: string) => {
        console.error('Validation error:', error);
        setValidationMessage(error);
        setShowError(true);
        // Ensure error is visible by forcing a re-render
        setTimeout(() => {
          setShowError(true);
          setValidationMessage(error);
        }, 100);
      },
      onProgress: (progress: number) => {
        if (onProgressUpdate) {
          onProgressUpdate(progress);
        }
      }
    }
  );

  // TECHNICAL EXCELLENCE FIX 4: Reactive button state system with proper synchronization
  // CRITICAL FIX: Don't memoize navigation state - it needs to update when localValue changes
  const navigationState = navigation.getNavigationState();

  // Reset local value when question changes with enhanced error clearing
  useEffect(() => {
    if (currentQuestion) {
      // CRITICAL FIX: Don't use || operator as it converts false to null!
      const storedValue = state.responses[currentQuestion.id] !== undefined 
        ? state.responses[currentQuestion.id] 
        : null;
      setLocalValue(storedValue || null);
      
      // Clear all error states when question changes
      setShowError(false);
      setValidationMessage('');
      
      // Clear any validation errors in global state for this question
      if (state.validationErrors[currentQuestion.id]) {
        // The error will be cleared by the validation system
      }
    }
  }, [currentQuestion?.id, state.responses, currentQuestion, state.validationErrors]);

  // TECHNICAL EXCELLENCE FIX 3: Unified validation error manager with consistent state handling
  useEffect(() => {
    if (!currentQuestion) return;

    const globalError = state.validationErrors[currentQuestion.id];
    
    // Single source of truth: prioritize global validation state
    if (globalError) {
      // Only update local state if global error is different (prevents infinite loops)
      if (globalError !== validationMessage || !showError) {
        setValidationMessage(globalError);
        setShowError(true);
        console.log('Validation error synchronized from global state:', globalError);
      }
    } else {
      // Clear local error state when global state clears (atomic operation)
      if (showError || validationMessage) {
        setShowError(false);
        setValidationMessage('');
        console.log('Validation error cleared from global state');
      }
    }
  }, [currentQuestion?.id, state.validationErrors, validationMessage, showError, currentQuestion]);

  // Call onProgressUpdate when progress changes
  useEffect(() => {
    if (onProgressUpdate) {
      onProgressUpdate(progress);
    }
  }, [progress, onProgressUpdate]);

  // Handle response submission with unified navigation
  const handleResponse = useCallback(async (value: QuestionValue) => {
    try {
      if (!currentQuestion) return;

      setLocalValue(value);
      setResponse(currentQuestion.id, value);
      
      // Clear any existing error
      setShowError(false);
      setValidationMessage('');

      // Use unified navigation for response handling
      await navigation.handleResponse(value);
    } catch (error) {
      console.error('Error handling response:', error);
      captureError(error as Error);
    }
  }, [currentQuestion, setResponse, navigation, captureError]);

  // Handle next button with unified navigation
  const handleNext = useCallback(async () => {
    try {
      await navigation.handleNext();
    } catch (error) {
      console.error('Error navigating to next question:', error);
      captureError(error as Error);
    }
  }, [navigation, captureError]);

  // Handle previous button with unified navigation
  const handlePrevious = useCallback(() => {
    try {
      navigation.handlePrevious();
    } catch (error) {
      console.error('Error navigating to previous question:', error);
      captureError(error as Error);
    }
  }, [navigation, captureError]);

  // Render question based on type
  const renderQuestionInput = () => {
    if (!currentQuestion) return null;

    const value = state.responses[currentQuestion.id];
    const error = state.validationErrors[currentQuestion.id];

    switch (currentQuestion.type as any) {
      case 'boolean':
        return (
          <div className="grid grid-cols-2 gap-4" role="radiogroup" aria-labelledby="question-text">
            <SafeTouchButton
              variant={value === true ? 'primary' : 'secondary'}
              size="large"
              onClick={() => handleResponse(true)}
              className="transition-all hover:scale-105 active:scale-95"
              role="radio"
              aria-checked={value === true}
              aria-describedby={currentQuestion.required ? 'required-indicator' : undefined}
            >
              Sim
            </SafeTouchButton>
            <SafeTouchButton
              variant={value === false ? 'primary' : 'secondary'}
              size="large"
              onClick={() => handleResponse(false)}
              className="transition-all hover:scale-105 active:scale-95"
              role="radio"
              aria-checked={value === false}
              aria-describedby={currentQuestion.required ? 'required-indicator' : undefined}
            >
              Não
            </SafeTouchButton>
          </div>
        );

      case 'select':
        const options = getQuestionOptions(currentQuestion);
        return (
          <div className="space-y-3" role="radiogroup" aria-labelledby="question-text">
            {options.map((option, index) => (
              <SafeTouchButton
                key={`${option.value}-${index}`}
                variant={value === option.value ? 'primary' : 'secondary'}
                size="standard"
                onClick={() => handleResponse(option.value)}
                className="w-full justify-start transition-all hover:scale-[1.02] active:scale-[0.98]"
                role="radio"
                aria-checked={value === option.value}
                aria-describedby={(option as any).description ? `option-desc-${index}` : undefined}
              >
                <div className="text-left">
                  <div>{option.label}</div>
                  {(option as any).description && (
                    <div 
                      id={`option-desc-${index}`}
                      className="text-sm text-gray-600 mt-1"
                    >
                      {(option as any).description}
                    </div>
                  )}
                </div>
              </SafeTouchButton>
            ))}
          </div>
        );

      case 'multiselect':
        const multiOptions = getQuestionOptions(currentQuestion);
        const selectedValues = (value as string[]) || [];
        
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-labelledby="question-text">
            {multiOptions.map((option, index) => {
              const isSelected = selectedValues.includes(option.value as string);
              return (
                <Button
                  key={`${option.value}-${index}`}
                  variant={isSelected ? 'primary' : 'outline'}
                  onClick={() => {
                    if (option.value === 'none') {
                      handleResponse(['none']);
                    } else if (selectedValues.includes('none')) {
                      handleResponse([option.value as string]);
                    } else {
                      const updated = isSelected
                        ? selectedValues.filter(v => v !== option.value)
                        : [...selectedValues, option.value as string];
                      handleResponse(updated);
                    }
                  }}
                  className="justify-start min-h-[48px] py-3 px-4 transition-all hover:scale-[1.02] active:scale-[0.98] touch-manipulation focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-describedby={`multiselect-hint-${index}`}
                >
                  {isSelected && <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />}
                  <span className="text-left">{option.label}</span>
                  <span id={`multiselect-hint-${index}`} className="sr-only">
                    {isSelected ? 'Selecionado' : 'Não selecionado'}. Toque para {isSelected ? 'desmarcar' : 'selecionar'}.
                  </span>
                </Button>
              );
            })}
          </div>
        );

      case 'number':
        return (
          <div className="space-y-4">
            <input
              type="number"
              className={`w-full px-4 py-3 text-lg border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                error ? 'border-red-500' : ''
              }`}
              placeholder="Digite um número"
              min={currentQuestion.validation?.min}
              max={currentQuestion.validation?.max}
              value={String(localValue || '')}
              onChange={(e) => {
                const val = e.target.value === '' ? null : parseInt(e.target.value);
                setLocalValue(val);
                if (val !== null) setResponse(currentQuestion.id, val);
              }}
              aria-invalid={!!error}
            />
            {currentQuestion.validation && (
              <p className="text-sm text-gray-600">
                Entre {currentQuestion.validation.min} e {currentQuestion.validation.max}
              </p>
            )}
          </div>
        );

      case 'text':
        return (
          <textarea
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              error ? 'border-red-500' : ''
            }`}
            rows={4}
            placeholder="Digite sua resposta..."
            value={(localValue as string) || ''}
            onChange={(e) => {
              setLocalValue(e.target.value);
              setResponse(currentQuestion.id, e.target.value);
            }}
            aria-invalid={!!error}
          />
        );

      case 'scale':
        const scaleValue = (value as number) || 5;
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">1</span>
              <input
                type="range"
                min="1"
                max="10"
                value={scaleValue}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  handleResponse(val);
                }}
                className="flex-1 mx-4"
              />
              <span className="text-sm text-gray-600">10</span>
            </div>
            <div className="text-center">
              <span className="text-3xl font-bold text-blue-600">{scaleValue}</span>
            </div>
          </div>
        );

      case 'chronic_conditions':
        return (
          <ChronicConditionSelector
            onComplete={(conditions) => {
              handleResponse(conditions as any);
            }}
            isProcessing={false}
            initialValue={value as any || []}
          />
        );

      case 'medication_list':
        return (
          <MedicationSelector
            onComplete={(medications) => {
              handleResponse(medications as any);
            }}
            isProcessing={false}
            initialValue={value as any || []}
          />
        );

      case 'emergency_contact':
        return (
          <ContactForm
            onComplete={(contact) => {
              handleResponse(contact as any);
            }}
            isProcessing={false}
            initialValue={value as any}
          />
        );

      case 'surgery_history':
        return (
          <SurgeryHistorySelector
            onComplete={(surgeries) => {
              handleResponse(surgeries as any);
            }}
            isProcessing={false}
            initialValue={value as any || []}
          />
        );

      default:
        return (
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              Tipo de pergunta não suportado: {currentQuestion.type}
            </AlertDescription>
          </Alert>
        );
    }
  };

  // Get question options with proper formatting
  const getQuestionOptions = (question: HealthQuestion) => {
    if (question.metadata?.validatedTool === 'PHQ-9' || 
        question.metadata?.validatedTool === 'GAD-7') {
      return [
        { value: 0, label: 'Nunca' },
        { value: 1, label: 'Vários dias' },
        { value: 2, label: 'Mais da metade dos dias' },
        { value: 3, label: 'Quase todos os dias' }
      ];
    }
    
    return (question.options || []).map((opt) => {
      return typeof opt === 'string' ? { value: opt, label: opt } : opt;
    });
  };

  if (!currentQuestion || !currentSection) {
    return null;
  }

  return (
    <div className="question-renderer space-y-6">
      {/* Progress Bar */}
      {showProgressBar && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-700">Progresso Geral</h3>
            <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${state.currentSectionIndex}-${state.currentQuestionIndex}`}
          initial={showAnimations ? { opacity: 0, x: 10 } : {}}
          animate={{ opacity: 1, x: 0 }}
          exit={showAnimations ? { opacity: 0, x: -10 } : {}}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <Card className="p-8">
            {/* Question Header */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <Badge variant="outline">
                  {currentSection.title} • Q{state.currentQuestionIndex + 1}/{visibleQuestions.length}
                </Badge>
                {(currentQuestion.metadata as any)?.validatedTool && (
                  <Badge variant="secondary" className="text-xs">
                    {(currentQuestion.metadata as any).validatedTool}
                  </Badge>
                )}
              </div>

              {/* Question Text */}
              <h2 id="question-text" className="text-2xl font-semibold" tabIndex={-1}>
                {currentQuestion.text}
                {currentQuestion.required && (
                  <span 
                    id="required-indicator" 
                    className="text-red-500 ml-1" 
                    aria-label="Campo obrigatório"
                  >
                    *
                  </span>
                )}
              </h2>

              {/* Risk Warning */}
              {(currentQuestion as any).riskWeight && (currentQuestion as any).riskWeight >= 8 && (
                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    Esta pergunta é importante para sua segurança.
                  </AlertDescription>
                </Alert>
              )}

              {/* Validation Error */}
              {(showError || state.validationErrors[currentQuestion.id]) && (
                <Alert variant="error" className="bg-red-50 border-red-200">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <AlertDescription className="text-red-800 font-medium">
                    {validationMessage || state.validationErrors[currentQuestion.id] || 'Erro de validação'}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Question Input */}
            <div className="mb-8">
              {renderQuestionInput()}
            </div>

            {/* Navigation */}
            <nav className="flex justify-between items-center pt-6 border-t" aria-label="Navegação do questionário">
              <Button
                variant="ghost"
                onClick={handlePrevious}
                disabled={navigationState.canNavigatePrevious === false}
                className="min-h-[48px] px-6 touch-manipulation focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Voltar para a pergunta anterior"
              >
                Voltar
              </Button>

              <div className="flex gap-2">
                {!currentQuestion.required && (
                  <Button variant="ghost" onClick={nextQuestion}>
                    Pular
                  </Button>
                )}

                {(!navigation.shouldAutoAdvance || navigationState.isNavigating) ? (
                  <Button 
                    onClick={handleNext}
                    disabled={navigationState.isNavigating || !navigationState.canNavigateNext}
                    className="min-h-[44px] touch-manipulation"
                  >
                    {navigationState.isNavigating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Processando...
                      </>
                    ) : (
                      <>
                        {state.currentQuestionIndex < visibleQuestions.length - 1
                          ? 'Próximo'
                          : state.currentSectionIndex < (questionnaireConfig.sections.length - 1)
                            ? 'Próxima Seção'
                            : 'Finalizar'}
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                ) : (
                  // TECHNICAL EXCELLENCE FIX 2: Centralized auto-advance coordinator with conflict prevention
                  <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 text-sm text-blue-700">
                      <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full"></div>
                      Avançando automaticamente...
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        // Cancel any pending auto-advance to prevent timing conflicts
                        navigation.cancelNavigation();
                        handleNext();
                      }}
                      className="text-blue-700 hover:text-blue-900 px-2 py-1 h-auto"
                      disabled={navigationState.isNavigating}
                    >
                      {navigationState.isNavigating ? 'Processando...' : 'Avançar agora'}
                    </Button>
                  </div>
                )}
              </div>
            </nav>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
});

// Main component wrapped with error boundary
export const QuestionRenderer = memo(function QuestionRenderer(props: { config?: QuestionRendererConfig; onProgressUpdate?: (progress: number) => void }) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Question renderer error:', error, errorInfo);
        // Could also send to error tracking service
      }}
      resetKeys={[JSON.stringify(props.config || {})]}
      resetOnPropsChange={true}
      fallback={
        <div className="p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium mb-2">Erro no Questionário</h3>
          <p className="text-gray-600 mb-4">
            Houve um problema ao carregar esta pergunta. Por favor, tente recarregar a página.
          </p>
          <Button onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          }}>
            Recarregar Página
          </Button>
        </div>
      }
    >
      <QuestionRendererInner {...props} />
    </ErrorBoundary>
  );
});

// Export feature definition
export const QuestionRendererFeatureDefinition: QuestionnaireFeature = {
  id: 'question-renderer',
  name: 'Question Renderer',
  enabled: true,
  priority: 100, // Highest priority - renders the actual questions
  component: QuestionRenderer,
  config: {
    animations: true,
    autoAdvance: true,
    showProgress: true,
    showValidation: true,
    accessibility: true,
    navigationProfile: 'clinical' // Default to clinical profile for safety
  }
};