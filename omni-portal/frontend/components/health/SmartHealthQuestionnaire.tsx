'use client';

import React, { useState, useEffect } from 'react';
import { UnifiedHealthAssessment } from './UnifiedHealthAssessment';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { HealthAssessmentResults } from '@/lib/unified-health-flow';
import { Brain, Heart, Shield } from 'lucide-react';

interface SmartHealthQuestionnaireProps {
  onComplete: (results: HealthAssessmentResults) => void;
  userId?: string;
  mode?: 'standard' | 'quick' | 'comprehensive';
  features?: {
    ai?: boolean;
    gamification?: boolean;
    clinical?: boolean;
    progressive?: boolean;
    accessibility?: boolean;
  };
}

export const SmartHealthQuestionnaire: React.FC<SmartHealthQuestionnaireProps> = ({
  onComplete,
  userId,
  mode = 'standard',
  features = { ai: true, gamification: true, clinical: true, progressive: true, accessibility: false }
}) => {
  const [currentStep, setCurrentStep] = useState<'intro' | 'assessment' | 'completed'>('intro');
  const [progress, setProgress] = useState(0);
  const [currentDomain, setCurrentDomain] = useState<string>('');

  const handleStartAssessment = () => {
    setCurrentStep('assessment');
  };

  const handleComplete = (results: HealthAssessmentResults) => {
    setCurrentStep('completed');
    onComplete(results);
  };

  const handleProgressUpdate = (newProgress: number) => {
    setProgress(newProgress);
  };

  const handleDomainChange = (domain: string) => {
    setCurrentDomain(domain);
  };

  if (currentStep === 'intro') {
    return (
      <Card className="p-8 max-w-2xl mx-auto">
        <div className="text-center space-y-6">
          <div className="flex justify-center space-x-4 mb-6">
            <div className="p-3 bg-blue-100 rounded-full">
              <Brain className="h-8 w-8 text-blue-600" />
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <Heart className="h-8 w-8 text-green-600" />
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Shield className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Questionário Inteligente de Saúde
            </h1>
            <p className="text-lg text-gray-600">
              Uma avaliação personalizada e adaptativa para entender melhor sua saúde
            </p>
          </div>

          <div className="space-y-4 text-left bg-gray-50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Características desta avaliação:</h2>
            <div className="space-y-3">
              {features.ai && (
                <div className="flex items-center space-x-3">
                  <Brain className="h-5 w-5 text-blue-600" />
                  <span>Inteligência artificial adaptativa</span>
                </div>
              )}
              {features.clinical && (
                <div className="flex items-center space-x-3">
                  <Shield className="h-5 w-5 text-purple-600" />
                  <span>Baseada em instrumentos clínicos validados</span>
                </div>
              )}
              {features.progressive && (
                <div className="flex items-center space-x-3">
                  <Heart className="h-5 w-5 text-red-600" />
                  <span>Perguntas progressivas baseadas em suas respostas</span>
                </div>
              )}
              {features.gamification && (
                <div className="flex items-center space-x-3">
                  <div className="h-5 w-5 text-green-600">🎮</div>
                  <span>Elementos de gamificação para melhor experiência</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 text-sm text-gray-600">
            <p>⏱️ Tempo estimado: 10-15 minutos</p>
            <p>🔒 Suas informações são confidenciais e protegidas</p>
            <p>💾 Você pode pausar e retomar a qualquer momento</p>
          </div>

          <Button onClick={handleStartAssessment} className="w-full py-3 text-lg">
            Começar Avaliação
          </Button>
        </div>
      </Card>
    );
  }

  if (currentStep === 'assessment') {
    return (
      <div className="space-y-6">
        {/* Header with progress */}
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Questionário Inteligente de Saúde</h2>
              <span className="text-sm text-gray-600">{Math.round(progress)}% concluído</span>
            </div>
            <Progress value={progress} className="w-full" />
            {currentDomain && (
              <p className="text-sm text-gray-600">
                Área atual: <span className="font-medium">{currentDomain}</span>
              </p>
            )}
          </div>
        </Card>

        {/* Assessment component */}
        <UnifiedHealthAssessment
          onComplete={handleComplete}
          onProgressUpdate={handleProgressUpdate}
          onDomainChange={handleDomainChange}
        />
      </div>
    );
  }

  // Completed state is handled by parent component
  return null;
};