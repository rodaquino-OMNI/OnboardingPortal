'use client';

import { useState, useEffect } from 'react';
import { 
  Shield, 
  Trophy, Sparkles, ChevronRight,
  Info, Lock, Eye, EyeOff, Clock, User, Stethoscope,
  MessageCircle, Zap, Award, HeartHandshake
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Enhanced UX for Health Questionnaire - Combines best of all implementations
// Features: Conversational flow + Progressive disclosure + Intelligent validation + Emotional support

interface EnhancedHealthQuestionnaireProps {
  onComplete: (data: Record<string, unknown>) => void;
  userId?: string;
  progressiveResults?: Record<string, unknown>;
}

interface ConversationMessage {
  type: 'bot' | 'user' | 'system';
  content: string;
  timestamp: Date;
  emotion?: 'neutral' | 'supportive' | 'concerned' | 'celebrating';
  metadata?: any;
}

interface EmotionalContext {
  anxietyLevel: number; // 0-10
  trustLevel: number; // 0-100
  engagementLevel: number; // 0-100
  supportNeeded: boolean;
}

export function EnhancedHealthQuestionnaire({ onComplete, userId, progressiveResults }: EnhancedHealthQuestionnaireProps) {
  // State Management
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [emotionalContext, setEmotionalContext] = useState<EmotionalContext>({
    anxietyLevel: 3,
    trustLevel: 80,
    engagementLevel: 70,
    supportNeeded: false
  });
  const [isTyping, setIsTyping] = useState(false);
  const [showPrivacyMode, setShowPrivacyMode] = useState(false);
  const [currentDomain, setCurrentDomain] = useState('Bem-vindo');
  const [overallProgress, setOverallProgress] = useState(0);
  const [flowState, setFlowState] = useState<'intro' | 'screening' | 'deep_dive' | 'validation' | 'complete'>('intro');

  // Enhanced UX Patterns
  const [microAnimations, setMicroAnimations] = useState(true);
  const [celebrationMode, setCelebrationMode] = useState(false);
  const [adaptivePersonalization, setAdaptivePersonalization] = useState({
    preferredQuestionStyle: 'conversational', // 'conversational' | 'direct' | 'clinical'
    pacePreference: 'moderate', // 'slow' | 'moderate' | 'fast' 
    supportLevel: 'standard' // 'minimal' | 'standard' | 'high'
  });

  // Initialize conversation with warm, supportive approach
  useEffect(() => {
    initializeConversation();
  }, []);

  const initializeConversation = async () => {
    const welcomeMessages = [
      {
        type: 'bot' as const,
        content: `Olá! 👋 Sou sua assistente de saúde inteligente. Vou te fazer algumas perguntas sobre seu bem-estar de forma conversacional e amigável.`,
        timestamp: new Date(),
        emotion: 'supportive' as const
      },
      {
        type: 'bot' as const,
        content: `🔒 Suas informações são 100% confidenciais e protegidas. Você pode pausar, voltar ou pular perguntas a qualquer momento.`,
        timestamp: new Date(),
        emotion: 'neutral' as const
      },
      {
        type: 'bot' as const,
        content: `Vamos começar com algo simples - como você está se sentindo hoje em uma escala de 1 a 10? ✨`,
        timestamp: new Date(),
        emotion: 'supportive' as const
      }
    ];

    for (let i = 0; i < welcomeMessages.length; i++) {
      await new Promise(resolve => setTimeout(resolve, i * 1500));
      setConversationHistory(prev => [...prev, welcomeMessages[i]]);
    }

    // Start with first question
    setCurrentQuestion({
      id: 'initial_feeling',
      text: 'Como você está se sentindo hoje?',
      type: 'scale',
      domain: 'initial_assessment',
      supportive: true,
      options: Array.from({length: 11}, (_, i) => ({
        value: i,
        label: i.toString(),
        emoji: i <= 3 ? '😔' : i <= 6 ? '😐' : i <= 8 ? '🙂' : '😊'
      }))
    });
  };

  // Enhanced response handler with emotional intelligence
  const handleResponse = async (value: any) => {
    if (!currentQuestion) return;

    // Add user response to conversation
    const userMessage: ConversationMessage = {
      type: 'user',
      content: formatResponseForDisplay(currentQuestion, value),
      timestamp: new Date()
    };
    setConversationHistory(prev => [...prev, userMessage]);

    // Store response
    const newResponses = { ...responses, [currentQuestion.id]: value };
    setResponses(newResponses);

    // Update emotional context based on response
    updateEmotionalContext(currentQuestion, value);

    // Show typing indicator
    setIsTyping(true);
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));
    setIsTyping(false);

    // Generate contextual bot response
    const botResponse = generateContextualResponse(currentQuestion, value);
    setConversationHistory(prev => [...prev, botResponse]);

    // Progress to next question with intelligent flow
    await progressToNextQuestion(newResponses);
  };

  // Emotional intelligence - adapts based on user responses
  const updateEmotionalContext = (question: any, value: any) => {
    setEmotionalContext(prev => {
      const newContext = { ...prev };

      // Adjust based on question type and response
      if (question.id === 'initial_feeling' && value <= 4) {
        newContext.anxietyLevel = Math.min(prev.anxietyLevel + 2, 10);
        newContext.supportNeeded = true;
      }

      // Mental health questions require more support
      if (question.domain === 'mental_health' && value > 2) {
        newContext.supportNeeded = true;
      }

      // Build trust through consistent interaction
      if (question.type === 'validation') {
        newContext.trustLevel = Math.min(prev.trustLevel + 5, 100);
      }

      return newContext;
    });
  };

  // Generate emotionally intelligent responses
  const generateContextualResponse = (question: any, value: any): ConversationMessage => {
    let content = '';
    let emotion: 'neutral' | 'supportive' | 'concerned' | 'celebrating' = 'neutral';

    // High-level emotional response generation
    if (question.id === 'initial_feeling') {
      if (value >= 8) {
        content = "Que ótimo saber que você está se sentindo bem! 😊 Vamos continuar com algumas perguntas sobre sua saúde.";
        emotion = 'celebrating';
      } else if (value >= 5) {
        content = "Entendo, um dia normal. Obrigada por compartilhar! Vamos ver como posso ajudar você a se sentir ainda melhor.";
        emotion = 'supportive';
      } else {
        content = "Sinto muito que você não esteja se sentindo tão bem hoje. 💙 Suas respostas me ajudarão a entender melhor como posso apoiá-lo.";
        emotion = 'concerned';
        setEmotionalContext(prev => ({ ...prev, supportNeeded: true }));
      }
    }

    // Add contextual follow-ups based on emotional state
    if (emotionalContext.supportNeeded) {
      content += "\n\n🤗 Lembre-se: não há respostas certas ou erradas. Estou aqui para ajudar.";
    }

    return {
      type: 'bot',
      content,
      timestamp: new Date(),
      emotion
    };
  };

  // Intelligent flow progression with adaptive branching
  const progressToNextQuestion = async (currentResponses: Record<string, any>) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Intelligent question selection based on previous responses
    const nextQuestion = selectNextQuestion(currentResponses);
    
    if (nextQuestion) {
      setCurrentQuestion(nextQuestion);
      setOverallProgress(prev => Math.min(prev + (100 / 20), 100)); // Assuming ~20 questions
    } else {
      // Complete the questionnaire
      completeQuestionnaire(currentResponses);
    }
  };

  // Smart question selection algorithm
  const selectNextQuestion = (responses: Record<string, any>) => {
    // This would be a more sophisticated algorithm in production
    // For now, simple progression through domains

    if (!responses.mental_health_quick && responses.initial_feeling <= 6) {
      return {
        id: 'mental_health_quick',
        text: 'Nas últimas 2 semanas, você teve pouco interesse ou prazer em fazer as coisas?',
        type: 'select',
        domain: 'mental_health',
        instrument: 'PHQ-2',
        options: [
          { value: 0, label: 'Nunca', emoji: '✅' },
          { value: 1, label: 'Vários dias', emoji: '🤔' },
          { value: 2, label: 'Mais da metade dos dias', emoji: '😔' },
          { value: 3, label: 'Quase todos os dias', emoji: '😢' }
        ]
      };
    }

    if (!responses.pain_assessment) {
      return {
        id: 'pain_assessment',
        text: 'Você tem sentido alguma dor física recentemente?',
        type: 'boolean',
        domain: 'physical_health'
      };
    }

    // Continue with more questions...
    return null; // End questionnaire
  };

  // Format response for conversation display
  const formatResponseForDisplay = (question: any, value: any): string => {
    if (question.type === 'scale') {
      const emoji = question.options?.find((opt: any) => opt.value === value)?.emoji || '';
      return `${value}/10 ${emoji}`;
    }
    
    if (question.type === 'select') {
      const option = question.options?.find((opt: any) => opt.value === value);
      return option?.label || value.toString();
    }
    
    if (question.type === 'boolean') {
      return value ? 'Sim' : 'Não';
    }
    
    return value.toString();
  };

  // Complete questionnaire with celebration
  const completeQuestionnaire = async (finalResponses: Record<string, any>) => {
    setFlowState('complete');
    setCelebrationMode(true);

    const completionMessage: ConversationMessage = {
      type: 'bot',
      content: '🎉 Parabéns! Você completou sua avaliação de saúde. Suas respostas nos ajudarão a criar um plano personalizado para seu bem-estar!',
      timestamp: new Date(),
      emotion: 'celebrating'
    };

    setConversationHistory(prev => [...prev, completionMessage]);

    // Prepare results with enhanced analytics
    const results = {
      responses: finalResponses,
      emotionalContext,
      conversationFlow: conversationHistory,
      completionTime: new Date(),
      engagementMetrics: {
        questionsAnswered: Object.keys(finalResponses).length,
        averageResponseTime: 3.5, // Would track real time
        emotionalSupport: emotionalContext.supportNeeded,
        trustLevel: emotionalContext.trustLevel
      }
    };

    setTimeout(() => {
      onComplete(results);
    }, 2000);
  };

  // Render current question with enhanced UX
  const renderQuestion = () => {
    if (!currentQuestion) return null;

    switch (currentQuestion.type) {
      case 'scale':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="flex justify-between text-sm text-gray-600 mb-4">
                <span>1 - Muito mal</span>
                <span>10 - Excelente</span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="1"
                  max="10"
                  defaultValue="5"
                  onChange={(e) => handleResponse(parseInt(e.target.value))}
                  className="w-full h-4 bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-2xl mt-4">
                  {currentQuestion.options?.slice(1, 10).map((opt: any, idx: number) => (
                    <span key={idx}>{opt.emoji}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'select':
        return (
          <div className="space-y-3">
            {currentQuestion.options?.map((option: any) => (
              <Button
                key={option.value}
                variant="outline"
                onClick={() => handleResponse(option.value)}
                className="w-full justify-start py-4 text-left hover:bg-blue-50 transition-all duration-200 hover:scale-[1.02]"
              >
                {option.emoji && <span className="mr-3 text-lg">{option.emoji}</span>}
                <div>
                  <div className="font-medium">{option.label}</div>
                  {option.description && (
                    <div className="text-sm text-gray-600">{option.description}</div>
                  )}
                </div>
              </Button>
            ))}
          </div>
        );

      case 'boolean':
        return (
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={() => handleResponse(true)}
              className="py-8 text-lg hover:bg-green-50 transition-all duration-200 hover:scale-[1.02]"
            >
              <span className="mr-2">✅</span>
              Sim
            </Button>
            <Button
              variant="outline"
              onClick={() => handleResponse(false)}
              className="py-8 text-lg hover:bg-red-50 transition-all duration-200 hover:scale-[1.02]"
            >
              <span className="mr-2">❌</span>
              Não
            </Button>
          </div>
        );

      default:
        return <div>Tipo de pergunta não suportado</div>;
    }
  };

  // Enhanced conversation display
  const renderConversation = () => (
    <div className="space-y-4 max-h-96 overflow-y-auto">
      {conversationHistory.map((message, index) => (
        <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[80%] p-4 rounded-2xl ${
            message.type === 'user' 
              ? 'bg-blue-600 text-white' 
              : message.emotion === 'celebrating'
                ? 'bg-gradient-to-r from-green-50 to-blue-50 border border-green-200'
                : message.emotion === 'concerned'
                  ? 'bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200'
                  : 'bg-gray-50 border border-gray-200'
          }`}>
            <div className="flex items-start gap-2">
              {message.type === 'bot' && (
                <span className="text-xl">
                  {message.emotion === 'celebrating' ? '🎉' : 
                   message.emotion === 'concerned' ? '💙' : 
                   message.emotion === 'supportive' ? '🤗' : '🤖'}
                </span>
              )}
              <div className="text-sm leading-relaxed whitespace-pre-line">
                {message.content}
              </div>
            </div>
          </div>
        </div>
      ))}
      
      {isTyping && (
        <div className="flex justify-start">
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (flowState === 'complete') {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-8">
          <div className="text-center space-y-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
              celebrationMode ? 'bg-gradient-to-r from-green-400 to-blue-400' : 'bg-green-100'
            }`}>
              <Trophy className="w-8 h-8 text-white" />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                🎉 Avaliação Concluída!
              </h2>
              <p className="text-gray-600">
                Obrigado por compartilhar suas informações de saúde conosco. 
                Sua abertura nos ajuda a oferecer o melhor cuidado possível.
              </p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <HeartHandshake className="w-5 h-5" />
                Sua Jornada de Saúde
              </h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{Object.keys(responses).length}</div>
                  <div className="text-gray-600">Perguntas Respondidas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{emotionalContext.trustLevel}%</div>
                  <div className="text-gray-600">Nível de Confiança</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{emotionalContext.engagementLevel}%</div>
                  <div className="text-gray-600">Engajamento</div>
                </div>
              </div>
            </div>
            
            <Button onClick={() => onComplete(responses)} className="w-full" size="lg">
              Continuar para Próxima Etapa
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Enhanced Header with Emotional Support */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Stethoscope className="w-6 h-6 text-blue-600" />
              </div>
              {emotionalContext.supportNeeded && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-400 rounded-full flex items-center justify-center">
                  <HeartHandshake className="w-2 h-2 text-white" />
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Avaliação Inteligente de Saúde</h2>
              <p className="text-sm text-gray-600">{currentDomain}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-xs">
              <Shield className="w-3 h-3 mr-1" />
              Confiança: {emotionalContext.trustLevel}%
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Zap className="w-3 h-3 mr-1" />
              Progresso: {Math.round(overallProgress)}%
            </Badge>
          </div>
        </div>
        
        <Progress value={overallProgress} className="h-2 mt-4" />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversation Flow */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold">Nossa Conversa</h3>
          </div>
          {renderConversation()}
        </Card>

        {/* Current Question */}
        <Card className="p-6">
          {currentQuestion && !isTyping ? (
            <div className="space-y-6">
              <div className="space-y-2">
                {currentQuestion.instrument && (
                  <Badge variant="outline" className="text-xs">
                    <Sparkles className="w-3 h-3 mr-1" />
                    {currentQuestion.instrument}
                  </Badge>
                )}
                <h3 className="text-lg font-medium leading-relaxed">
                  {currentQuestion.text}
                </h3>
                {emotionalContext.supportNeeded && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <HeartHandshake className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      🤗 Não há respostas certas ou erradas. Responda como se sente confortável.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              
              {renderQuestion()}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <div className="animate-pulse">
                <div className="w-8 h-8 bg-blue-600 rounded-full mx-auto mb-4"></div>
                <p>Preparando próxima pergunta...</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Emotional Support Footer */}
      {emotionalContext.supportNeeded && (
        <Card className="p-4 bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <HeartHandshake className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">Apoio Disponível</span>
            </div>
            <p className="text-xs text-orange-700">
              💙 Se você precisar de apoio imediato: CVV - 188 (24h) • 
              🔒 Suas informações são confidenciais e seguras
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}