'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Heart, Brain, Activity, Shield, AlertTriangle, 
  CheckCircle, Trophy, Sparkles, ChevronRight,
  Info, Lock, Eye, EyeOff
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  HEALTH_QUESTIONNAIRE_SECTIONS,
  calculateRiskScore,
  detectFraudIndicators,
  calculateHealthScore,
  type HealthSection,
  type HealthQuestion,
  type RiskScore,
  type FraudIndicators
} from '@/lib/health-questionnaire-v2';

// Enhanced error boundary for production stability
import { ErrorBoundary } from './ErrorBoundary';

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
      <h2 className="text-lg font-semibold text-red-800 mb-2">Erro no Questionário de Saúde</h2>
      <p className="text-red-600 mb-4">Ocorreu um erro técnico. Seus dados estão seguros.</p>
      <Button onClick={resetErrorBoundary} variant="outline">
        Tentar Novamente
      </Button>
    </div>
  );
}

interface SmartHealthQuestionnaireProps {
  onComplete: (data: any) => void;
  userId?: string;
  progressiveResults?: any;
}

export function SmartHealthQuestionnaire({ onComplete, userId, progressiveResults }: SmartHealthQuestionnaireProps) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [sectionProgress, setSectionProgress] = useState<Record<string, number>>({});
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  const [fraudIndicators, setFraudIndicators] = useState<FraudIndicators | null>(null);
  const [showPrivacyMode, setShowPrivacyMode] = useState(false);
  const [trustScore, setTrustScore] = useState(100);
  const [showRiskAlert, setShowRiskAlert] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const currentSection = HEALTH_QUESTIONNAIRE_SECTIONS[currentSectionIndex];
  const visibleQuestions = currentSection?.questions?.filter(q => {
    if (!q.conditionalOn) return true;
    const conditionValue = responses[q.conditionalOn.questionId];
    if (q.conditionalOn.values.includes('*')) {
      return conditionValue && (Array.isArray(conditionValue) ? conditionValue.length > 0 : true);
    }
    return q.conditionalOn.values.includes(conditionValue);
  }) || [];
  const currentQuestion = visibleQuestions[currentQuestionIndex];
  const totalQuestions = visibleQuestions.length;

  // Define handleCriticalRisk BEFORE it's used in useEffect
  const handleCriticalRisk = useCallback((riskType: string) => {
    console.error(`CRITICAL RISK DETECTED: ${riskType}`);
    
    // Enhanced emergency protocol
    if (riskType === 'suicide') {
      // Store emergency event in memory
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('emergency_detected', JSON.stringify({
          type: riskType,
          timestamp: new Date().toISOString(),
          userId: userId || 'anonymous'
        }));
      }
      
      // Show crisis resources immediately
      setShowRiskAlert(true);
      
      // In production: trigger healthcare provider notification
      // API call to emergency notification service would go here
    }
  }, [userId]);

  // Real-time fraud detection with memory cleanup
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        const indicators = detectFraudIndicators(responses);
        setFraudIndicators(indicators);
        
        // Update trust score based on consistency
        setTrustScore(Math.max(0, 100 - indicators.inconsistencyScore));
        
        // Show alert for critical inconsistencies
        if (indicators.inconsistencyScore > 50) {
          setShowRiskAlert(true);
        }
      } catch (error) {
        console.error('Fraud detection error:', error);
        // Graceful fallback - don't break the questionnaire
      }
    }, 300); // Debounce for performance
    
    return () => clearTimeout(timeoutId);
  }, [responses]);

  // Calculate risk score periodically with proper validation
  useEffect(() => {
    // Only calculate risk score when we have meaningful responses
    const responseCount = Object.keys(responses).length;
    const hasValidResponses = responseCount > 10 && 
      Object.values(responses).some(value => 
        value !== undefined && value !== null && value !== ''
      );
    
    if (hasValidResponses) {
      try {
        const score = calculateRiskScore(responses);
        setRiskScore(score);
        
        // Only trigger critical risk if PHQ-9 question 9 has been explicitly answered
        // and the response indicates risk (value > 0)
        if (score.flags.includes('suicide_risk') && 
            responses.phq9_9 !== undefined && 
            responses.phq9_9 !== null &&
            typeof responses.phq9_9 === 'number' &&
            responses.phq9_9 > 0) {
          handleCriticalRisk('suicide');
        }
      } catch (error) {
        console.error('Risk calculation error:', error);
        // Don't break the questionnaire flow
      }
    }
  }, [responses, handleCriticalRisk]);

  const validateResponse = (question: HealthQuestion, value: any): string | null => {
    if (question.required && (!value || (Array.isArray(value) && value.length === 0) || (typeof value === 'string' && !value.trim()))) {
      return 'Este campo é obrigatório';
    }
    
    if (question.type === 'number' && question.validation) {
      const numValue = Number(value);
      if (question.validation.min && numValue < question.validation.min) {
        return `Valor deve ser maior ou igual a ${question.validation.min}`;
      }
      if (question.validation.max && numValue > question.validation.max) {
        return `Valor deve ser menor ou igual a ${question.validation.max}`;
      }
    }
    
    return null;
  };

  const validateCurrentSection = (): boolean => {
    const errors: Record<string, string> = {};
    let hasErrors = false;
    
    visibleQuestions.forEach(question => {
      const error = validateResponse(question, responses[question.id]);
      if (error) {
        errors[question.id] = error;
        hasErrors = true;
      }
    });
    
    setValidationErrors(errors);
    return !hasErrors;
  };

  const handleNextQuestion = () => {
    if (!currentQuestion) return;
    
    const error = validateResponse(currentQuestion, responses[currentQuestion.id]);
    if (error) {
      setValidationErrors(prev => ({ ...prev, [currentQuestion.id]: error }));
      return;
    }
    
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      handleSectionComplete();
    }
  };

  const handleResponse = (value: any) => {
    if (!currentQuestion) return;
    
    const newResponses = { ...responses, [currentQuestion.id]: value };
    setResponses(newResponses);
    
    // Clear validation error for this field
    if (validationErrors[currentQuestion.id]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[currentQuestion.id];
        return newErrors;
      });
    }

    // Validate current response
    const error = validateResponse(currentQuestion, value);
    if (error) {
      setValidationErrors(prev => ({ ...prev, [currentQuestion.id]: error }));
      return; // Don't auto-advance if there's a validation error
    }

    // Check for validation pairs
    if (currentQuestion.validationPair) {
      const pairedValue = responses[currentQuestion.validationPair];
      if (pairedValue !== undefined) {
        // Validate consistency
        if (currentQuestion.type === 'number' && Math.abs(value - pairedValue) > 5) {
          setTrustScore(prev => Math.max(0, prev - 10));
        }
      }
    }

    // Auto-advance only for select-type questions, not for text input or multiselect
    if (currentQuestion.type === 'boolean' || currentQuestion.type === 'select' || currentQuestion.type === 'scale') {
      setTimeout(() => {
        if (currentQuestionIndex < totalQuestions - 1) {
          setCurrentQuestionIndex(prev => prev + 1);
        } else {
          handleSectionComplete();
        }
      }, 300);
    }
  };

  const handleSectionComplete = () => {
    if (!validateCurrentSection()) {
      return; // Don't proceed if validation fails
    }
    
    // Update section progress
    setSectionProgress(prev => ({
      ...prev,
      [currentSection.id]: 100
    }));

    if (currentSectionIndex < HEALTH_QUESTIONNAIRE_SECTIONS.length - 1) {
      setCurrentSectionIndex(prev => prev + 1);
      setCurrentQuestionIndex(0);
    } else {
      // Complete questionnaire
      const finalScore = calculateHealthScore(responses, fraudIndicators!);
      onComplete({
        responses,
        riskScore,
        fraudIndicators,
        healthScore: finalScore,
        timestamp: new Date().toISOString()
      });
    }
  };

  const renderQuestion = () => {
    if (!currentQuestion) return null;

    switch (currentQuestion.type) {
      case 'boolean':
        return (
          <fieldset className="grid grid-cols-2 gap-4" 
                   aria-labelledby={`question-${currentQuestion.id}`}
                   aria-describedby={currentQuestion.validation ? `question-${currentQuestion.id}-help` : undefined}>
            <legend className="sr-only">{currentQuestion.text}</legend>
            <Button
              variant={responses[currentQuestion.id] === true ? 'default' : 'outline'}
              onClick={() => handleResponse(true)}
              className="py-8 text-lg"
              role="radio"
              aria-checked={responses[currentQuestion.id] === true}
              aria-labelledby={`question-${currentQuestion.id}`}
              tabIndex={responses[currentQuestion.id] === true ? 0 : -1}
            >
              Sim
            </Button>
            <Button
              variant={responses[currentQuestion.id] === false ? 'default' : 'outline'}
              onClick={() => handleResponse(false)}
              className="py-8 text-lg"
              role="radio"
              aria-checked={responses[currentQuestion.id] === false}
              aria-labelledby={`question-${currentQuestion.id}`}
              tabIndex={responses[currentQuestion.id] === false ? 0 : -1}
            >
              Não
            </Button>
          </fieldset>
        );

      case 'select':
        const selectOptions = currentQuestion.metadata?.validatedTool === 'PHQ-9' || 
                             currentQuestion.metadata?.validatedTool === 'GAD-7'
          ? [
              { value: 0, label: 'Nunca' },
              { value: 1, label: 'Vários dias' },
              { value: 2, label: 'Mais da metade dos dias' },
              { value: 3, label: 'Quase todos os dias' }
            ]
          : (currentQuestion.options || []).map(opt => 
              typeof opt === 'string' 
                ? { value: opt, label: opt }
                : opt
            );

        if (selectOptions.length === 0) {
          return (
            <div className="text-red-500 p-4 border border-red-300 rounded" role="alert">
              Erro: Opções não definidas para esta pergunta
            </div>
          );
        }

        const selectedValue = responses[currentQuestion.id];
        const selectError = validationErrors[currentQuestion.id];

        return (
          <div className="space-y-3">
            <fieldset className="space-y-3" 
                     aria-labelledby={`question-${currentQuestion.id}`}
                     aria-describedby={`${currentQuestion.validation ? `question-${currentQuestion.id}-help` : ''} ${selectError ? `question-${currentQuestion.id}-error` : ''}`.trim()}
                     aria-invalid={selectError ? 'true' : 'false'}
                     role="radiogroup"
                     aria-required={currentQuestion.required}>
              <legend className="sr-only">{currentQuestion.text}</legend>
              {selectOptions.map((option, index) => {
                const isSelected = selectedValue === option.value;
                const optionId = `${currentQuestion.id}-option-${index}`;
                return (
                  <Button
                    key={`${option.value}-${index}`}
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={() => handleResponse(option.value)}
                    className="w-full justify-start py-4"
                    role="radio"
                    aria-checked={isSelected}
                    aria-labelledby={`question-${currentQuestion.id}`}
                    id={optionId}
                    tabIndex={isSelected ? 0 : -1}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                        e.preventDefault();
                        const nextIndex = (index + 1) % selectOptions.length;
                        const nextButton = document.getElementById(`${currentQuestion.id}-option-${nextIndex}`);
                        nextButton?.focus();
                        handleResponse(selectOptions[nextIndex].value);
                      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                        e.preventDefault();
                        const prevIndex = index === 0 ? selectOptions.length - 1 : index - 1;
                        const prevButton = document.getElementById(`${currentQuestion.id}-option-${prevIndex}`);
                        prevButton?.focus();
                        handleResponse(selectOptions[prevIndex].value);
                      } else if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        handleResponse(option.value);
                      }
                    }}
                  >
                    {option.label}
                    {option.description && (
                      <span className="text-sm text-gray-600 ml-2">
                        {option.description}
                      </span>
                    )}
                  </Button>
                );
              })}
            </fieldset>
            {selectError && (
              <div role="alert" id={`question-${currentQuestion.id}-error`} className="text-red-600 text-sm">
                {selectError}
              </div>
            )}
          </div>
        );

      case 'number':
        const numberValue = responses[currentQuestion.id];
        const numberError = validationErrors[currentQuestion.id];
        
        return (
          <div className="space-y-4">
            <label htmlFor={`input-${currentQuestion.id}`} className="sr-only">
              {currentQuestion.text}
            </label>
            <input
              id={`input-${currentQuestion.id}`}
              type="number"
              className={`w-full px-4 py-3 text-lg border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                numberError ? 'border-red-500 focus:ring-red-500' : ''
              }`}
              placeholder="Digite um número"
              min={currentQuestion.validation?.min}
              max={currentQuestion.validation?.max}
              value={responses[currentQuestion.id] || ''}
              aria-labelledby={`question-${currentQuestion.id}`}
              aria-describedby={`${currentQuestion.validation ? `question-${currentQuestion.id}-help` : ''} ${
                numberError ? `question-${currentQuestion.id}-error` : ''
              }`.trim()}
              aria-invalid={numberError ? 'true' : 'false'}
              aria-required={currentQuestion.required}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  handleResponse('');
                } else {
                  const numValue = parseInt(value);
                  if (!isNaN(numValue)) {
                    handleResponse(numValue);
                  }
                }
              }}
              onBlur={() => {
                // Validate on blur
                const error = validateResponse(currentQuestion, responses[currentQuestion.id]);
                if (error) {
                  setValidationErrors(prev => ({ ...prev, [currentQuestion.id]: error }));
                }
              }}
            />
            {numberError && (
              <div role="alert" id={`question-${currentQuestion.id}-error`} className="text-red-600 text-sm">
                {numberError}
              </div>
            )}
          </div>
        );

      case 'multiselect':
        const multiOptions = (currentQuestion.options || []).map(opt => 
          typeof opt === 'string' 
            ? { value: opt, label: opt }
            : opt
        );

        if (multiOptions.length === 0) {
          return (
            <div className="text-red-500 p-4 border border-red-300 rounded" role="alert">
              Erro: Opções não definidas para esta pergunta
            </div>
          );
        }

        const multiError = validationErrors[currentQuestion.id];

        return (
          <div className="space-y-3">
            <fieldset className="grid grid-cols-2 gap-3" 
                     aria-labelledby={`question-${currentQuestion.id}`}
                     aria-describedby={`${currentQuestion.validation ? `question-${currentQuestion.id}-help` : ''} ${multiError ? `question-${currentQuestion.id}-error` : ''}`.trim()}
                     aria-invalid={multiError ? 'true' : 'false'}
                     role="group"
                     aria-required={currentQuestion.required}>
              <legend className="sr-only">{currentQuestion.text} (Selecione uma ou mais opções)</legend>
              {multiOptions.map((option, index) => {
                const selected = responses[currentQuestion.id]?.includes(option.value);
                const optionId = `${currentQuestion.id}-checkbox-${index}`;
                return (
                  <Button
                    key={`${option.value}-${index}`}
                    variant={selected ? 'default' : 'outline'}
                    onClick={() => {
                      const current = responses[currentQuestion.id] || [];
                      if (option.value === 'none') {
                        handleResponse(['none']);
                      } else if (current.includes('none')) {
                        handleResponse([option.value]);
                      } else {
                        const updated = selected
                          ? current.filter((val: string) => val !== option.value)
                          : [...current, option.value];
                        handleResponse(updated);
                      }
                    }}
                    className="justify-start"
                    role="checkbox"
                    aria-checked={selected}
                    aria-labelledby={`question-${currentQuestion.id}`}
                    aria-describedby={option.description ? `option-${option.value}-desc` : undefined}
                    id={optionId}
                  >
                    {selected && <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />}
                    {option.label}
                    {option.description && (
                      <span id={`option-${option.value}-desc`} className="sr-only">
                        {option.description}
                      </span>
                    )}
                  </Button>
                );
              })}
            </fieldset>
            {multiError && (
              <div role="alert" id={`question-${currentQuestion.id}-error`} className="text-red-600 text-sm">
                {multiError}
              </div>
            )}
          </div>
        );

      default:
        const textValue = responses[currentQuestion.id] || '';
        const textError = validationErrors[currentQuestion.id];
        
        return (
          <div className="space-y-2">
            <label htmlFor={`textarea-${currentQuestion.id}`} className="sr-only">
              {currentQuestion.text}
            </label>
            <textarea
              id={`textarea-${currentQuestion.id}`}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                textError ? 'border-red-500 focus:ring-red-500' : ''
              }`}
              rows={4}
              placeholder="Digite sua resposta..."
              value={textValue}
              aria-labelledby={`question-${currentQuestion.id}`}
              aria-describedby={textError ? `question-${currentQuestion.id}-error` : undefined}
              aria-invalid={textError ? 'true' : 'false'}
              aria-required={currentQuestion.required}
              onChange={(e) => handleResponse(e.target.value)}
              onBlur={() => {
                // Validate on blur
                const error = validateResponse(currentQuestion, responses[currentQuestion.id]);
                if (error) {
                  setValidationErrors(prev => ({ ...prev, [currentQuestion.id]: error }));
                }
              }}
            />
            {textError && (
              <div role="alert" id={`question-${currentQuestion.id}-error`} className="text-red-600 text-sm">
                {textError}
              </div>
            )}
          </div>
        );
    }
  };

  const getSectionIcon = (sectionId: string) => {
    const icons: Record<string, any> = {
      initial_screening: Heart,
      medical_history: Activity,
      mental_health_screening: Brain,
      validation_section: Shield
    };
    return icons[sectionId] || Heart;
  };

  const overallProgress = totalQuestions > 0 ? 
    (currentSectionIndex / HEALTH_QUESTIONNAIRE_SECTIONS.length) * 100 +
    (currentQuestionIndex / totalQuestions) * (100 / HEALTH_QUESTIONNAIRE_SECTIONS.length)
    : 0;

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      <div className="max-w-4xl mx-auto space-y-6 px-4" role="main" aria-label="Questionário de saúde">
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          Questionário de saúde. Progresso: {Math.round(overallProgress)}% completo. 
          Seção atual: {currentSection?.title || 'Carregando'}. 
          Pergunta {currentQuestionIndex + 1} de {totalQuestions}.
        </div>
      {/* Trust Score and Privacy Toggle */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Badge variant={trustScore > 80 ? 'default' : 'secondary'}>
            <Shield className="w-4 h-4 mr-1" />
            Confiabilidade: {trustScore}%
          </Badge>
          {fraudIndicators?.recommendation === 'flag' && (
            <Badge variant="destructive">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Revisar respostas
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPrivacyMode(!showPrivacyMode)}
        >
          {showPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showPrivacyMode ? 'Modo Privado' : 'Normal'}
        </Button>
      </div>

      {/* Progress Overview */}
      <div className="card-modern p-6 animate-fade-in">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="section-title">Progresso Geral</h3>
            <span className="text-sm text-gray-600" aria-live="polite">
              {Math.round(overallProgress)}% completo
            </span>
          </div>
          <Progress 
            value={overallProgress} 
            className="h-3" 
            aria-label={`Progresso do questionário: ${Math.round(overallProgress)}% completo`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(overallProgress)}
          />
          
          {/* Section Progress */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {HEALTH_QUESTIONNAIRE_SECTIONS.map((section, index) => {
              const Icon = getSectionIcon(section.id);
              const isActive = index === currentSectionIndex;
              const isComplete = index < currentSectionIndex;
              
              return (
                <div
                  key={section.id}
                  className={`flex flex-col items-center p-3 rounded-lg transition-all ${
                    isActive ? 'bg-blue-50 border-2 border-blue-500' :
                    isComplete ? 'bg-green-50' : 'bg-gray-50'
                  }`}
                  role="img"
                  aria-label={`Seção ${index + 1}: ${section.title}. ${isComplete ? 'Concluída' : isActive ? 'Ativa' : 'Pendente'}`}
                >
                  <Icon className={`w-6 h-6 mb-1 ${
                    isActive ? 'text-blue-600' :
                    isComplete ? 'text-green-600' : 'text-gray-400'
                  }`} aria-hidden="true" />
                  <span className="text-xs text-center">{section.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Current Question */}
      {currentQuestion && (
        <div key={`${currentSectionIndex}-${currentQuestionIndex}-${currentQuestion.id}`}>
          <div className="card-modern p-8 animate-fade-in" 
               style={{ animationDelay: '0.2s' }}
               role="form" 
               aria-label="Questionário de saúde">
            <div className="space-y-6">
              <div className="sr-only">
                <p>Instruções: Preencha as informações solicitadas. Campos marcados com asterisco (*) são obrigatórios.</p>
                <p>Use as teclas Tab para navegar entre os campos e Enter ou Espaço para selecionar opções.</p>
              </div>
              {/* Section Header - Unique text to avoid test ambiguity */}
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-sm" aria-label={`Seção ${currentSectionIndex + 1}: ${currentSection?.title}`}>
                  {currentSection?.title || 'Carregando...'} • Q{currentQuestionIndex + 1}/{totalQuestions}
                </Badge>
                {currentQuestion?.metadata?.validatedTool && (
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Ferramenta Validada: {currentQuestion.metadata.validatedTool}
                  </Badge>
                )}
              </div>

              {/* Question */}
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold" id={`question-${currentQuestion?.id}`}>
                  {showPrivacyMode && currentQuestion?.category === 'mental_health' 
                    ? '(Pergunta privada - suas respostas são confidenciais)'
                    : currentQuestion?.text}
                  {currentQuestion?.required && <span className="text-red-500 ml-1" aria-label="obrigatório">*</span>}
                </h2>
                
                {currentQuestion?.validation && (
                  <p className="text-sm text-gray-600" id={`question-${currentQuestion?.id}-help`}>
                    {currentQuestion.type === 'number' && currentQuestion.validation.min && currentQuestion.validation.max && (
                      `Entre ${currentQuestion.validation.min} e ${currentQuestion.validation.max}`
                    )}
                  </p>
                )}
                
                {currentQuestion?.riskWeight && currentQuestion.riskWeight >= 8 && (
                  <Alert>
                    <Info className="w-4 h-4" />
                    <AlertDescription>
                      Esta pergunta é importante para sua segurança. 
                      Por favor, responda com sinceridade.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Response Area */}
              <div className="mt-6">
                {renderQuestion()}
              </div>

              {/* Navigation */}
              <nav className="flex justify-between items-center mt-8" aria-label="Navegação do questionário">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (currentQuestionIndex > 0) {
                      setCurrentQuestionIndex(prev => prev - 1);
                    } else if (currentSectionIndex > 0) {
                      setCurrentSectionIndex(prev => prev - 1);
                      setCurrentQuestionIndex(0);
                    }
                  }}
                  disabled={currentSectionIndex === 0 && currentQuestionIndex === 0}
                  aria-label="Voltar para a pergunta anterior"
                >
                  Voltar
                </Button>
                
                <div className="flex gap-2">
                  {currentQuestion?.required === false && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (currentQuestionIndex < visibleQuestions.length - 1) {
                          setCurrentQuestionIndex(prev => prev + 1);
                        } else {
                          handleSectionComplete();
                        }
                      }}
                      aria-label="Pular esta pergunta opcional"
                    >
                      Pular
                      <ChevronRight className="w-4 h-4 ml-1" aria-hidden="true" />
                    </Button>
                  )}
                  
                  {/* Show Next button for questions that don't auto-advance */}
                  {(currentQuestion?.type === 'text' || 
                    currentQuestion?.type === 'number' || 
                    currentQuestion?.type === 'multiselect' || 
                    currentQuestion?.type === 'date') && (
                    <Button
                      onClick={handleNextQuestion}
                      disabled={currentQuestion?.required && (!responses[currentQuestion.id] || validationErrors[currentQuestion.id])}
                      aria-label={currentQuestionIndex < totalQuestions - 1 
                        ? "Ir para a próxima pergunta" 
                        : "Finalizar seção"}
                    >
                      {currentQuestionIndex < totalQuestions - 1 ? 'Próximo' : 'Finalizar'}
                      <ChevronRight className="w-4 h-4 ml-1" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Risk Alert Modal */}
      {showRiskAlert && riskScore?.flags.includes('suicide_risk') && (
        <Alert className="mt-4 border-red-500 bg-red-50" role="dialog" aria-labelledby="crisis-support-title" aria-describedby="crisis-support-desc">
          <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
          <AlertDescription className="text-red-800">
            <strong id="crisis-support-title">Recursos de Apoio Disponíveis</strong>
            <div id="crisis-support-desc">
              <p className="mt-2">CVV - Centro de Valorização da Vida: 188 (24h)</p>
              <p>Ou acesse: www.cvv.org.br</p>
            </div>
            <Button 
              size="sm" 
              className="mt-3"
              onClick={() => setShowRiskAlert(false)}
              aria-label="Fechar alerta de apoio"
            >
              Entendi
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Health Score Preview */}
      {riskScore && Object.keys(responses).length > 20 && (
        <div className="card-modern p-4 bg-gradient-to-r from-blue-50 to-purple-50 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Seu Score de Saúde Atual</p>
                <p className="text-xs text-gray-600">
                  Continue respondendo para melhorar sua avaliação
                </p>
              </div>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {Math.max(0, 100 - Math.round(riskScore.overall / 2))}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
    </ErrorBoundary>
  );
}