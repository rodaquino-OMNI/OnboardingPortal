'use client';

import React, { useState, useEffect } from 'react';
import { ChevronRight, CheckCircle, Info, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuestionnaire, QuestionnaireFeature } from './BaseHealthQuestionnaire';
import { HealthQuestion, QuestionValue } from '@/types/health';
import { motion, AnimatePresence } from 'framer-motion';

interface QuestionRendererConfig {
  animations: boolean;
  autoAdvance: boolean;
  showProgress: boolean;
  showValidation: boolean;
  accessibility: boolean;
}

export function QuestionRenderer({ config }: { config?: QuestionRendererConfig }) {
  const {
    state,
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

  const currentSection = getCurrentSection();
  const currentQuestion = getCurrentQuestion();
  const visibleQuestions = getVisibleQuestions();
  const progress = calculateProgress();

  const showAnimations = config?.animations !== false;
  const autoAdvance = config?.autoAdvance !== false;
  const showProgressBar = config?.showProgress !== false;

  // Reset local value when question changes
  useEffect(() => {
    if (currentQuestion) {
      setLocalValue(state.responses[currentQuestion.id] || null);
      setShowError(false);
    }
  }, [currentQuestion, state.responses]);

  // Handle response submission
  const handleResponse = (value: QuestionValue) => {
    if (!currentQuestion) return;

    setLocalValue(value);
    setResponse(currentQuestion.id, value);

    // Auto-advance for certain question types
    if (autoAdvance && shouldAutoAdvance(currentQuestion)) {
      setTimeout(() => {
        handleNext();
      }, 300);
    }
  };

  // Handle next button
  const handleNext = () => {
    if (!currentQuestion) return;

    const error = validateQuestion(currentQuestion, localValue);
    if (error && config?.showValidation !== false) {
      setShowError(true);
      return;
    }

    nextQuestion();
  };

  // Check if question should auto-advance
  const shouldAutoAdvance = (question: HealthQuestion): boolean => {
    return ['boolean', 'select', 'scale'].includes(question.type);
  };

  // Render question based on type
  const renderQuestionInput = () => {
    if (!currentQuestion) return null;

    const value = state.responses[currentQuestion.id];
    const error = state.validationErrors[currentQuestion.id];

    switch (currentQuestion.type) {
      case 'boolean':
        return (
          <div className="grid grid-cols-2 gap-4" role="radiogroup">
            <Button
              variant={value === true ? 'default' : 'outline'}
              onClick={() => handleResponse(true)}
              className="py-8 text-lg transition-all hover:scale-105"
              role="radio"
              aria-checked={value === true}
            >
              Sim
            </Button>
            <Button
              variant={value === false ? 'default' : 'outline'}
              onClick={() => handleResponse(false)}
              className="py-8 text-lg transition-all hover:scale-105"
              role="radio"
              aria-checked={value === false}
            >
              Não
            </Button>
          </div>
        );

      case 'select':
        const options = getQuestionOptions(currentQuestion);
        return (
          <div className="space-y-3" role="radiogroup">
            {options.map((option, index) => (
              <Button
                key={`${option.value}-${index}`}
                variant={value === option.value ? 'default' : 'outline'}
                onClick={() => handleResponse(option.value)}
                className="w-full justify-start py-4 transition-all hover:scale-[1.02]"
                role="radio"
                aria-checked={value === option.value}
              >
                {option.label}
                {option.description && (
                  <span className="text-sm text-gray-600 ml-2">
                    {option.description}
                  </span>
                )}
              </Button>
            ))}
          </div>
        );

      case 'multiselect':
        const multiOptions = getQuestionOptions(currentQuestion);
        const selectedValues = (value as string[]) || [];
        
        return (
          <div className="grid grid-cols-2 gap-3" role="group">
            {multiOptions.map((option, index) => {
              const isSelected = selectedValues.includes(option.value as string);
              return (
                <Button
                  key={`${option.value}-${index}`}
                  variant={isSelected ? 'default' : 'outline'}
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
                  className="justify-start"
                  role="checkbox"
                  aria-checked={isSelected}
                >
                  {isSelected && <CheckCircle className="w-4 h-4 mr-2" />}
                  {option.label}
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
              value={localValue || ''}
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
    
    return (question.options || []).map(opt => 
      typeof opt === 'string' ? { value: opt, label: opt } : opt
    );
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
          initial={showAnimations ? { opacity: 0, x: 20 } : {}}
          animate={{ opacity: 1, x: 0 }}
          exit={showAnimations ? { opacity: 0, x: -20 } : {}}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-8">
            {/* Question Header */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <Badge variant="outline">
                  {currentSection.title} • Q{state.currentQuestionIndex + 1}/{visibleQuestions.length}
                </Badge>
                {currentQuestion.metadata?.validatedTool && (
                  <Badge variant="secondary" className="text-xs">
                    {currentQuestion.metadata.validatedTool}
                  </Badge>
                )}
              </div>

              {/* Question Text */}
              <h2 className="text-2xl font-semibold">
                {currentQuestion.text}
                {currentQuestion.required && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </h2>

              {/* Risk Warning */}
              {currentQuestion.riskWeight && currentQuestion.riskWeight >= 8 && (
                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    Esta pergunta é importante para sua segurança.
                  </AlertDescription>
                </Alert>
              )}

              {/* Validation Error */}
              {showError && state.validationErrors[currentQuestion.id] && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>
                    {state.validationErrors[currentQuestion.id]}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Question Input */}
            <div className="mb-8">
              {renderQuestionInput()}
            </div>

            {/* Navigation */}
            <nav className="flex justify-between items-center">
              <Button
                variant="ghost"
                onClick={previousQuestion}
                disabled={state.currentSectionIndex === 0 && state.currentQuestionIndex === 0}
              >
                Voltar
              </Button>

              <div className="flex gap-2">
                {!currentQuestion.required && (
                  <Button variant="ghost" onClick={nextQuestion}>
                    Pular
                  </Button>
                )}

                {(!autoAdvance || !shouldAutoAdvance(currentQuestion)) && (
                  <Button onClick={handleNext}>
                    {state.currentQuestionIndex < visibleQuestions.length - 1
                      ? 'Próximo'
                      : state.currentSectionIndex < state.sectionProgress.length - 1
                        ? 'Próxima Seção'
                        : 'Finalizar'}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            </nav>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

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
    accessibility: true
  }
};