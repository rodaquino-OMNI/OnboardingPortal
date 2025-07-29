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
  Clock, 
  ChevronRight, 
  AlertTriangle,
  CheckCircle,
  Stethoscope,
  Activity
} from 'lucide-react';
import {
  LAYER_1_TRIAGE,
  LAYER_2_TARGETED,
  LAYER_3_SPECIALIZED,
  ProgressiveScreeningFlow,
  calculateWHO5Score,
  RESPONSE_TEMPLATES,
  type ScreeningLayer,
  type ScreeningQuestion,
  type ScreeningAction
} from '@/lib/health-screening-layers';

interface ProgressiveHealthScreeningProps {
  onComplete: (results: ScreeningResults) => void;
  onLayerChange?: (layer: string) => void;
}

interface ScreeningResults {
  layer: string;
  responses: Record<string, any>;
  scores: Record<string, number>;
  actions: ScreeningAction[];
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  recommendations: string[];
  nextSteps: string[];
}

export function ProgressiveHealthScreening({ 
  onComplete, 
  onLayerChange 
}: ProgressiveHealthScreeningProps) {
  const [flow] = useState(new ProgressiveScreeningFlow());
  const [currentLayer, setCurrentLayer] = useState<ScreeningLayer>(LAYER_1_TRIAGE);
  const [currentQuestion, setCurrentQuestion] = useState<ScreeningQuestion | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [layerProgress, setLayerProgress] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [conversationalMessages, setConversationalMessages] = useState<Array<{
    type: 'bot' | 'user';
    content: string;
    timestamp: Date;
  }>>([]);

  useEffect(() => {
    initializeScreening();
  }, []);

  useEffect(() => {
    const nextQ = flow.getNextQuestion();
    setCurrentQuestion(nextQ);
    
    // Update progress
    const totalQuestions = currentLayer.questions.length;
    const answeredQuestions = Object.keys(responses).filter(id => 
      currentLayer.questions.some(q => q.id === id)
    ).length;
    setLayerProgress((answeredQuestions / totalQuestions) * 100);
  }, [currentLayer, responses]);

  const initializeScreening = () => {
    // Add initial bot message
    addBotMessage(getLayerIntroMessage(LAYER_1_TRIAGE));
    setCurrentQuestion(LAYER_1_TRIAGE.questions[0]);
  };

  const getLayerIntroMessage = (layer: ScreeningLayer): string => {
    switch (layer.id) {
      case 'triage':
        return "Olá! Vamos fazer um check-up rápido do seu bem-estar. São apenas 3 perguntas simples:";
      case 'targeted':
        return "Vou fazer algumas perguntas adicionais para entender melhor como posso ajudá-lo:";
      case 'specialized':
        return "Para oferecer o melhor cuidado, preciso fazer uma avaliação mais detalhada. Isso me ajudará a conectá-lo com os recursos certos:";
      default:
        return "Vamos continuar sua avaliação de saúde.";
    }
  };

  const addBotMessage = (content: string) => {
    setConversationalMessages(prev => [...prev, {
      type: 'bot',
      content,
      timestamp: new Date()
    }]);
  };

  const addUserMessage = (content: string) => {
    setConversationalMessages(prev => [...prev, {
      type: 'user',
      content,
      timestamp: new Date()
    }]);
  };

  const handleResponse = async (value: any) => {
    if (!currentQuestion) return;

    // Store response
    const newResponses = { ...responses, [currentQuestion.id]: value };
    setResponses(newResponses);

    // Add user response to conversation
    const displayValue = typeof value === 'number' 
      ? value.toString() 
      : Array.isArray(value) 
        ? value.join(', ') 
        : value;
    addUserMessage(displayValue);

    // Process response through flow
    const nextLayerResult = await flow.processResponse(currentQuestion.id, value);

    if (nextLayerResult) {
      // Transition to next layer
      await transitionToLayer(nextLayerResult);
    } else if (flow.shouldProgressToNextLayer()) {
      // Check if current layer is complete
      completeCurrentLayer();
    } else {
      // Continue with next question in current layer
      const nextQ = flow.getNextQuestion();
      if (nextQ) {
        setCurrentQuestion(nextQ);
        addBotMessage(nextQ.text);
      }
    }
  };

  const transitionToLayer = async (layerId: string) => {
    setIsTransitioning(true);
    
    // Show transition message
    addBotMessage("Entendi. Vou fazer algumas perguntas adicionais...");
    
    // Wait for smooth transition
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Use flow to transition to new layer
    flow.transitionToLayer(layerId);
    const newLayer = flow.getCurrentLayer();
    setCurrentLayer(newLayer);
    onLayerChange?.(layerId);
    
    // Reset progress for new layer
    setLayerProgress(0);
    
    // Add new layer intro
    addBotMessage(getLayerIntroMessage(newLayer));
    
    setIsTransitioning(false);
  };

  const completeCurrentLayer = () => {
    // Calculate scores
    const scores = calculateScores();
    
    // Determine risk level
    const riskLevel = determineRiskLevel(scores);
    
    // Get triggered actions
    const actions = flow.getTriggeredActions();
    
    // Generate results
    const results: ScreeningResults = {
      layer: currentLayer.id,
      responses,
      scores,
      actions,
      riskLevel,
      recommendations: generateRecommendations(riskLevel, scores),
      nextSteps: generateNextSteps(riskLevel, actions)
    };

    // Show completion message
    const template = RESPONSE_TEMPLATES[riskLevel] || RESPONSE_TEMPLATES.moderate_risk;
    addBotMessage(template.title);
    addBotMessage(template.message);

    setShowResults(true);
    onComplete(results);
  };

  const calculateScores = (): Record<string, number> => {
    const scores: Record<string, number> = {};
    
    // Calculate WHO-5 if all questions are available
    const who5Questions = ['who5_1', 'who5_2', 'who5_3', 'who5_4', 'who5_5'];
    const who5Responses = who5Questions.filter(q => responses[q] !== undefined);
    if (who5Responses.length === who5Questions.length) {
      scores.who5 = calculateWHO5Score(responses);
      // Add computed WHO-5 score to responses for trigger evaluation
      responses.who5_score = scores.who5;
    }
    
    // Calculate pain severity
    if (responses.pain_now !== undefined) {
      scores.pain_severity = responses.pain_now;
    }
    
    // Calculate pain interference (PEG score)
    if (responses.pain_work !== undefined && responses.pain_mood !== undefined && responses.pain_sleep !== undefined) {
      scores.pain_interference = (responses.pain_work + responses.pain_mood + responses.pain_sleep) / 3;
    }
    
    // Calculate PHQ-2
    if (responses.phq2_interest !== undefined) {
      scores.phq2 = responses.phq2_interest + (responses.phq2_depressed || 0);
    }
    
    // Calculate GAD-2
    if (responses.gad2_nervous !== undefined) {
      scores.gad2 = responses.gad2_nervous + (responses.gad2_worry || 0);
    }

    return scores;
  };

  const determineRiskLevel = (scores: Record<string, number>): 'low' | 'moderate' | 'high' | 'critical' => {
    // Critical risk indicators
    if (responses.phq9_suicide > 0) return 'critical';
    
    // High risk indicators
    if (scores.who5 <= 28 || scores.pain_interference >= 7) return 'high';
    
    // Moderate risk indicators
    if (scores.who5 <= 50 || scores.pain_severity >= 4 || scores.phq2 >= 1 || scores.gad2 >= 1) {
      return 'moderate';
    }
    
    return 'low';
  };

  const generateRecommendations = (riskLevel: string, scores: Record<string, number>): string[] => {
    const recommendations = [];
    
    if (scores.pain_severity >= 4) {
      recommendations.push("Considere técnicas de manejo da dor como relaxamento e atividade física leve");
    }
    
    if (scores.who5 <= 50) {
      recommendations.push("Atividades que promovem bem-estar mental podem ser benéficas");
    }
    
    if (riskLevel === 'high' || riskLevel === 'critical') {
      recommendations.push("Recomendamos acompanhamento profissional especializado");
    }
    
    return recommendations;
  };

  const generateNextSteps = (riskLevel: string, actions: ScreeningAction[]): string[] => {
    const steps = [];
    
    switch (riskLevel) {
      case 'critical':
        steps.push("Contato com equipe clínica nas próximas 2 horas");
        steps.push("Recursos de crise disponibilizados");
        break;
      case 'high':
        steps.push("Profissional entrará em contato em 24 horas");
        steps.push("Agendamento prioritário disponível");
        break;
      case 'moderate':
        steps.push("Recursos de autoajuda personalizados");
        steps.push("Acompanhamento em 1 semana");
        break;
      default:
        steps.push("Dicas de bem-estar personalizadas");
        steps.push("Próximo check-up em 1 mês");
    }
    
    return steps;
  };

  const renderQuestion = () => {
    if (!currentQuestion || isTransitioning) return null;

    switch (currentQuestion.type) {
      case 'scale':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>0 - Nenhuma</span>
                <span>10 - Máxima</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={responses[currentQuestion.id] || 0}
                onChange={(e) => handleResponse(parseInt(e.target.value))}
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="mt-4 text-4xl">
                {currentQuestion.options?.[responses[currentQuestion.id] || 0]?.emoji}
              </div>
              <div className="text-2xl font-bold text-blue-600 mt-2">
                {responses[currentQuestion.id] || 0}
              </div>
            </div>
            <Button 
              onClick={() => handleResponse(responses[currentQuestion.id] || 0)}
              className="w-full"
              disabled={responses[currentQuestion.id] === undefined}
            >
              Continuar
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        );

      case 'select':
        return (
          <div className="space-y-3">
            {currentQuestion.options?.map(option => (
              <Button
                key={option.value}
                variant={responses[currentQuestion.id] === option.value ? 'default' : 'outline'}
                onClick={() => handleResponse(option.value)}
                className="w-full justify-start py-4 text-left"
              >
                {option.emoji && <span className="mr-3 text-lg">{option.emoji}</span>}
                {option.label}
              </Button>
            ))}
          </div>
        );

      default:
        return <div>Tipo de pergunta não suportado</div>;
    }
  };

  const getLayerIcon = (layerId: string) => {
    switch (layerId) {
      case 'triage': return <Stethoscope className="w-5 h-5" />;
      case 'targeted': return <Heart className="w-5 h-5" />;
      case 'specialized': return <Brain className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  const getEstimatedTime = () => {
    const remaining = currentLayer.questions.length - Object.keys(responses).filter(id => 
      currentLayer.questions.some(q => q.id === id)
    ).length;
    return Math.ceil((remaining * currentLayer.estimatedSeconds) / currentLayer.questions.length);
  };

  if (showResults) {
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
            <h3 className="font-semibold mb-2">Conversa Completa:</h3>
            <div className="max-h-32 overflow-y-auto space-y-2 text-sm">
              {conversationalMessages.map((msg, idx) => (
                <div key={idx} className={`${msg.type === 'bot' ? 'text-blue-600' : 'text-gray-700'}`}>
                  <strong>{msg.type === 'bot' ? '🤖' : '👤'}:</strong> {msg.content}
                </div>
              ))}
            </div>
          </div>
          
          <Button onClick={() => window.location.href = '/document-upload'} className="w-full">
            Continuar para Próxima Etapa
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {getLayerIcon(currentLayer.id)}
            <div>
              <h2 className="text-xl font-semibold">{currentLayer.name}</h2>
              <p className="text-sm text-gray-600">{currentLayer.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            ~{getEstimatedTime()}s
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progresso da Seção</span>
            <span>{Math.round(layerProgress)}%</span>
          </div>
          <Progress value={layerProgress} className="h-2" />
        </div>
      </Card>

      {/* Current Question */}
      <Card className="p-8">
        {isTransitioning ? (
          <div className="text-center space-y-4">
            <div className="animate-pulse">
              <div className="w-8 h-8 bg-blue-600 rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Preparando próximas perguntas...</p>
            </div>
          </div>
        ) : currentQuestion ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <Badge variant="outline" className="text-xs">
                {currentQuestion.instrument}
              </Badge>
              <h3 className="text-lg font-medium leading-relaxed">
                {currentQuestion.text}
              </h3>
            </div>
            
            {renderQuestion()}
          </div>
        ) : (
          <div className="text-center text-gray-500">
            Carregando próxima pergunta...
          </div>
        )}
      </Card>

      {/* Layer Progress Indicator */}
      <div className="flex justify-center space-x-4">
        {[
          { id: 'triage', name: 'Triagem', icon: Stethoscope },
          { id: 'targeted', name: 'Direcionada', icon: Heart },
          { id: 'specialized', name: 'Especializada', icon: Brain }
        ].map(({ id, name, icon: Icon }) => {
          const isActive = currentLayer.id === id;
          const isPast = ['triage', 'targeted'].indexOf(currentLayer.id) > ['triage', 'targeted'].indexOf(id);
          
          return (
            <div key={id} className={`flex flex-col items-center space-y-1 ${
              isActive ? 'text-blue-600' : isPast ? 'text-green-600' : 'text-gray-400'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                isActive ? 'border-blue-600 bg-blue-50' : 
                isPast ? 'border-green-600 bg-green-50' : 
                'border-gray-300'
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium">{name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}