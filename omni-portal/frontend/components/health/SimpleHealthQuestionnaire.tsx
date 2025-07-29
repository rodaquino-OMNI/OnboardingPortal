'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Heart, Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useGamification } from '@/hooks/useGamification';
import api from '@/services/api';

interface SimpleHealthQuestionnaireProps {
  onComplete?: (results: HealthAssessmentResults) => void;
}

interface HealthAssessmentResults {
  responses: Record<string, any>;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  recommendations: string[];
  completionTime: number;
}

const HEALTH_QUESTIONS = [
  {
    id: 'general_health',
    question: 'Como você avalia sua saúde geral?',
    type: 'radio',
    options: [
      { value: 'excellent', label: 'Excelente', score: 1 },
      { value: 'good', label: 'Boa', score: 2 },
      { value: 'fair', label: 'Regular', score: 3 },
      { value: 'poor', label: 'Ruim', score: 4 }
    ]
  },
  {
    id: 'chronic_conditions',
    question: 'Você tem alguma condição médica crônica?',
    type: 'checkbox',
    options: [
      { value: 'diabetes', label: 'Diabetes', score: 2 },
      { value: 'hypertension', label: 'Hipertensão', score: 2 },
      { value: 'heart_disease', label: 'Doença cardíaca', score: 3 },
      { value: 'asthma', label: 'Asma', score: 1 },
      { value: 'arthritis', label: 'Artrite', score: 1 },
      { value: 'none', label: 'Nenhuma', score: 0 }
    ]
  },
  {
    id: 'medications',
    question: 'Você toma medicamentos regularmente?',
    type: 'radio',
    options: [
      { value: 'none', label: 'Não tomo medicamentos', score: 0 },
      { value: 'one_two', label: '1-2 medicamentos', score: 1 },
      { value: 'three_five', label: '3-5 medicamentos', score: 2 },
      { value: 'more_than_five', label: 'Mais de 5 medicamentos', score: 3 }
    ]
  },
  {
    id: 'physical_activity',
    question: 'Com que frequência você pratica atividade física?',
    type: 'radio',
    options: [
      { value: 'daily', label: 'Diariamente', score: 0 },
      { value: 'few_times_week', label: 'Algumas vezes por semana', score: 1 },
      { value: 'once_week', label: 'Uma vez por semana', score: 2 },
      { value: 'rarely', label: 'Raramente', score: 3 },
      { value: 'never', label: 'Nunca', score: 4 }
    ]
  },
  {
    id: 'smoking',
    question: 'Você fuma?',
    type: 'radio',
    options: [
      { value: 'never', label: 'Nunca fumei', score: 0 },
      { value: 'former', label: 'Ex-fumante', score: 1 },
      { value: 'occasional', label: 'Fumo ocasionalmente', score: 2 },
      { value: 'daily', label: 'Fumo diariamente', score: 3 }
    ]
  },
  {
    id: 'alcohol',
    question: 'Você consome bebidas alcoólicas?',
    type: 'radio',
    options: [
      { value: 'never', label: 'Nunca', score: 0 },
      { value: 'occasionally', label: 'Ocasionalmente', score: 1 },
      { value: 'weekly', label: 'Semanalmente', score: 2 },
      { value: 'daily', label: 'Diariamente', score: 3 }
    ]
  },
  {
    id: 'stress_level',
    question: 'Como você avalia seu nível de estresse?',
    type: 'radio',
    options: [
      { value: 'low', label: 'Baixo', score: 1 },
      { value: 'moderate', label: 'Moderado', score: 2 },
      { value: 'high', label: 'Alto', score: 3 },
      { value: 'very_high', label: 'Muito alto', score: 4 }
    ]
  },
  {
    id: 'sleep_quality',
    question: 'Como você avalia a qualidade do seu sono?',
    type: 'radio',
    options: [
      { value: 'excellent', label: 'Excelente', score: 1 },
      { value: 'good', label: 'Boa', score: 2 },
      { value: 'fair', label: 'Regular', score: 3 },
      { value: 'poor', label: 'Ruim', score: 4 }
    ]
  }
];

