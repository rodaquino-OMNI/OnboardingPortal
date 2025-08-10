// Clinical Questionnaire Adapter - Bridges questionnaire flow with ClinicalDecisionEngine
// This adapter provides the progressive questionnaire functionality while using
// the singleton ClinicalDecisionEngine for actual clinical analysis

import { clinicalDecisionEngine, ClinicalDecision, EmergencyProtocol } from './clinical-decision-engine';

export interface ClinicalQuestion {
  id: string;
  text: string;
  type: 'emergency_scale' | 'yes_no' | 'multiple_choice' | 'text' | 'scale' | 'clinical_select';
  options?: any[];
  category?: string;
  domain?: string;
  required?: boolean;
  clinicalInstrument?: string;
  evidenceLevel?: string;
  criticalForSafety?: boolean;
  clinicalRationale?: string;
}

export interface ClinicalAssessmentResults {
  // Core Assessment Data
  responses: Record<string, string | number | boolean | string[]>;
  clinicalScores: any;
  riskStratification: any;
  
  // Clinical Decision Support
  icd10Codes: string[];
  clinicalRecommendations: any[];
  emergencyProtocol?: EmergencyProtocol;
  
  // Quality & Performance Metrics
  assessmentMetrics: any;
  fraudAnalysis: any;
  
  // Regulatory & Compliance
  auditTrail: any[];
  consentTimestamp: Date;
  hipaaCompliant: boolean;
}

export class ClinicalQuestionnaireAdapter {
  private currentAnalysis: Partial<ClinicalAssessmentResults> = {};
  private phq9Responses: Record<string, number> = {};
  private gad7Responses: Record<string, number> = {};

  getTriageQuestion(): ClinicalQuestion {
    return {
      id: 'triage_wellbeing',
      text: 'Como você avaliaria seu bem-estar geral hoje?',
      type: 'emergency_scale',
      clinicalInstrument: 'Triagem Rápida',
      evidenceLevel: 'A',
      criticalForSafety: true,
      clinicalRationale: 'Avaliação inicial de bem-estar para estratificação de risco',
      options: [{ emoji: '📊' }]
    };
  }

  async analyzeResponse(
    questionId: string, 
    value: string | number | boolean | string[], 
    allResponses: Record<string, string | number | boolean | string[]>
  ): Promise<Partial<ClinicalAssessmentResults> & { emergencyDetected: boolean; emergencyProtocol?: EmergencyProtocol }> {
    // Store responses for clinical instruments
    if (questionId.startsWith('phq9_')) {
      this.phq9Responses[questionId] = typeof value === 'number' ? value : 0;
    } else if (questionId.startsWith('gad7_')) {
      this.gad7Responses[questionId] = typeof value === 'number' ? value : 0;
    }

    // For triage question, perform immediate risk assessment
    if (questionId === 'triage_wellbeing') {
      const numericValue = typeof value === 'number' ? value : 0;
      const analysis = {
        scores: {
          overallSeverity: numericValue <= 3 ? 'severe' as const : numericValue <= 5 ? 'moderate' as const : numericValue <= 7 ? 'mild' as const : 'minimal' as const
        },
        riskStratification: {
          level: numericValue <= 2 ? 'critical' as const : numericValue <= 4 ? 'high' as const : numericValue <= 6 ? 'moderate' as const : 'low' as const,
          confidenceScore: 85,
          primaryConcerns: numericValue <= 4 ? ['mental_health', 'general_distress'] : [],
          timeToIntervention: numericValue <= 2 ? 1 : numericValue <= 4 ? 24 : 0,
          escalationRequired: numericValue <= 2
        },
        emergencyDetected: numericValue <= 1,
        emergencyProtocol: numericValue <= 1 ? {
          severity: 'critical' as const,
          immediateActions: ['Contato imediato com profissional de saúde mental'],
          contactInformation: [{
            type: 'crisis_line' as const,
            name: 'CVV - Centro de Valorização da Vida',
            phone: '188',
            available24h: true
          }],
          followUpRequired: true,
          estimatedTimeToSafety: 15,
          safetyPlan: [
            'Mantenha-se em um ambiente seguro',
            'Entre em contato com alguém de confiança',
            'Ligue para o número de emergência se necessário',
            'Lembre-se: este sentimento vai passar'
          ]
        } : undefined
      };

      this.currentAnalysis = analysis;
      return analysis;
    }

    // For PHQ-9 question 9 (suicide ideation), check immediately
    if (questionId === 'phq9_9' && typeof value === 'number' && value > 0) {
      const phq9Decision = clinicalDecisionEngine.analyzePHQ9({ ...this.phq9Responses, phq9_9: value });
      if (phq9Decision.emergencyProtocol) {
        return {
          scores: { overallSeverity: phq9Decision.severity },
          riskStratification: {
            level: 'critical',
            confidenceScore: phq9Decision.confidenceLevel,
            primaryConcerns: ['suicide_risk'],
            timeToIntervention: phq9Decision.timeToIntervention,
            escalationRequired: true
          },
          emergencyDetected: true,
          emergencyProtocol: phq9Decision.emergencyProtocol
        };
      }
    }

    // Default response for other questions
    return {
      emergencyDetected: false,
      scores: this.currentAnalysis.scores,
      riskStratification: this.currentAnalysis.riskStratification
    };
  }

