'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle,
  Brain,
  Heart,
  User,
  Activity,
  Shield,
  Bot,
  UserIcon
} from 'lucide-react';
import { 
  HealthSession, 
  HealthSessionManager, 
  SessionQuestion
} from '@/lib/session-based-health-assessment';

interface ConversationalSessionComponentProps {
  session: HealthSession;
  sessionManager: HealthSessionManager;
  onComplete: () => void;
  onBack: () => void;
}

interface ConversationMessage {
  type: 'bot' | 'user';
  content: string;
  timestamp: Date;
  questionId?: string;
}

export function ConversationalSessionComponent({ 
  session, 
  sessionManager, 
  onComplete, 
  onBack 
}: ConversationalSessionComponentProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string | number | boolean | string[]>>({});
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [responseStartTime, setResponseStartTime] = useState<Date | null>(null);
  // const [detectionFlags] = useState<DetectionFlag[]>([]);
  const [showingResults, setShowingResults] = useState(false);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const currentQuestion = session.questions[currentQuestionIndex];
  const progress = (currentQuestionIndex / session.questions.length) * 100;

  useEffect(() => {
    initializeSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom of conversation
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  useEffect(() => {
    // Start timing when question appears
    if (currentQuestion && !isProcessing) {
      setResponseStartTime(new Date());
    }
  }, [currentQuestionIndex, isProcessing, currentQuestion]);

  const initializeSession = () => {
    addBotMessage(getSessionIntroMessage());
    if (session.questions.length > 0) {
      setTimeout(() => {
        addBotMessage(session.questions[0].text);
      }, 1000);
    }
  };

  const getSessionIntroMessage = (): string => {
    const messages = {
      basic_info: "Olá! Vamos começar com algumas informações básicas sobre você. Isso me ajudará a personalizar as próximas perguntas.",
      pain_physical: "Agora vamos conversar sobre como seu corpo está se sentindo. Não se preocupe - quanto mais honesto você for, melhor posso ajudá-lo.",
      mental_health: "Esta parte é sobre seu bem-estar emocional. Lembre-se: é normal passar por momentos difíceis, e falar sobre isso é o primeiro passo para se sentir melhor.",
    };
    return messages[session.id as keyof typeof messages] || `Vamos conversar sobre ${session.title.toLowerCase()}. Suas respostas me ajudam a entender melhor como cuidar da sua saúde.`;
  };

  const addBotMessage = (content: string, questionId?: string) => {
    setConversation(prev => [...prev, {
      type: 'bot',
      content,
      timestamp: new Date(),
      questionId
    }]);
  };

  const addUserMessage = (content: string, questionId?: string) => {
    setConversation(prev => [...prev, {
      type: 'user',
      content,
      timestamp: new Date(),
      questionId
    }]);
  };

  const handleResponse = async (value: string | number | boolean | string[]) => {
    if (!currentQuestion || isProcessing) return;

    setIsProcessing(true);

    // Calculate response time
    const responseTime = responseStartTime 
      ? (new Date().getTime() - responseStartTime.getTime()) / 1000 
      : 0;

    // Check for emergency situations that should stop the questionnaire
    if (currentQuestion.id === 'emergency_symptoms' && Array.isArray(value) && !value.includes('none')) {
      handleEmergencyAlert(value);
      return;
    }

    if (currentQuestion.id === 'harmful_thoughts' && value === true) {
      handleEmergencyAlert(['harmful_thoughts']);
      return;
    }

    // Store response
    const newResponses = { ...responses, [currentQuestion.id]: value };
    setResponses(newResponses);

    // Record in session manager for detection
    sessionManager.recordResponse(session.id, currentQuestion.id, value, responseTime);

    // Add user response to conversation
    const displayValue = formatResponseForDisplay(currentQuestion, value);
    addUserMessage(displayValue, currentQuestion.id);

    // Add bot acknowledgment and transition
    const acknowledgment = generateAcknowledgment(currentQuestion, value);
    setTimeout(() => {
      addBotMessage(acknowledgment);
      
      setTimeout(() => {
        moveToNextQuestion();
      }, 1000);
    }, 500);
  };

  const formatResponseForDisplay = (question: SessionQuestion, value: string | number | boolean | string[]): string => {
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

  const generateAcknowledgment = (question: SessionQuestion, value: string | number | boolean | string[]): string => {
    // Generate contextual acknowledgments based on question type and sensitivity
    if (question.metadata.sensitiveLevel === 'critical' && value) {
      return "Obrigado por compartilhar isso comigo. É importante que você saiba que não está sozinho.";
    }

    if (question.metadata.sensitiveLevel === 'high') {
      return "Entendo. Obrigado por ser honesto comigo.";
    }

    if (question.type === 'scale' && typeof value === 'number') {
      if (value === 0) return "Ótimo!";
      if (value <= 3) return "Entendi.";
      if (value <= 6) return "Vou anotar isso.";
      return "Obrigado por me contar.";
    }

    const acknowledgments = [
      "Perfeito.",
      "Entendi.",
      "Anotado.",
      "Obrigado.",
      "Certo."
    ];
    
    return acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
  };

  const moveToNextQuestion = () => {
    if (currentQuestionIndex < session.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      const nextQuestion = session.questions[currentQuestionIndex + 1];
      
      setTimeout(() => {
        addBotMessage(nextQuestion.text, nextQuestion.id);
        setIsProcessing(false);
      }, 800);
    } else {
      completeSession();
    }
  };

  const handleEmergencyAlert = (emergencyValues: string[]) => {
    let emergencyMessage = "";
    
    if (emergencyValues.includes('harmful_thoughts')) {
      emergencyMessage = "Obrigado por compartilhar isso comigo. É muito importante que você saiba que não está sozinho e que existem pessoas que querem te ajudar. Por favor, procure ajuda médica ou entre em contato com o CVV (188) imediatamente.";
    } else {
      emergencyMessage = "Com base nos sintomas que você relatou, é muito importante que procure atendimento médico imediatamente. Não ignore estes sinais - sua saúde e segurança são prioridade.";
    }
    
    addBotMessage(emergencyMessage);
    
    setTimeout(() => {
      setShowingResults(true);
      setIsProcessing(false);
    }, 3000);
  };

  const completeSession = () => {
    addBotMessage("Perfeito! Você completou esta sessão. Obrigado por compartilhar essas informações importantes.");
    
    setTimeout(() => {
      setShowingResults(true);
      setIsProcessing(false);
    }, 1000);
  };

  const renderQuestion = () => {
    if (!currentQuestion || isProcessing || showingResults) return null;

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
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
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
                className="w-full justify-start py-4 text-left hover:bg-blue-50 transition-colors"
              >
                {option.emoji && <span className="mr-3 text-lg">{option.emoji}</span>}
                {option.label}
              </Button>
            ))}
          </div>
        );

      case 'multiselect':
        return (
          <MultiSelectQuestion 
            question={currentQuestion}
            onComplete={handleResponse}
          />
        );

      case 'boolean':
        return (
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={() => handleResponse(true)}
              className="py-8 text-lg hover:bg-green-50 transition-colors"
            >
              ✅ Sim
            </Button>
            <Button
              variant="outline"
              onClick={() => handleResponse(false)}
              className="py-8 text-lg hover:bg-red-50 transition-colors"
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

  const getSessionIcon = () => {
    switch (session.category) {
      case 'emergency': return <User className="w-5 h-5" />;
      case 'physical': return <Heart className="w-5 h-5" />;
      case 'mental': return <Brain className="w-5 h-5" />;
      case 'history': return <Clock className="w-5 h-5" />;
      case 'lifestyle': return <Activity className="w-5 h-5" />;
      case 'validation': return <Shield className="w-5 h-5" />;
      default: return <User className="w-5 h-5" />;
    }
  };

  if (showingResults) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card className="p-8">
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {session.icon} {session.title} Completa!
                </h2>
                <p className="text-gray-600">
                  Obrigado por completar esta sessão. Suas respostas foram salvas com segurança.
                </p>
              </div>

              {session.completionRewards && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <h3 className="font-semibold text-yellow-800 mb-2">🏆 Recompensas Desbloqueadas!</h3>
                  <div className="flex items-center justify-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">+{session.completionRewards.points} pontos</span>
                    </div>
                    {session.completionRewards.badges.map(badge => (
                      <Badge key={badge} className="bg-yellow-600">
                        {badge}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button variant="outline" onClick={onBack} className="flex-1">
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Voltar ao Dashboard
                </Button>
                <Button onClick={onComplete} className="flex-1">
                  Próxima Sessão
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {getSessionIcon()}
              <div>
                <h2 className="text-xl font-semibold">{session.icon} {session.title}</h2>
                <p className="text-sm text-gray-600">{session.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              ~{session.estimatedMinutes} min
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progresso da Sessão</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Conversation Area */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              💬 Conversa
            </h3>
            
            <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
              {conversation.map((message, index) => (
                <div key={index} className={`flex items-start gap-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    message.type === 'bot' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    {message.type === 'bot' ? (
                      <Bot className="w-4 h-4 text-blue-600" />
                    ) : (
                      <UserIcon className="w-4 h-4 text-gray-600" />
                    )}
                  </div>
                  
                  <div className={`max-w-xs p-3 rounded-lg ${
                    message.type === 'bot' 
                      ? 'bg-blue-50 text-blue-900' 
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={conversationEndRef} />
            </div>
          </Card>

          {/* Question Area */}
          <Card className="p-6">
            {currentQuestion && !isProcessing && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {currentQuestion.clinicalPurpose}
                    </Badge>
                    {currentQuestion.metadata.sensitiveLevel === 'critical' && (
                      <Badge variant="destructive" className="text-xs">
                        Importante
                      </Badge>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-medium leading-relaxed">
                    {currentQuestion.text}
                  </h3>
                  
                  {currentQuestion.metadata.sensitiveLevel === 'critical' && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Esta pergunta nos ajuda a garantir sua segurança e bem-estar
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                
                {renderQuestion()}
              </div>
            )}

            {isProcessing && (
              <div className="text-center space-y-4">
                <div className="animate-pulse">
                  <div className="w-8 h-8 bg-blue-600 rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-600">Processando sua resposta...</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function MultiSelectQuestion({ question, onComplete }: { question: SessionQuestion, onComplete: (value: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggleOption = (value: string) => {
    if (value === 'none') {
      setSelected(['none']);
    } else {
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
      <p className="text-sm text-gray-600 mb-4">
        Selecione todas as opções que se aplicam:
      </p>
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

function TextInputQuestion({ question, onComplete }: { question: SessionQuestion, onComplete: (value: string) => void }) {
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