export function SimpleHealthQuestionnaire({ onComplete }: SimpleHealthQuestionnaireProps) {
  const router = useRouter();
  const { user } = useAuth();
  const gamification = useGamification();
  
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime] = useState(Date.now());

  const question = HEALTH_QUESTIONS[currentQuestion];
  const isLastQuestion = currentQuestion === HEALTH_QUESTIONS.length - 1;
  const canProceed = responses[question.id] !== undefined;

  const handleAnswer = (value: string | string[]) => {
    setResponses(prev => ({
      ...prev,
      [question.id]: value
    }));
    setError(null);
  };

  const handleNext = () => {
    if (!canProceed) {
      setError('Por favor, responda à pergunta antes de continuar.');
      return;
    }

    if (isLastQuestion) {
      handleSubmit();
    } else {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
      setError(null);
    }
  };

  const calculateRiskLevel = (responses: Record<string, any>): 'low' | 'moderate' | 'high' | 'critical' => {
    let totalScore = 0;
    let maxScore = 0;

    HEALTH_QUESTIONS.forEach(q => {
      const response = responses[q.id];
      if (response) {
        if (Array.isArray(response)) {
          // Checkbox - sum scores for selected options
          response.forEach((value: string) => {
            const option = q.options.find(opt => opt.value === value);
            if (option) totalScore += option.score;
          });
          maxScore += Math.max(...q.options.map(opt => opt.score));
        } else {
          // Radio - single score
          const option = q.options.find(opt => opt.value === response);
          if (option) totalScore += option.score;
          maxScore += Math.max(...q.options.map(opt => opt.score));
        }
      }
    });

    const riskPercentage = (totalScore / maxScore) * 100;

    if (riskPercentage <= 25) return 'low';
    if (riskPercentage <= 50) return 'moderate';
    if (riskPercentage <= 75) return 'high';
    return 'critical';
  };

  const generateRecommendations = (riskLevel: string, responses: Record<string, any>): string[] => {
    const recommendations: string[] = [];

    if (riskLevel === 'high' || riskLevel === 'critical') {
      recommendations.push('Recomendamos consulta médica para avaliação detalhada.');
    }

    if (responses.physical_activity === 'rarely' || responses.physical_activity === 'never') {
      recommendations.push('Inclua atividade física regular em sua rotina.');
    }

    if (responses.smoking === 'daily' || responses.smoking === 'occasional') {
      recommendations.push('Considere procurar ajuda para parar de fumar.');
    }

    if (responses.stress_level === 'high' || responses.stress_level === 'very_high') {
      recommendations.push('Procure técnicas de manejo do estresse ou apoio profissional.');
    }

    if (responses.sleep_quality === 'poor' || responses.sleep_quality === 'fair') {
      recommendations.push('Melhore seus hábitos de sono para maior qualidade de vida.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue mantendo seus bons hábitos de saúde!');
    }

    return recommendations;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const completionTime = Math.floor((Date.now() - startTime) / 1000);
      const riskLevel = calculateRiskLevel(responses);
      const recommendations = generateRecommendations(riskLevel, responses);

      const results: HealthAssessmentResults = {
        responses,
        riskLevel,
        recommendations,
        completionTime
      };

      // Submit to backend
      const response = await api.post('/health-questionnaires/submit-unified', {
        responses,
        risk_scores: { overall: riskLevel },
        completed_domains: ['health_assessment'],
        total_risk_score: 0, // Will be calculated by backend
        risk_level: riskLevel,
        recommendations,
        next_steps: [],
        fraud_detection_score: 0,
        timestamp: new Date().toISOString()
      });

      if (response.success) {
        // Award points based on completion and risk level
        const basePoints = 150;
        const riskBonus = riskLevel === 'low' ? 25 : 50; // Bonus for honest disclosure
        const totalPoints = basePoints + riskBonus;

        // Safely call gamification methods if they exist
        try {
          if (gamification?.addPoints) {
            await gamification.addPoints(totalPoints, 'health_assessment_complete');
          }
          
          if (gamification?.unlockBadge) {
            await gamification.unlockBadge('health_assessment_complete');
            
            if (riskLevel === 'low') {
              await gamification.unlockBadge('wellness_champion');
            }
          }
        } catch (gamificationError) {
          console.warn('Gamification error (non-critical):', gamificationError);
        }

        if (onComplete) {
          onComplete(results);
        } else {
          // Navigate to next step
          router.push('/document-upload');
        }
      } else {
        throw new Error(response.error?.message || 'Failed to submit health assessment');
      }
    } catch (error) {
      console.error('Error submitting health assessment:', error);
      setError('Erro ao enviar avaliação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return (
      <Card className="p-8 max-w-2xl mx-auto">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <Activity className="w-8 h-8 text-blue-600 animate-pulse" />
          </div>
          <h3 className="text-xl font-semibold">Processando sua avaliação...</h3>
          <p className="text-gray-600">Analisando suas respostas e gerando recomendações personalizadas.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress Header */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Heart className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Avaliação de Saúde</h2>
              <p className="text-sm text-gray-600">
                Pergunta {currentQuestion + 1} de {HEALTH_QUESTIONS.length}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(((currentQuestion + 1) / HEALTH_QUESTIONS.length) * 100)}%
            </div>
            <div className="text-xs text-gray-500">Concluído</div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / HEALTH_QUESTIONS.length) * 100}%` }}
          />
        </div>
      </Card>

      {/* Question Card */}
      <Card className="p-8">
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-2">{question.question}</h3>
            <p className="text-gray-600 text-sm">Selecione a opção que melhor descreve sua situação.</p>
          </div>

          <div className="space-y-3">
            {question.type === 'radio' ? (
              question.options.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${
                    responses[question.id] === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={option.value}
                    checked={responses[question.id] === option.value}
                    onChange={(e) => handleAnswer(e.target.value)}
                    className="mr-3 text-blue-600"
                  />
                  <span className="flex-1">{option.label}</span>
                  {responses[question.id] === option.value && (
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  )}
                </label>
              ))
            ) : (
              question.options.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${
                    responses[question.id]?.includes(option.value)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    value={option.value}
                    checked={responses[question.id]?.includes(option.value) || false}
                    onChange={(e) => {
                      const currentValues = responses[question.id] || [];
                      if (e.target.checked) {
                        handleAnswer([...currentValues, e.target.value]);
                      } else {
                        handleAnswer(currentValues.filter((v: string) => v !== e.target.value));
                      }
                    }}
                    className="mr-3 text-blue-600"
                  />
                  <span className="flex-1">{option.label}</span>
                  {responses[question.id]?.includes(option.value) && (
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  )}
                </label>
              ))
            )}
          </div>

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </Card>

      {/* Navigation */}
      <Card className="p-6">
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
          >
            Anterior
          </Button>
          
          <div className="flex items-center gap-2">
            {HEALTH_QUESTIONS.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full ${
                  index < currentQuestion
                    ? 'bg-green-500'
                    : index === currentQuestion
                    ? 'bg-blue-500'
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          <Button
            onClick={handleNext}
            disabled={!canProceed}
            className={isLastQuestion ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            {isLastQuestion ? 'Finalizar Avaliação' : 'Próxima'}
          </Button>
        </div>
      </Card>
    </div>
  );
}