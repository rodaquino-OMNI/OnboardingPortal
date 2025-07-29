'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Heart, 
  Brain, 
  Activity, 
  Clock, 
  ChevronRight, 
  AlertTriangle,
  CheckCircle,
  Stethoscope,
  User,
  Shield,
  Home,
  Pill
} from 'lucide-react';
import {
  UnifiedHealthFlow,
  type FlowResult,
  type HealthAssessmentResults,
  type HealthQuestion
} from '@/lib/unified-health-flow';

interface UnifiedHealthAssessmentProps {
  onComplete: (results: HealthAssessmentResults) => void;
  onDomainChange?: (domain: string) => void;
}

export function UnifiedHealthAssessment({ 
  onComplete, 
  onDomainChange 
}: UnifiedHealthAssessmentProps) {
  const [flow] = useState(new UnifiedHealthFlow());
  const [currentQuestion, setCurrentQuestion] = useState<HealthQuestion | null>(null);
  const [flowResult, setFlowResult] = useState<FlowResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{
    type: 'bot' | 'user';
    content: string;
    timestamp: Date;
    domain?: string;
  }>>([]);

  useEffect(() => {
    initializeAssessment();
  }, []);

  const initializeAssessment = async () => {
    addBotMessage(
      "Olá! Vou fazer uma avaliação personalizada da sua saúde. " +
      "Começaremos com algumas perguntas básicas e, baseado nas suas respostas, " +
      "aprofundaremos apenas nas áreas que precisam de mais atenção. " +
      "Vamos começar?"
    );
    
    // Start with the first question from triage
    const result = await flow.processResponse('_init', true);
    handleFlowResult(result);
  };

  const addBotMessage = (content: string, domain?: string) => {
    setConversationHistory(prev => [...prev, {
      type: 'bot',
      content,
      timestamp: new Date(),
      domain
    }]);
  };

  const addUserMessage = (content: string) => {
    setConversationHistory(prev => [...prev, {
      type: 'user',
      content,
      timestamp: new Date()
    }]);
  };

  const handleResponse = async (value: any) => {
    if (!currentQuestion) return;

    setIsProcessing(true);

    // Add user response to conversation
    const displayValue = formatResponseForDisplay(currentQuestion, value);
    addUserMessage(displayValue);

    try {
      // Process response through unified flow
      const result = await flow.processResponse(currentQuestion.id, value);
      handleFlowResult(result);
    } catch (error) {
      console.error('Error processing response:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFlowResult = (result: FlowResult) => {
    setFlowResult(result);

    switch (result.type) {
      case 'question':
        setCurrentQuestion(result.question!);
        // Don't add bot message for question text - it's shown in the UI
        break;

      case 'domain_transition':
        onDomainChange?.(result.domain!.id);
        addBotMessage(result.message!, result.domain!.id);
        
        // Automatically proceed to first question of new domain
        setTimeout(async () => {
          const nextResult = await flow.processResponse('_continue', true);
          handleFlowResult(nextResult);
        }, 1500);
        break;

      case 'complete':
        setCurrentQuestion(null);
        addBotMessage(
          "Perfeito! Sua avaliação de saúde está completa. " +
          "Com base nas suas respostas, preparei recomendações personalizadas para você."
        );
        
        setTimeout(() => {
          onComplete(result.results!);
        }, 2000);
        break;
    }
  };

  const formatResponseForDisplay = (question: HealthQuestion, value: any): string => {
    if (question.type === 'scale') {
      const option = question.options?.find(opt => opt.value === value);
      return `${value} ${option?.emoji || ''}`;
    }
    
    if (question.type === 'select') {
      const option = question.options?.find(opt => opt.value === value);
      return option?.label || value.toString();
    }
    
    if (question.type === 'multiselect') {
      if (Array.isArray(value)) {
        return value.map(v => {
          const option = question.options?.find(opt => opt.value === v);
          return option?.label || v;
        }).join(', ');
      }
    }
    
    if (question.type === 'boolean') {
      return value ? 'Sim' : 'Não';
    }
    
    return value.toString();
  };

  const renderQuestion = () => {
    if (!currentQuestion || isProcessing) return null;

    switch (currentQuestion.type) {
      case 'scale':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>0 - Mínimo</span>
                <span>10 - Máximo</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                defaultValue="0"
                onChange={(e) => handleResponse(parseInt(e.target.value))}
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="mt-4 text-4xl">
                {currentQuestion.options?.[0]?.emoji || '📊'}
              </div>
            </div>
          </div>
        );

      case 'select':
        return (
          <div className="space-y-3">
            {currentQuestion.options?.map(option => (
              <Button
                key={option.value}
                variant="outline"
                onClick={() => handleResponse(option.value)}
                className="w-full justify-start py-4 text-left hover:bg-blue-50"
              >
                {option.emoji && <span className="mr-3 text-lg">{option.emoji}</span>}
                {option.label}
              </Button>
            ))}
          </div>
        );

      case 'multiselect':
        return (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-4">
              Selecione todas as opções que se aplicam:
            </p>
            <MultiSelectQuestion 
              question={currentQuestion}
              onComplete={handleResponse}
            />
          </div>
        );

      case 'boolean':
        return (
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={() => handleResponse(true)}
              className="py-8 text-lg hover:bg-green-50"
            >
              ✅ Sim
            </Button>
            <Button
              variant="outline"
              onClick={() => handleResponse(false)}
              className="py-8 text-lg hover:bg-red-50"
            >
              ❌ Não
            </Button>
          </div>
        );

      case 'text':
      case 'number':
        return (
          <TextInputQuestion 
            question={currentQuestion}
            onComplete={handleResponse}
          />
        );

      default:
        return <div>Tipo de pergunta não suportado</div>;
    }
  };

  const getDomainIcon = (domainId: string) => {
    switch (domainId) {
      case 'pain_management': return <Heart className="w-5 h-5" />;
      case 'mental_health': return <Brain className="w-5 h-5" />;
      case 'chronic_disease': return <Stethoscope className="w-5 h-5" />;
      case 'lifestyle': return <Activity className="w-5 h-5" />;
      case 'family_history': return <Home className="w-5 h-5" />;
      case 'validation': return <Shield className="w-5 h-5" />;
      default: return <User className="w-5 h-5" />;
    }
  };

  const getDomainColor = (domainId: string) => {
    switch (domainId) {
      case 'pain_management': return 'text-red-600 bg-red-50 border-red-200';
      case 'mental_health': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'chronic_disease': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'lifestyle': return 'text-green-600 bg-green-50 border-green-200';
      case 'family_history': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'validation': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  if (!flowResult) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-pulse w-8 h-8 bg-blue-600 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Iniciando avaliação...</p>
        </div>
      </div>
    );
  }

  if (flowResult.type === 'complete') {
    return (
      <Card className="p-8 max-w-2xl mx-auto">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Avaliação Concluída
            </h2>
            <p className="text-gray-600">
              Obrigado por compartilhar essas informações importantes sobre sua saúde.
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Resumo da Conversa:</h3>
            <div className="max-h-32 overflow-y-auto space-y-1 text-sm">
              {conversationHistory.slice(-6).map((msg, idx) => (
                <div key={idx} className={`${msg.type === 'bot' ? 'text-blue-600' : 'text-gray-700'}`}>
                  <strong>{msg.type === 'bot' ? '🤖' : '👤'}:</strong> {msg.content}
                </div>
              ))}
            </div>
          </div>
          
          <Button onClick={() => onComplete(flowResult.results!)} className="w-full">
            Continuar para Próxima Etapa
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header with Progress */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {getDomainIcon(currentQuestion?.domain || 'demographics')}
            <div>
              <h2 className="text-xl font-semibold">{flowResult.currentDomain}</h2>
              <p className="text-sm text-gray-600">{flowResult.currentLayer}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            ~{flowResult.estimatedTimeRemaining}min
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progresso</span>
            <span>{flowResult.progress}%</span>
          </div>
          <Progress value={flowResult.progress} className="h-2" />
        </div>
      </Card>

      {/* Current Question */}
      <Card className="p-8">
        {isProcessing ? (
          <div className="text-center space-y-4">
            <div className="animate-pulse">
              <div className="w-8 h-8 bg-blue-600 rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Processando sua resposta...</p>
            </div>
          </div>
        ) : currentQuestion ? (
          <div className="space-y-6">
            <div className="space-y-2">
              {currentQuestion.instrument && (
                <Badge variant="outline" className="text-xs">
                  {currentQuestion.instrument}
                </Badge>
              )}
              <h3 className="text-lg font-medium leading-relaxed">
                {currentQuestion.text}
              </h3>
              {currentQuestion.metadata?.sensitiveInfo && (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Esta informação é protegida e usada apenas para cálculos médicos
                  </AlertDescription>
                </Alert>
              )}
            </div>
            
            {renderQuestion()}
          </div>
        ) : (
          <div className="text-center text-gray-500">
            Preparando próxima pergunta...
          </div>
        )}
      </Card>

      {/* Domain Progress Indicator */}
      <div className="flex justify-center">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          Avaliação inteligente • Adaptada às suas respostas
        </div>
      </div>
    </div>
  );
}

// Helper Components
function MultiSelectQuestion({ question, onComplete }: { question: HealthQuestion, onComplete: (value: any[]) => void }) {
  const [selected, setSelected] = useState<any[]>([]);

  const toggleOption = (value: any) => {
    if (value === 'none') {
      // If "none" is selected, clear all others
      setSelected(['none']);
    } else {
      // If any other option is selected, remove "none"
      const newSelected = selected.filter(v => v !== 'none');
      if (selected.includes(value)) {
        setSelected(newSelected.filter(v => v !== value));
      } else {
        setSelected([...newSelected, value]);
      }
    }
  };

  return (
    <div className="space-y-3">
      {question.options?.map(option => (
        <Button
          key={option.value}
          variant={selected.includes(option.value) ? 'default' : 'outline'}
          onClick={() => toggleOption(option.value)}
          className="w-full justify-start py-3 text-left"
        >
          {option.emoji && <span className="mr-3">{option.emoji}</span>}
          {option.label}
          {selected.includes(option.value) && <span className="ml-auto">✓</span>}
        </Button>
      ))}
      
      {selected.length > 0 && (
        <Button 
          onClick={() => onComplete(selected)}
          className="w-full mt-4"
        >
          Continuar
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      )}
    </div>
  );
}

function TextInputQuestion({ question, onComplete }: { question: HealthQuestion, onComplete: (value: any) => void }) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    if (value.trim()) {
      const finalValue = question.type === 'number' ? parseFloat(value) : value;
      onComplete(finalValue);
    }
  };

  return (
    <div className="space-y-4">
      <input
        type={question.type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={question.type === 'number' ? 'Digite um número' : 'Digite sua resposta'}
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            handleSubmit();
          }
        }}
      />
      
      <Button 
        onClick={handleSubmit}
        disabled={!value.trim()}
        className="w-full"
      >
        Continuar
        <ChevronRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}