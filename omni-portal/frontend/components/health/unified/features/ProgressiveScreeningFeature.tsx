'use client';

import React, { useState, useEffect } from 'react';
import { Filter, TrendingUp, SkipForward, Layers } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useQuestionnaire, QuestionnaireFeature, FeatureHooks } from '../BaseHealthQuestionnaire';
import { HealthSection } from '@/types/health';

interface ScreeningPath {
  id: string;
  name: string;
  description: string;
  conditions: string[];
  skipSections?: string[];
  addSections?: string[];
}

interface ProgressiveScreeningConfig {
  enabled: boolean;
  adaptiveBranching: boolean;
  smartSkipping: boolean;
  pathOptimization: boolean;
  showPathPreview: boolean;
}

export function ProgressiveScreeningFeatureComponent({ config }: { config?: ProgressiveScreeningConfig }) {
  const { state, config: questionnaireConfig, dispatch } = useQuestionnaire();
  const [currentPath, setCurrentPath] = useState<ScreeningPath | null>(null);
  const [skippedSections, setSkippedSections] = useState<string[]>([]);
  const [pathEfficiency, setPathEfficiency] = useState(100);

  const enableAdaptive = config?.adaptiveBranching !== false;
  const enableSkipping = config?.smartSkipping !== false;

  // Determine optimal path based on responses
  useEffect(() => {
    if (!enableAdaptive) return;

    const responses = state.responses;
    
    // Analyze responses to determine path
    if (responses.age && typeof responses.age === 'number') {
      if (responses.age < 30 && responses.emergency_conditions === 'none') {
        setCurrentPath({
          id: 'young-healthy',
          name: 'Jovem Saudável',
          description: 'Questionário simplificado para jovens sem condições preexistentes',
          conditions: ['age < 30', 'no_conditions'],
          skipSections: ['chronic_disease_details', 'medication_history']
        });
      } else if (responses.age > 60) {
        setCurrentPath({
          id: 'senior-comprehensive',
          name: 'Avaliação Sênior Completa',
          description: 'Avaliação abrangente para idosos',
          conditions: ['age > 60'],
          addSections: ['geriatric_assessment', 'fall_risk']
        });
      }
    }

    // Mental health focused path
    if (responses.initial_mental_health_concern === true) {
      setCurrentPath({
        id: 'mental-health-focus',
        name: 'Foco em Saúde Mental',
        description: 'Avaliação detalhada de saúde mental',
        conditions: ['mental_health_concern'],
        skipSections: ['physical_activity_details'],
        addSections: ['extended_mental_health']
      });
    }
  }, [state.responses, enableAdaptive]);

  // Calculate path efficiency
  useEffect(() => {
    if (!currentPath) return;

    const totalSections = questionnaireConfig.sections.length;
    const skippedCount = currentPath.skipSections?.length || 0;
    const efficiency = Math.round(((totalSections - skippedCount) / totalSections) * 100);
    
    setPathEfficiency(efficiency);
    setSkippedSections(currentPath.skipSections || []);
  }, [currentPath, questionnaireConfig.sections]);

  // Smart section skipping
  const shouldSkipSection = (sectionId: string): boolean => {
    if (!enableSkipping) return false;
    return skippedSections.includes(sectionId);
  };

  // Get remaining sections
  const getRemainingScreeningTime = (): number => {
    const remainingSections = questionnaireConfig.sections
      .slice(state.currentSectionIndex)
      .filter(s => !shouldSkipSection(s.id));
    
    return remainingSections.reduce((acc, section) => acc + section.estimatedMinutes, 0);
  };

  return (
    <div className="progressive-screening-container space-y-4">
      {/* Current Path Display */}
      {currentPath && config?.showPathPreview !== false && (
        <Card className="p-4 bg-gradient-to-br from-green-50 to-blue-50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Filter className="w-4 h-4 text-green-600" />
                <h3 className="text-sm font-medium">Caminho Otimizado</h3>
              </div>
              <p className="text-sm text-gray-700">{currentPath.name}</p>
              <p className="text-xs text-gray-600 mt-1">{currentPath.description}</p>
            </div>
            <Badge variant="secondary" className="ml-2">
              {pathEfficiency}% Eficiente
            </Badge>
          </div>

          {/* Efficiency Bar */}
          <div className="mt-3">
            <Progress value={pathEfficiency} className="h-1" />
          </div>
        </Card>
      )}

      {/* Smart Skipping Info */}
      {enableSkipping && skippedSections.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
          <SkipForward className="w-4 h-4 text-blue-600" />
          <p className="text-sm text-blue-800">
            {skippedSections.length} seções irrelevantes puladas com base em suas respostas
          </p>
        </div>
      )}

      {/* Time Estimation */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <Layers className="w-4 h-4" />
          <span>Tempo estimado restante</span>
        </div>
        <Badge variant="outline">
          ~{getRemainingScreeningTime()} min
        </Badge>
      </div>

      {/* Adaptive Insights */}
      {config?.pathOptimization && (
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Questionário adaptado às suas necessidades específicas
        </div>
      )}
    </div>
  );
}

// Progressive Screening Hooks
export const progressiveScreeningHooks: FeatureHooks = {
  onInit: (state) => {
    console.log('[Progressive Screening] Initialized');
  },

  onSectionComplete: (sectionId, state) => {
    // Analyze completed section to optimize remaining path
    console.log(`[Progressive Screening] Section ${sectionId} completed, optimizing path...`);
  },

  transformQuestion: (question, state) => {
    // Dynamically modify questions based on previous responses
    if (question.id === 'exercise_frequency' && state.responses.mobility_issues === true) {
      return {
        ...question,
        text: 'Com que frequência você faz atividades físicas adaptadas às suas necessidades?',
        options: [
          { value: 'daily', label: 'Diariamente (exercícios adaptados)' },
          { value: 'weekly', label: 'Semanalmente (fisioterapia ou similar)' },
          { value: 'rarely', label: 'Raramente' },
          { value: 'never', label: 'Nunca' }
        ]
      };
    }
    return question;
  }
};

// Export feature definition
export const ProgressiveScreeningFeature: QuestionnaireFeature = {
  id: 'progressive-screening',
  name: 'Progressive Screening',
  enabled: true,
  priority: 85,
  component: ProgressiveScreeningFeatureComponent,
  hooks: progressiveScreeningHooks,
  config: {
    enabled: true,
    adaptiveBranching: true,
    smartSkipping: true,
    pathOptimization: true,
    showPathPreview: true
  }
};