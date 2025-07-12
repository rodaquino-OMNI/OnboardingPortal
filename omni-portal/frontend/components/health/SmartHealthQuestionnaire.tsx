'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

interface SmartHealthQuestionnaireProps {
  onComplete: (data: any) => void;
  userId: string;
}

export function SmartHealthQuestionnaire({ onComplete, userId }: SmartHealthQuestionnaireProps) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [sectionProgress, setSectionProgress] = useState<Record<string, number>>({});
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  const [fraudIndicators, setFraudIndicators] = useState<FraudIndicators | null>(null);
  const [showPrivacyMode, setShowPrivacyMode] = useState(false);
  const [trustScore, setTrustScore] = useState(100);
  const [showRiskAlert, setShowRiskAlert] = useState(false);

  const currentSection = HEALTH_QUESTIONNAIRE_SECTIONS[currentSectionIndex];
  const visibleQuestions = currentSection.questions.filter(q => {
    if (!q.conditionalOn) return true;
    const conditionValue = responses[q.conditionalOn.questionId];
    if (q.conditionalOn.values.includes('*')) {
      return conditionValue && (Array.isArray(conditionValue) ? conditionValue.length > 0 : true);
    }
    return q.conditionalOn.values.includes(conditionValue);
  });
  const currentQuestion = visibleQuestions[currentQuestionIndex];

  // Real-time fraud detection
  useEffect(() => {
    const indicators = detectFraudIndicators(responses);
    setFraudIndicators(indicators);
    
    // Update trust score based on consistency
    setTrustScore(Math.max(0, 100 - indicators.inconsistencyScore));
    
    // Show alert for critical inconsistencies
    if (indicators.inconsistencyScore > 50) {
      setShowRiskAlert(true);
    }
  }, [responses]);

  // Calculate risk score periodically
  useEffect(() => {
    if (Object.keys(responses).length > 10) {
      const score = calculateRiskScore(responses);
      setRiskScore(score);
      
      // Immediate intervention for critical risks
      if (score.flags.includes('suicide_risk')) {
        handleCriticalRisk('suicide');
      }
    }
  }, [responses]);

  const handleCriticalRisk = (riskType: string) => {
    // In production, this would trigger immediate notifications
    console.error(`CRITICAL RISK DETECTED: ${riskType}`);
    // Show crisis resources
    setShowRiskAlert(true);
  };

  const handleResponse = (value: any) => {
    const newResponses = { ...responses, [currentQuestion.id]: value };
    setResponses(newResponses);

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

    // Auto-advance for better UX
    setTimeout(() => {
      if (currentQuestionIndex < visibleQuestions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        handleSectionComplete();
      }
    }, 300);
  };

  const handleSectionComplete = () => {
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
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant={responses[currentQuestion.id] === true ? 'default' : 'outline'}
              onClick={() => handleResponse(true)}
              className="py-8 text-lg"
            >
              Sim
            </Button>
            <Button
              variant={responses[currentQuestion.id] === false ? 'default' : 'outline'}
              onClick={() => handleResponse(false)}
              className="py-8 text-lg"
            >
              Não
            </Button>
          </div>
        );

      case 'select':
        const options = currentQuestion.metadata?.validatedTool === 'PHQ-9' || 
                       currentQuestion.metadata?.validatedTool === 'GAD-7'
          ? [
              { value: 0, label: 'Nunca' },
              { value: 1, label: 'Vários dias' },
              { value: 2, label: 'Mais da metade dos dias' },
              { value: 3, label: 'Quase todos os dias' }
            ]
          : []; // Define other options based on question

        return (
          <div className="space-y-3">
            {options.map(option => (
              <Button
                key={option.value}
                variant={responses[currentQuestion.id] === option.value ? 'default' : 'outline'}
                onClick={() => handleResponse(option.value)}
                className="w-full justify-start py-4"
              >
                {option.label}
              </Button>
            ))}
          </div>
        );

      case 'number':
        return (
          <div className="space-y-4">
            <input
              type="number"
              className="w-full px-4 py-3 text-lg border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Digite um número"
              min={currentQuestion.validation?.min}
              max={currentQuestion.validation?.max}
              value={responses[currentQuestion.id] || ''}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value)) {
                  handleResponse(value);
                }
              }}
            />
            {currentQuestion.validation && (
              <p className="text-sm text-gray-600">
                Entre {currentQuestion.validation.min} e {currentQuestion.validation.max}
              </p>
            )}
          </div>
        );

      case 'multiselect':
        const conditions = [
          { id: 'diabetes', label: 'Diabetes' },
          { id: 'hypertension', label: 'Hipertensão' },
          { id: 'heart_disease', label: 'Doença Cardíaca' },
          { id: 'asthma', label: 'Asma' },
          { id: 'cancer', label: 'Câncer' },
          { id: 'depression', label: 'Depressão' },
          { id: 'anxiety', label: 'Ansiedade' },
          { id: 'none', label: 'Nenhuma das acima' }
        ];

        return (
          <div className="grid grid-cols-2 gap-3">
            {conditions.map(condition => {
              const selected = responses[currentQuestion.id]?.includes(condition.id);
              return (
                <Button
                  key={condition.id}
                  variant={selected ? 'default' : 'outline'}
                  onClick={() => {
                    const current = responses[currentQuestion.id] || [];
                    if (condition.id === 'none') {
                      handleResponse(['none']);
                    } else if (current.includes('none')) {
                      handleResponse([condition.id]);
                    } else {
                      const updated = selected
                        ? current.filter((id: string) => id !== condition.id)
                        : [...current, condition.id];
                      handleResponse(updated);
                    }
                  }}
                  className="justify-start"
                >
                  {selected && <CheckCircle className="w-4 h-4 mr-2" />}
                  {condition.label}
                </Button>
              );
            })}
          </div>
        );

      default:
        return (
          <textarea
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Digite sua resposta..."
            value={responses[currentQuestion.id] || ''}
            onChange={(e) => handleResponse(e.target.value)}
          />
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

  const overallProgress = 
    (currentSectionIndex / HEALTH_QUESTIONNAIRE_SECTIONS.length) * 100 +
    (currentQuestionIndex / visibleQuestions.length) * (100 / HEALTH_QUESTIONNAIRE_SECTIONS.length);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Progresso Geral</h3>
            <span className="text-sm text-gray-600">
              {Math.round(overallProgress)}% completo
            </span>
          </div>
          <Progress value={overallProgress} className="h-3" />
          
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
                >
                  <Icon className={`w-6 h-6 mb-1 ${
                    isActive ? 'text-blue-600' :
                    isComplete ? 'text-green-600' : 'text-gray-400'
                  }`} />
                  <span className="text-xs text-center">{section.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Current Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion?.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-8">
            <div className="space-y-6">
              {/* Section Header */}
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-sm">
                  {currentSection.title} • Pergunta {currentQuestionIndex + 1} de {visibleQuestions.length}
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
                <h2 className="text-2xl font-semibold">
                  {showPrivacyMode && currentQuestion?.category === 'mental_health' 
                    ? '(Pergunta privada - suas respostas são confidenciais)'
                    : currentQuestion?.text}
                </h2>
                
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
              <div className="flex justify-between items-center mt-8">
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
                >
                  Voltar
                </Button>
                
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
                  >
                    Pular
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Risk Alert Modal */}
      {showRiskAlert && riskScore?.flags.includes('suicide_risk') && (
        <Alert className="mt-4 border-red-500 bg-red-50">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Recursos de Apoio Disponíveis</strong>
            <p className="mt-2">CVV - Centro de Valorização da Vida: 188 (24h)</p>
            <p>Ou acesse: www.cvv.org.br</p>
            <Button 
              size="sm" 
              className="mt-3"
              onClick={() => setShowRiskAlert(false)}
            >
              Entendi
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Health Score Preview */}
      {riskScore && Object.keys(responses).length > 20 && (
        <Card className="p-4 bg-gradient-to-r from-blue-50 to-purple-50">
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
        </Card>
      )}
    </div>
  );
}