'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Heart, 
  ChevronLeft, 
  ChevronRight, 
  MessageCircle, 
  Loader2, 
  Trophy,
  AlertCircle,
  CheckCircle,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useGamification } from '@/hooks/useGamification';
import api from '@/services/api';

interface QuestionnaireTemplate {
  id: number;
  name: string;
  code: string;
  description: string;
  estimated_minutes: number;
  sections: QuestionnaireSection[];
}

interface QuestionnaireSection {
  title: string;
  description: string;
  questions: Question[];
}

interface Question {
  id: string;
  text: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'scale' | 'textarea';
  required: boolean;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  scale?: {
    min: number;
    max: number;
    labels: string[];
  };
  placeholder?: string;
  follow_up?: {
    if: unknown;
    question: Question;
  };
}

interface AIResponse {
  response: string;
  confidence: number;
  follow_up_questions: string[];
  detected_conditions: string[];
  recommendations: string[];
}

export default function HealthQuestionnairePage() {
  const router = useRouter();
  const { } = useAuth();
  const { } = useGamification();

  // State management
  const [template, setTemplate] = useState<QuestionnaireTemplate | null>(null);
  const [questionnaireId, setQuestionnaireId] = useState<number | null>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // AI Chat state
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiMessages, setAiMessages] = useState<Array<{role: 'user' | 'ai', content: string}>>([]);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Gamification state
  const [pointsEarned, setPointsEarned] = useState(0);
  const [showPointsAnimation, setShowPointsAnimation] = useState(false);

  useEffect(() => {
    initializeQuestionnaire();
  }, []);

  const initializeQuestionnaire = async () => {
    try {
      setIsLoading(true);
      
      // Get available templates
      const templatesResponse = await api.get<QuestionnaireTemplate[]>('/health-questionnaires/templates');
      if (!templatesResponse.success) {
        throw new Error(templatesResponse.error.message);
      }
      const templates = templatesResponse.data;
      
      // Use the initial health assessment template
      const initialTemplate = templates.find((t: QuestionnaireTemplate) => t.code === 'initial_health_assessment');
      
      if (!initialTemplate) {
        throw new Error('Health questionnaire template not found');
      }

      setTemplate(initialTemplate);

      // Start the questionnaire
      const startResponse = await api.post<{ id: number }>('/health-questionnaires/start', {
        template_id: initialTemplate.id
      });

      if (!startResponse.success) {
        throw new Error(startResponse.error.message);
      }

      setQuestionnaireId(startResponse.data.id);
    } catch (error) {
      console.error('Failed to initialize questionnaire:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResponseChange = (questionId: string, value: unknown) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));

    // Clear error for this field
    if (errors[questionId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const validateSection = (sectionIndex: number): boolean => {
    if (!template) return false;

    const section = template.sections[sectionIndex];
    if (!section) return false;
    
    const newErrors: Record<string, string> = {};

    section.questions.forEach(question => {
      if (question.required && (!responses[question.id] || responses[question.id] === '')) {
        newErrors[question.id] = 'Campo obrigatório';
      }

      // Validation rules
      if (question.validation && responses[question.id]) {
        const value = Number(responses[question.id]);
        if (question.validation.min && value < question.validation.min) {
          newErrors[question.id] = `Valor mínimo: ${question.validation.min}`;
        }
        if (question.validation.max && value > question.validation.max) {
          newErrors[question.id] = `Valor máximo: ${question.validation.max}`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveSection = async (sectionIndex: number, isComplete: boolean = false) => {
    if (!questionnaireId || !template) return;

    try {
      setIsSaving(true);

      const sectionResponses: Record<string, unknown> = {};
      const section = template.sections[sectionIndex];
      if (!section) return;
      
      section.questions.forEach(question => {
        if (responses[question.id] !== undefined) {
          sectionResponses[question.id] = responses[question.id];
        }
      });

      await api.put(`/health-questionnaires/${questionnaireId}/responses`, {
        responses: sectionResponses,
        section_id: `section_${sectionIndex}`,
        is_complete: isComplete
      });

      // Award points for section completion
      const sectionPoints = 50;
      setPointsEarned(prev => prev + sectionPoints);
      setShowPointsAnimation(true);
      setTimeout(() => setShowPointsAnimation(false), 2000);

      // Update progress
      const newProgress = ((sectionIndex + 1) / template.sections.length) * 100;
      setProgress(newProgress);

      if (isComplete) {
        // Unlock completion badge
        // unlockBadge('health_questionnaire_complete');
        router.push('/document-upload');
      }
    } catch (error) {
      console.error('Failed to save section:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = async () => {
    if (!template) return;

    if (!validateSection(currentSection)) {
      return;
    }

    await saveSection(currentSection);

    if (currentSection < template.sections.length - 1) {
      setCurrentSection(prev => prev + 1);
    } else {
      // Complete questionnaire
      await saveSection(currentSection, true);
    }
  };

  const handlePrevious = () => {
    if (currentSection > 0) {
      setCurrentSection(prev => prev - 1);
    } else {
      router.push('/company-info');
    }
  };

  const handleAIQuestion = async () => {
    if (!aiInput.trim() || !questionnaireId) return;

    try {
      setIsAiLoading(true);
      
      // Add user message
      const userMessage = { role: 'user' as const, content: aiInput };
      setAiMessages(prev => [...prev, userMessage]);
      setAiInput('');

      // Get AI response
      const response = await api.post<AIResponse>(`/health-questionnaires/${questionnaireId}/ai-insights`, {
        question: aiInput,
        context: responses
      });

      if (!response.success) {
        throw new Error(response.error.message);
      }

      const aiResponse: AIResponse = response.data;
      
      // Add AI message
      const aiMessage = { role: 'ai' as const, content: aiResponse.response };
      setAiMessages(prev => [...prev, aiMessage]);

      // Show detected conditions if any
      if (aiResponse.detected_conditions.length > 0) {
        // Add a system message about detected conditions
        setAiMessages(prev => [...prev, {
          role: 'ai',
          content: `⚠️ Condições detectadas: ${aiResponse.detected_conditions.join(', ')}. Recomendo discutir com um profissional de saúde.`
        }]);
      }
    } catch (error) {
      console.error('AI question failed:', error);
      setAiMessages(prev => [...prev, {
        role: 'ai',
        content: 'Desculpe, não foi possível processar sua pergunta no momento. Tente novamente mais tarde.'
      }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const renderQuestion = (question: Question) => {
    const value = (responses[question.id] as string) || '';
    const hasError = !!errors[question.id];

    switch (question.type) {
      case 'text':
      case 'number':
        return (
          <Input
            type={question.type}
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            placeholder={question.placeholder}
            className={hasError ? 'border-red-500' : ''}
            aria-invalid={hasError}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            placeholder={question.placeholder}
            className={hasError ? 'border-red-500' : ''}
            aria-invalid={hasError}
            rows={3}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${hasError ? 'border-red-500' : ''}`}
            aria-invalid={hasError}
          >
            <option value="">Selecione uma opção...</option>
            {question.options?.map((option, index) => (
              <option key={index} value={option}>{option}</option>
            ))}
          </select>
        );

      case 'multiselect':
        const selectedValues = Array.isArray(responses[question.id]) ? (responses[question.id] as string[]) : [];
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => (
              <label key={index} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option)}
                  onChange={(e) => {
                    const newValues = e.target.checked
                      ? [...selectedValues, option]
                      : selectedValues.filter(v => v !== option);
                    handleResponseChange(question.id, newValues);
                  }}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );

      case 'boolean':
        return (
          <div className="flex space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name={question.id}
                checked={responses[question.id] === true}
                onChange={() => handleResponseChange(question.id, true)}
              />
              <span>Sim</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name={question.id}
                checked={responses[question.id] === false}
                onChange={() => handleResponseChange(question.id, false)}
              />
              <span>Não</span>
            </label>
          </div>
        );

      case 'scale':
        if (!question.scale) return null;
        return (
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-gray-600">
              <span>{question.scale.labels[0]}</span>
              <span>{question.scale.labels[1]}</span>
            </div>
            <input
              type="range"
              min={question.scale.min}
              max={question.scale.max}
              value={value || question.scale.min}
              onChange={(e) => handleResponseChange(question.id, parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-center text-lg font-semibold">
              {value || question.scale.min}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Erro ao carregar questionário
        </h2>
        <p className="text-gray-600 mb-4">
          Não foi possível carregar o questionário de saúde.
        </p>
        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={() => router.push('/company-info')}>
            Voltar
          </Button>
          <Button onClick={() => initializeQuestionnaire()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  const currentSectionData = template.sections[currentSection];
  
  if (!currentSectionData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Seção não encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <Heart className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {template.name}
            </h1>
            <p className="text-gray-600">
              Seção {currentSection + 1} de {template.sections.length} • Tempo estimado: {template.estimated_minutes} min
            </p>
          </div>
          <div className="flex items-center gap-2" data-testid="points-display">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span className="font-semibold text-yellow-600" data-testid="points-counter">{pointsEarned} pontos</span>
          </div>
        </div>
        
        <Progress value={progress} className="h-3" />
        
        {/* Points animation */}
        {showPointsAnimation && (
          <div className="fixed top-4 right-4 z-50 animate-bounce">
            <div className="bg-yellow-500 text-white px-4 py-2 rounded-full flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              +50 pontos!
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main questionnaire */}
        <div className="lg:col-span-3">
          <Card className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {currentSectionData.title}
              </h2>
              <p className="text-gray-600">
                {currentSectionData.description}
              </p>
            </div>

            <div className="space-y-6">
              {currentSectionData.questions.map((question) => (
                <div key={question.id} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {question.text}
                    {question.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  
                  {renderQuestion(question)}
                  
                  {errors[question.id] && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors[question.id]}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={handlePrevious}
                className="flex items-center gap-2"
                disabled={isSaving}
              >
                <ChevronLeft className="w-4 h-4" />
                {currentSection === 0 ? 'Voltar' : 'Anterior'}
              </Button>
              
              <Button
                onClick={handleNext}
                className="flex items-center gap-2"
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : currentSection === template.sections.length - 1 ? (
                  <>
                    Finalizar
                    <CheckCircle className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Próximo
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>

        {/* AI Assistant Sidebar */}
        <div className="lg:col-span-1">
          <Card className="p-4">
            <Button
              variant="outline"
              onClick={() => setShowAIChat(!showAIChat)}
              className="w-full flex items-center gap-2 mb-4"
            >
              <MessageCircle className="w-4 h-4" />
              Assistente IA
            </Button>

            {showAIChat && (
              <div className="space-y-4" data-testid="ai-chat">
                <div className="bg-blue-50 p-3 rounded-lg text-sm">
                  <p className="font-medium text-blue-900 mb-1">
                    💡 Dica do Assistente
                  </p>
                  <p className="text-blue-800">
                    Tenho dúvidas sobre alguma questão? Posso ajudar a explicar termos médicos ou esclarecer o que estamos perguntando.
                  </p>
                </div>

                {/* Chat messages */}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {aiMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-sm ${
                        message.role === 'user'
                          ? 'bg-blue-100 text-blue-900 ml-2'
                          : 'bg-gray-100 text-gray-900 mr-2'
                      }`}
                    >
                      {message.content}
                    </div>
                  ))}
                </div>

                {/* Chat input */}
                <div className="flex gap-2">
                  <Input
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Digite sua dúvida..."
                    onKeyPress={(e) => e.key === 'Enter' && handleAIQuestion()}
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={handleAIQuestion}
                    disabled={isAiLoading || !aiInput.trim()}
                  >
                    {isAiLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      '→'
                    )}
                  </Button>
                </div>

                <p className="text-xs text-gray-500">
                  ⚠️ As respostas da IA são apenas informativas e não substituem consulta médica.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}