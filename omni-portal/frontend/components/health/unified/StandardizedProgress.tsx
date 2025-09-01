'use client';

import React, { memo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle, Clock } from 'lucide-react';

export interface StandardizedProgressProps {
  // Progress data
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  
  // Domain information
  currentDomain?: string;
  completedDomains?: string[];
  
  // Time estimation
  estimatedTimeRemaining?: string;
  averageTimePerQuestion?: number;
  
  // Customization
  showStepNumbers?: boolean;
  showDomainInfo?: boolean;
  showTimeEstimate?: boolean;
  showDetailedProgress?: boolean;
  
  // Styling
  className?: string;
}

const DOMAIN_LABELS: Record<string, string> = {
  'demographics': 'Informações Básicas',
  'emergency_triage': 'Triagem de Emergência',
  'pain_management': 'Avaliação da Dor', 
  'mental_health': 'Bem-estar Mental',
  'chronic_disease': 'Condições Crônicas',
  'lifestyle': 'Estilo de Vida',
  'allergies': 'Alergias e Medicações',
  'substance_monitoring': 'Monitoramento de Substâncias',
  'preventive_care': 'Cuidados Preventivos'
};

export const StandardizedProgress = memo(function StandardizedProgress({
  currentStep,
  totalSteps,
  completedSteps,
  currentDomain,
  completedDomains = [],
  estimatedTimeRemaining,
  averageTimePerQuestion = 30,
  showStepNumbers = true,
  showDomainInfo = true,
  showTimeEstimate = true,
  showDetailedProgress = false,
  className = ''
}: StandardizedProgressProps) {
  
  // Calculate progress percentage
  const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  
  // Calculate estimated time if not provided
  const estimatedTime = estimatedTimeRemaining || 
    `${Math.ceil((totalSteps - completedSteps) * averageTimePerQuestion / 60)} min`;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {showStepNumbers && (
              <span className="font-medium text-gray-700">
                Pergunta {currentStep} de {totalSteps}
              </span>
            )}
            {showDomainInfo && currentDomain && (
              <Badge variant="outline" className="text-xs">
                {DOMAIN_LABELS[currentDomain] || currentDomain}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-gray-600">
            {showTimeEstimate && (
              <div className="flex items-center gap-1 text-xs">
                <Clock className="w-3 h-3" />
                <span>~{estimatedTime}</span>
              </div>
            )}
            <span className="font-medium">{progressPercentage}%</span>
          </div>
        </div>
        
        <Progress 
          value={progressPercentage} 
          className="h-2"
        />
      </div>

      {/* Detailed Progress (if enabled) */}
      {showDetailedProgress && (
        <div className="space-y-3">
          {/* Domain Progress */}
          {showDomainInfo && completedDomains.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                Domínios Avaliados
              </h4>
              <div className="flex flex-wrap gap-2">
                {completedDomains.map((domain) => (
                  <div
                    key={domain}
                    className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-md text-xs"
                  >
                    <CheckCircle className="w-3 h-3" />
                    <span>{DOMAIN_LABELS[domain] || domain}</span>
                  </div>
                ))}
                {currentDomain && !completedDomains.includes(currentDomain) && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs">
                    <Circle className="w-3 h-3" />
                    <span>{DOMAIN_LABELS[currentDomain] || currentDomain}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step Progress Indicators */}
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalSteps, 20) }, (_, index) => {
              const stepIndex = index + 1;
              const isCompleted = stepIndex <= completedSteps;
              const isCurrent = stepIndex === currentStep;
              
              return (
                <div
                  key={stepIndex}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    isCompleted
                      ? 'bg-green-500'
                      : isCurrent
                      ? 'bg-blue-500'
                      : 'bg-gray-200'
                  }`}
                  title={`Pergunta ${stepIndex}`}
                />
              );
            })}
            {totalSteps > 20 && (
              <span className="text-xs text-gray-500 ml-2">
                +{totalSteps - 20} mais
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default StandardizedProgress;