'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UnifiedHealthFlow, HealthAssessmentResults, HealthQuestion } from '@/lib/unified-health-flow';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { AlertTriangle, CheckCircle, Clock, Activity } from 'lucide-react';

interface UnifiedHealthAssessmentProps {
  onComplete: (results: HealthAssessmentResults) => void;
  onDomainChange?: (domain: string) => void;
  onProgressUpdate?: (progress: number) => void;
}

interface QuestionState {
  question: HealthQuestion;
  progress: number;
  currentDomain: string;
  currentLayer: string;
  estimatedTimeRemaining: number;
}

interface DomainTransitionState {
  domain: { id: string; name: string };
  message: string;
  progress: number;
  currentDomain: string;
  currentLayer: string;
  estimatedTimeRemaining: number;
}

interface DomainCompleteState {
  domain: { id: string; name: string };
  completedQuestions: number;
  totalQuestions: number;
  progress: number;
  currentDomain: string;
  currentLayer: string;
  estimatedTimeRemaining: number;
  gamificationEvent?: {
    type: string;
    points: number;
    badge: string;
  };
}

type FlowResponse = 
  | ({ type: 'question' } & QuestionState)
  | ({ type: 'domain_transition' } & DomainTransitionState)
  | ({ type: 'domain_complete' } & DomainCompleteState)
  | ({ type: 'complete'; results: HealthAssessmentResults; progress: number; currentDomain: string; currentLayer: string; estimatedTimeRemaining: number });