  async selectNextQuestion(
    responses: Record<string, string | number | boolean | string[]>, 
    analysis: Partial<ClinicalAssessmentResults>, 
    stage: string
  ): Promise<ClinicalQuestion | null> {
    // Progressive questionnaire logic
    if (stage === 'triage' && analysis.riskStratification?.level !== 'low') {
      // Start with PHQ-2 (first 2 questions of PHQ-9)
      if (!responses['phq9_1']) {
        return {
          id: 'phq9_1',
          text: 'Nas últimas 2 semanas, você se sentiu desanimado, deprimido ou sem esperança?',
          type: 'clinical_select',
          clinicalInstrument: 'PHQ-9',
          evidenceLevel: 'A',
          options: [
            { value: 0, label: 'Nunca', clinicalCode: 'PHQ-0' },
            { value: 1, label: 'Vários dias', clinicalCode: 'PHQ-1' },
            { value: 2, label: 'Mais da metade dos dias', clinicalCode: 'PHQ-2' },
            { value: 3, label: 'Quase todos os dias', clinicalCode: 'PHQ-3' }
          ]
        };
      }
      
      if (!responses['phq9_2']) {
        return {
          id: 'phq9_2',
          text: 'Nas últimas 2 semanas, você teve pouco interesse ou prazer em fazer as coisas?',
          type: 'clinical_select',
          clinicalInstrument: 'PHQ-9',
          evidenceLevel: 'A',
          options: [
            { value: 0, label: 'Nunca', clinicalCode: 'PHQ-0' },
            { value: 1, label: 'Vários dias', clinicalCode: 'PHQ-1' },
            { value: 2, label: 'Mais da metade dos dias', clinicalCode: 'PHQ-2' },
            { value: 3, label: 'Quase todos os dias', clinicalCode: 'PHQ-3' }
          ]
        };
      }
    }

    if (stage === 'targeted') {
      // Check if we need to ask about suicide ideation (PHQ-9 question 9)
      const phq1Score = responses['phq9_1'] as number || 0;
      const phq2Score = responses['phq9_2'] as number || 0;
      
      if ((phq1Score >= 2 || phq2Score >= 2) && !responses['phq9_9']) {
        return {
          id: 'phq9_9',
          text: 'Nas últimas 2 semanas, você pensou que seria melhor estar morto ou se machucar de alguma forma?',
          type: 'clinical_select',
          clinicalInstrument: 'PHQ-9',
          evidenceLevel: 'A',
          criticalForSafety: true,
          clinicalRationale: 'Avaliação crítica de risco de suicídio',
          options: [
            { value: 0, label: 'Nunca', clinicalCode: 'PHQ-0' },
            { value: 1, label: 'Vários dias', clinicalCode: 'PHQ-1' },
            { value: 2, label: 'Mais da metade dos dias', clinicalCode: 'PHQ-2' },
            { value: 3, label: 'Quase todos os dias', clinicalCode: 'PHQ-3' }
          ]
        };
      }

      // Start GAD-7 if depression screening is complete
      if (!responses['gad7_1']) {
        return {
          id: 'gad7_1',
          text: 'Nas últimas 2 semanas, você se sentiu nervoso, ansioso ou muito tenso?',
          type: 'clinical_select',
          clinicalInstrument: 'GAD-7',
          evidenceLevel: 'A',
          options: [
            { value: 0, label: 'Nunca', clinicalCode: 'GAD-0' },
            { value: 1, label: 'Vários dias', clinicalCode: 'GAD-1' },
            { value: 2, label: 'Mais da metade dos dias', clinicalCode: 'GAD-2' },
            { value: 3, label: 'Quase todos os dias', clinicalCode: 'GAD-3' }
          ]
        };
      }
    }
    
    return null; // End of questions
  }

  getTargetedQuestion(analysis: Partial<ClinicalAssessmentResults>): ClinicalQuestion | null {
    return this.selectNextQuestion({}, analysis, 'targeted');
  }

  getSpecializedQuestion(analysis: Partial<ClinicalAssessmentResults>): ClinicalQuestion | null {
    return this.selectNextQuestion({}, analysis, 'specialized');
  }

  async generateFinalAnalysis(responses: Record<string, any>) {
    // Use the singleton to analyze collected responses
    const decisions = clinicalDecisionEngine.analyzeComprehensive(responses);
    
    // Extract the most critical decision
    const primaryDecision = decisions[0] || {
      condition: 'No significant findings',
      icd10Code: 'Z00.00',
      severity: 'minimal' as const,
      confidenceLevel: 100,
      recommendedActions: [],
      timeToIntervention: 8760
    };

    return {
      icd10Codes: decisions.map(d => d.icd10Code),
      recommendations: decisions.flatMap(d => d.recommendedActions),
      accuracyScore: Math.round(decisions.reduce((acc, d) => acc + d.confidenceLevel, 0) / decisions.length)
    };
  }
}

// Export singleton instance
export const clinicalQuestionnaireAdapter = new ClinicalQuestionnaireAdapter();