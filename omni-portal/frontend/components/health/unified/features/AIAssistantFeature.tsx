'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Sparkles, Brain, Heart } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuestionnaire, QuestionnaireFeature, FeatureHooks } from '../BaseHealthQuestionnaire';
import { HealthQuestion, QuestionValue } from '@/types/health';

interface AIMessage {
  type: 'bot' | 'user' | 'system';
  content: string;
  timestamp: Date;
  emotion?: 'neutral' | 'supportive' | 'concerned' | 'celebrating';
  metadata?: any;
}

interface AIAssistantConfig {
  enabled: boolean;
  personality: 'professional' | 'friendly' | 'empathetic';
  contextualResponses: boolean;
  emotionalIntelligence: boolean;
  smartSuggestions: boolean;
}

export function AIAssistantFeature({ config }: { config?: AIAssistantConfig }) {
  const { state, getCurrentQuestion } = useQuestionnaire();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [emotionalContext, setEmotionalContext] = useState({
    anxietyLevel: 3,
    trustLevel: 80,
    engagementLevel: 70,
    supportNeeded: false
  });

  const personality = config?.personality || 'friendly';
  const useEmotionalIntelligence = config?.emotionalIntelligence !== false;

  // Initialize with welcome message
  useEffect(() => {
    if (state.flowState === 'intro' && messages.length === 0) {
      setMessages([{
        type: 'bot',
        content: getWelcomeMessage(personality),
        timestamp: new Date(),
        emotion: 'supportive'
      }]);
    }
  }, [state.flowState, personality]);

  // Generate contextual responses based on question and answer
  const generateContextualResponse = useCallback((
    question: HealthQuestion | null,
    value: QuestionValue
  ): AIMessage | null => {
    if (!question || !config?.contextualResponses) return null;

    let content = '';
    let emotion: AIMessage['emotion'] = 'neutral';

    // Analyze response for emotional context
    if (useEmotionalIntelligence) {
      if (question.category === 'mental_health' && typeof value === 'number' && value > 2) {
        emotion = 'concerned';
        content = 'Obrigado por compartilhar isso comigo. Suas respostas são importantes e ajudarão a criar um plano de cuidados personalizado.';
        setEmotionalContext(prev => ({ ...prev, supportNeeded: true }));
      } else if (question.id === 'initial_feeling' && typeof value === 'number') {
        if (value >= 8) {
          emotion = 'celebrating';
          content = 'Que ótimo! É maravilhoso saber que você está se sentindo bem! 😊';
        } else if (value <= 4) {
          emotion = 'concerned';
          content = 'Sinto muito que você não esteja se sentindo tão bem. Estou aqui para ajudar. 💙';
        }
      }
    }

    // Add smart suggestions if enabled
    if (config?.smartSuggestions && question.metadata?.validatedTool) {
      content += `\n\n💡 Dica: Esta pergunta faz parte do ${question.metadata.validatedTool}, uma ferramenta clinicamente validada.`;
    }

    return content ? {
      type: 'bot',
      content,
      timestamp: new Date(),
      emotion
    } : null;
  }, [config, useEmotionalIntelligence]);

  // Monitor question changes
  useEffect(() => {
    const currentQuestion = getCurrentQuestion();
    if (currentQuestion && state.responses[currentQuestion.id] !== undefined) {
      const response = generateContextualResponse(
        currentQuestion, 
        state.responses[currentQuestion.id]
      );
      
      if (response) {
        setIsTyping(true);
        setTimeout(() => {
          setMessages(prev => [...prev, response]);
          setIsTyping(false);
        }, 800 + Math.random() * 700);
      }
    }
  }, [state.responses, getCurrentQuestion, generateContextualResponse]);

  return (
    <div className="ai-assistant-container">
      {/* AI Status Badge */}
      <div className="flex items-center justify-between mb-4">
        <Badge variant="outline" className="flex items-center gap-2">
          <Brain className="w-4 h-4" />
          Assistente IA {personality === 'empathetic' ? '💙' : ''}
        </Badge>
        
        {emotionalContext.supportNeeded && (
          <Badge variant="secondary" className="flex items-center gap-2">
            <Heart className="w-4 h-4" />
            Modo Suporte Ativo
          </Badge>
        )}
      </div>

      {/* Messages Display */}
      {messages.length > 0 && (
        <Card className="p-4 mb-4 bg-gradient-to-br from-blue-50 to-purple-50">
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {messages.slice(-3).map((msg, idx) => (
              <div 
                key={idx}
                className={`flex items-start gap-2 ${
                  msg.type === 'bot' ? 'text-blue-900' : 'text-gray-700'
                }`}
              >
                {msg.type === 'bot' && (
                  <Bot className="w-5 h-5 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="text-sm">{msg.content}</p>
                  {msg.emotion === 'concerned' && (
                    <p className="text-xs text-blue-600 mt-1">
                      🤗 Lembre-se: não há respostas certas ou erradas.
                    </p>
                  )}
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex items-center gap-2 text-gray-500">
                <Bot className="w-5 h-5" />
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Smart Suggestions */}
      {config?.smartSuggestions && emotionalContext.engagementLevel < 50 && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg mb-4">
          <Sparkles className="w-5 h-5 text-yellow-600" />
          <p className="text-sm text-yellow-800">
            Dica: Você pode pausar a qualquer momento e continuar mais tarde!
          </p>
        </div>
      )}
    </div>
  );
}

// Helper functions
function getWelcomeMessage(personality: string): string {
  switch (personality) {
    case 'professional':
      return 'Bem-vindo ao questionário de saúde. Vou guiá-lo através de perguntas importantes sobre seu bem-estar.';
    case 'empathetic':
      return 'Olá! 💙 Estou aqui para ajudá-lo em sua jornada de saúde. Suas respostas são confidenciais e importantes.';
    case 'friendly':
    default:
      return 'Olá! 👋 Sou sua assistente de saúde. Vamos fazer algumas perguntas de forma conversacional e amigável.';
  }
}

// Feature hooks for AI Assistant
export const aiAssistantHooks: FeatureHooks = {
  onInit: (state) => {
    console.log('[AI Assistant] Initialized with state:', state);
  },
  
  onQuestionChange: (question, state) => {
    // Analyze question context for AI preparation
    if (question.category === 'mental_health') {
      // Prepare supportive responses
    }
  },
  
  onResponseSubmit: (questionId, value, state) => {
    // AI can suggest follow-up questions or validate responses
    return null; // Return null to not modify the value
  },
  
  validateResponse: (question, value) => {
    // AI-powered validation for better UX
    if (question.type === 'text' && typeof value === 'string') {
      if (value.length < 3) {
        return 'Por favor, forneça uma resposta mais detalhada';
      }
    }
    return null;
  }
};

// Export feature definition
export const AIAssistantFeatureDefinition: QuestionnaireFeature = {
  id: 'ai-assistant',
  name: 'AI Assistant',
  enabled: true,
  priority: 90,
  component: AIAssistantFeature,
  hooks: aiAssistantHooks,
  config: {
    enabled: true,
    personality: 'friendly',
    contextualResponses: true,
    emotionalIntelligence: true,
    smartSuggestions: true
  }
};