export const UnifiedHealthAssessment: React.FC<UnifiedHealthAssessmentProps> = ({
  onComplete,
  onDomainChange,
  onProgressUpdate
}) => {
  const [flow] = useState(() => new UnifiedHealthFlow());
  const [currentState, setCurrentState] = useState<FlowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoized answer state to prevent unnecessary re-renders
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const initializeAssessment = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get existing responses to maintain state consistency
      const existingResponses = flow.getResponses();
      if (existingResponses && Object.keys(existingResponses).length > 0) {
        setAnswers(existingResponses);
      }
      
      const initialResponse = await flow.processResponse('_init', true);
      setCurrentState(initialResponse);
      onProgressUpdate?.(initialResponse.progress);
    } catch (err) {
      console.error('Error initializing assessment:', err);
      setError('Erro ao inicializar avaliação');
    } finally {
      setLoading(false);
    }
  }, [flow, onProgressUpdate]);

  useEffect(() => {
    initializeAssessment();
  }, [initializeAssessment]);

  // Effect to restore state on re-renders
  useEffect(() => {
    const existingResponses = flow.getResponses();
    if (existingResponses && Object.keys(existingResponses).length > 0) {
      setAnswers(existingResponses);
    }
  }, [flow]);

  const validateAnswer = useCallback((question: HealthQuestion, answer: any): string | null => {
    if (question.type === 'number') {
      const numValue = typeof answer === 'string' ? parseFloat(answer) : answer;
      if (isNaN(numValue)) return 'Valor deve ser um número válido';
      if (question.min !== undefined && numValue < question.min) return `Valor deve estar entre ${question.min} e ${question.max || 'infinito'}`;
      if (question.max !== undefined && numValue > question.max) return `Valor deve estar entre ${question.min || '-infinito'} e ${question.max}`;
    }
    return null;
  }, []);

  const handleResponse = useCallback(async (questionId: string, answer: any) => {
    try {
      setLoading(true);
      
      // Update local answers state
      setAnswers(prev => ({ ...prev, [questionId]: answer }));
      
      const response = await flow.processResponse(questionId, answer);
      setCurrentState(response);
      onProgressUpdate?.(response.progress);

      // Handle domain changes
      if (response.type === 'domain_transition') {
        onDomainChange?.(response.domain.id);
      }

      // Handle completion
      if (response.type === 'complete') {
        // Trigger gamification if present
        if ((response.results as any).gamificationEvent && (global as any).gamificationHooks?.triggerEvent) {
          (global as any).gamificationHooks.triggerEvent((response.results as any).gamificationEvent);
        }
        onComplete(response.results);
      }
    } catch (err) {
      console.error('Error processing response:', err);
      setError('Erro ao processar resposta');
    } finally {
      setLoading(false);
    }
  }, [flow, onComplete, onDomainChange, onProgressUpdate, validateAnswer]);

  const renderQuestion = useMemo(() => {
    if (!currentState || currentState.type !== 'question') return null;

    const { question } = currentState;
    const currentAnswer = answers[question.id];

    switch (question.type) {
      case 'scale':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>0</span>
              <span>10</span>
            </div>
            <Slider
              value={[currentAnswer || 0]}
              onValueChange={([value]) => handleResponse(question.id, value)}
              min={0}
              max={10}
              step={1}
              className="w-full"
              aria-label={question.text}
              aria-valuemin={0}
              aria-valuemax={10}
              aria-valuenow={currentAnswer || 0}
            />
            <div className="text-center text-lg font-medium text-gray-800">
              {currentAnswer !== undefined ? currentAnswer : 0}
            </div>
          </div>
        );

      case 'select':
        return (
          <div className="space-y-4">
            <RadioGroup
              value={currentAnswer?.toString() || ''}
              onValueChange={(value) => setAnswers(prev => ({ ...prev, [question.id]: value }))}
            >
              <div className="grid gap-2" role="radiogroup">
                <div className="space-y-3">
                  {question.options?.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <RadioGroupItem value={option.value.toString()} id={option.value.toString()} />
                      <Label 
                        htmlFor={option.value.toString()} 
                        className="flex-1 cursor-pointer"
                      >
                        <div className="flex items-center space-x-2">
                          {option.emoji && <span className="text-xl">{option.emoji}</span>}
                          <span>{option.label}</span>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </RadioGroup>
            <div className="pt-4">
              <Button 
                onClick={() => handleResponse(question.id, answers[question.id])}
                disabled={answers[question.id] === undefined}
                className="w-full"
                aria-label="Continuar para próxima pergunta"
              >
                Continuar
              </Button>
            </div>
          </div>
        );

      case 'boolean':
        return (
          <div className="space-y-3">
            <Button
              variant={currentAnswer === true ? "default" : "outline"}
              onClick={() => handleResponse(question.id, true)}
              className="w-full p-4 h-auto justify-start"
              aria-label={`Sim, ${question.text.toLowerCase()}`}
              role="button"
            >
              <span className="mr-2">✅</span>
              Sim
            </Button>
            <Button
              variant={currentAnswer === false ? "default" : "outline"}
              onClick={() => handleResponse(question.id, false)}
              className="w-full p-4 h-auto justify-start"
              aria-label={`Não, ${question.text.toLowerCase()}`}
              role="button"
            >
              <span className="mr-2">❌</span>
              Não
            </Button>
          </div>
        );

      case 'multiselect':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-3">
              Selecione todas as opções que se aplicam:
            </p>
            <div className="space-y-3">
              {question.options?.map((option) => {
                const currentAnswers = currentAnswer || [];
                const isChecked = currentAnswers.includes(option.value);
                
                return (
                  <div key={option.value} className="flex items-center space-x-2 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <Checkbox
                      id={option.value.toString()}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        let newAnswers;
                        if (checked) {
                          newAnswers = [...currentAnswers, option.value];
                        } else {
                          newAnswers = currentAnswers.filter((a: any) => a !== option.value);
                        }
                        handleResponse(question.id, newAnswers);
                      }}
                    />
                    <Label 
                      htmlFor={option.value.toString()} 
                      className="flex-1 cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'text':
      case 'number':
        const validationError = validationErrors[question.id];
        return (
          <div className="space-y-4">
            <Input
              type={question.type === 'number' ? 'number' : 'text'}
              value={currentAnswer || ''}
              onChange={(e) => {
                const value = question.type === 'number' ? 
                  (e.target.value ? parseFloat(e.target.value) : '') : 
                  e.target.value;
                setAnswers(prev => ({ ...prev, [question.id]: value }));
                // Clear validation error when typing
                if (validationErrors[question.id]) {
                  setValidationErrors(prev => ({ ...prev, [question.id]: '' }));
                }
              }}
              onBlur={() => {
                if (currentAnswer !== undefined && currentAnswer !== '') {
                  const error = validateAnswer(question, currentAnswer);
                  if (error) {
                    setValidationErrors(prev => ({ ...prev, [question.id]: error }));
                  } else {
                    handleResponse(question.id, currentAnswer);
                  }
                }
              }}
              placeholder="Digite sua resposta"
              className={`w-full ${validationError ? 'border-red-500' : ''}`}
            />
            {validationError && (
              <p className="text-sm text-red-600">{validationError}</p>
            )}
          </div>
        );

      default:
        return <div>Tipo de pergunta não suportado: {question.type}</div>;
    }
  }, [currentState, answers, handleResponse]);

  if (loading && !currentState) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Iniciando avaliação...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-3 text-red-600">
            <AlertTriangle className="h-6 w-6" />
            <span>{error}</span>
          </div>
          <Button
            onClick={() => {
              setError(null);
              initializeAssessment();
            }}
            variant="outline"
            className="w-full"
          >
            Tentar novamente
          </Button>
        </div>
      </Card>
    );
  }

  if (!currentState) {
    return null;
  }

  // Handle completion
  if (currentState.type === 'complete') {
    return (
      <Card className="p-8 text-center">
        <div className="space-y-6">
          <div className="flex items-center justify-center space-x-3">
            <CheckCircle className="h-12 w-12 text-green-600" />
            <h2 className="text-2xl font-bold text-gray-900">Avaliação Concluída</h2>
          </div>
          <p className="text-gray-600">
            Obrigado por completar sua avaliação de saúde. Seus resultados foram processados.
          </p>
          <Button onClick={() => onComplete(currentState.results)} className="w-full">
            Continuar para Próxima Etapa
          </Button>
        </div>
      </Card>
    );
  }

  // Handle domain transition
  if (currentState.type === 'domain_transition') {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <Activity className="h-12 w-12 text-blue-600 mx-auto animate-pulse" />
          <h3 className="text-lg font-semibold">{currentState.domain.name}</h3>
          <p className="text-gray-600">{currentState.message}</p>
          <Progress value={currentState.progress} className="w-full" />
        </div>
      </Card>
    );
  }

  // Render question
  const { question, progress, currentDomain, currentLayer, estimatedTimeRemaining } = currentState;

  return (
    <Card className="p-6 space-y-6">
      {/* Progress Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <span>{currentDomain}</span>
            <span>•</span>
            <span>{currentLayer}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>~{estimatedTimeRemaining}min</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Progresso</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      </div>

      {/* Question Content */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {question.text}
          </h2>
          {question.instrument && (
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-4">
              {question.instrument}
            </div>
          )}
          {question.metadata?.sensitiveInfo && (
            <div className="flex items-start space-x-2 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800 mb-4">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Esta informação é protegida e usada apenas para cálculos médicos</span>
            </div>
          )}
          {question.metadata?.screenReaderHelp && (
            <div className="text-sm text-gray-600 mb-4">
              {question.metadata.screenReaderHelp}
            </div>
          )}
        </div>

        {/* Question Input */}
        <div className="min-h-[100px]">
          {renderQuestion}
        </div>
      </div>
    </Card>
  );
};