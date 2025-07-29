// Clinical Decision Engine - Production Implementation
// Aligned with HEALTHCARE_QUESTIONNAIRE_EXCELLENCE_STRATEGY.md Phase 1 requirements

export interface ClinicalDecision {
  condition: string;
  icd10Code: string;
  severity: 'minimal' | 'mild' | 'moderate' | 'severe' | 'critical';
  confidenceLevel: number; // 0-100
  recommendedActions: ClinicalAction[];
  emergencyProtocol?: EmergencyProtocol;
  timeToIntervention: number; // hours
}

export interface ClinicalAction {
  type: 'immediate' | 'urgent' | 'routine' | 'follow_up';
  description: string;
  evidenceLevel: 'A' | 'B' | 'C' | 'Expert';
  priority: number; // 1-10
  timeframe: string;
}

export interface EmergencyProtocol {
  severity: 'moderate' | 'severe' | 'critical';
  immediateActions: string[];
  contactNumbers: Array<{
    name: string;
    number: string;
    available24h: boolean;
  }>;
  safetyPlan: string[];
  followUpRequired: boolean;
}

export class ClinicalDecisionEngine {
  private static instance: ClinicalDecisionEngine;
  
  public static getInstance(): ClinicalDecisionEngine {
    if (!ClinicalDecisionEngine.instance) {
      ClinicalDecisionEngine.instance = new ClinicalDecisionEngine();
    }
    return ClinicalDecisionEngine.instance;
  }

  // Enhanced PHQ-9 Analysis with ICD-10 Coding
  public analyzePHQ9(responses: Record<string, number>): ClinicalDecision {
    const phq9Questions = [
      'phq9_1', 'phq9_2', 'phq9_3', 'phq9_4', 'phq9_5',
      'phq9_6', 'phq9_7', 'phq9_8', 'phq9_9'
    ];

    const totalScore = phq9Questions.reduce((sum, questionId) => {
      return sum + (responses[questionId] || 0);
    }, 0);

    // Critical suicide risk assessment
    const suicideRisk = responses['phq9_9'] || 0;
    
    if (suicideRisk > 0) {
      return {
        condition: 'Depressive Disorder with Suicidal Ideation',
        icd10Code: 'F32.9',
        severity: suicideRisk >= 2 ? 'critical' : 'severe',
        confidenceLevel: 95,
        recommendedActions: [
          {
            type: 'immediate',
            description: 'Emergency psychiatric evaluation required',
            evidenceLevel: 'A',
            priority: 10,
            timeframe: 'Immediate'
          },
          {
            type: 'immediate',
            description: 'Safety plan development',
            evidenceLevel: 'A',
            priority: 9,
            timeframe: 'Within 1 hour'
          }
        ],
        emergencyProtocol: {
          severity: suicideRisk >= 2 ? 'critical' : 'severe',
          immediateActions: [
            'Do not leave person alone',
            'Remove access to means of self-harm',
            'Contact emergency services if immediate danger'
          ],
          contactNumbers: [
            { name: 'CVV - Centro de Valorização da Vida', number: '188', available24h: true },
            { name: 'SAMU', number: '192', available24h: true },
            { name: 'Emergência Psiquiátrica', number: '190', available24h: true }
          ],
          safetyPlan: [
            'Identify warning signs',
            'Create coping strategies',
            'Identify support persons',
            'Remove or secure lethal means',
            'Create emergency contact list'
          ],
          followUpRequired: true
        },
        timeToIntervention: 0
      };
    }

    // Standard depression severity assessment
    let severity: 'minimal' | 'mild' | 'moderate' | 'severe' | 'critical';
    let icd10Code: string;
    let timeToIntervention: number;

    if (totalScore >= 20) {
      severity = 'severe';
      icd10Code = 'F32.2'; // Major depressive disorder, severe
      timeToIntervention = 24;
    } else if (totalScore >= 15) {
      severity = 'moderate';
      icd10Code = 'F32.1'; // Major depressive disorder, moderate
      timeToIntervention = 72;
    } else if (totalScore >= 10) {
      severity = 'mild';
      icd10Code = 'F32.0'; // Major depressive disorder, mild
      timeToIntervention = 168; // 1 week
    } else if (totalScore >= 5) {
      severity = 'minimal';
      icd10Code = 'Z13.89'; // Encounter for screening
      timeToIntervention = 720; // 30 days
    } else {
      severity = 'minimal';
      icd10Code = 'Z00.00'; // General health screening
      timeToIntervention = 8760; // 1 year
    }

    return {
      condition: `Depressive Symptoms - ${severity}`,
      icd10Code,
      severity,
      confidenceLevel: totalScore >= 15 ? 90 : 75,
      recommendedActions: this.getDepressionRecommendations(severity),
      timeToIntervention
    };
  }

  // Enhanced GAD-7 Analysis
  public analyzeGAD7(responses: Record<string, number>): ClinicalDecision {
    const gad7Questions = ['gad7_1', 'gad7_2', 'gad7_3', 'gad7_4', 'gad7_5', 'gad7_6', 'gad7_7'];
    
    const totalScore = gad7Questions.reduce((sum, questionId) => {
      return sum + (responses[questionId] || 0);
    }, 0);

    let severity: 'minimal' | 'mild' | 'moderate' | 'severe' | 'critical';
    let icd10Code: string;
    let timeToIntervention: number;

    if (totalScore >= 15) {
      severity = 'severe';
      icd10Code = 'F41.1'; // Generalized anxiety disorder
      timeToIntervention = 24;
    } else if (totalScore >= 10) {
      severity = 'moderate';
      icd10Code = 'F41.1';
      timeToIntervention = 72;
    } else if (totalScore >= 5) {
      severity = 'mild';
      icd10Code = 'F41.9'; // Anxiety disorder, unspecified
      timeToIntervention = 168;
    } else {
      severity = 'minimal';
      icd10Code = 'Z13.89';
      timeToIntervention = 720;
    }

    return {
      condition: `Anxiety Disorder - ${severity}`,
      icd10Code,
      severity,
      confidenceLevel: totalScore >= 10 ? 85 : 70,
      recommendedActions: this.getAnxietyRecommendations(severity),
      timeToIntervention
    };
  }

  // Comprehensive Multi-Condition Analysis
  public analyzeComprehensive(responses: Record<string, any>): ClinicalDecision[] {
    const decisions: ClinicalDecision[] = [];

    // Analyze depression
    const depressionDecision = this.analyzePHQ9(responses);
    decisions.push(depressionDecision);

    // Analyze anxiety
    const anxietyDecision = this.analyzeGAD7(responses);
    decisions.push(anxietyDecision);

    // Additional clinical assessments can be added here
    // - Cardiovascular risk
    // - Substance use disorders
    // - Eating disorders
    // - Sleep disorders

    return decisions.sort((a, b) => b.confidenceLevel - a.confidenceLevel);
  }

  private getDepressionRecommendations(severity: string): ClinicalAction[] {
    const baseRecommendations = [
      {
        type: 'routine' as const,
        description: 'Regular mental health monitoring',
        evidenceLevel: 'A' as const,
        priority: 5,
        timeframe: 'Ongoing'
      }
    ];

    if (severity === 'severe') {
      return [
        {
          type: 'urgent',
          description: 'Psychiatric evaluation within 24-48 hours',
          evidenceLevel: 'A',
          priority: 9,
          timeframe: '24-48 hours'
        },
        {
          type: 'urgent',
          description: 'Consider medication management',
          evidenceLevel: 'A',
          priority: 8,
          timeframe: '1 week'
        },
        ...baseRecommendations
      ];
    } else if (severity === 'moderate') {
      return [
        {
          type: 'urgent',
          description: 'Mental health counseling referral',
          evidenceLevel: 'A',
          priority: 7,
          timeframe: '1-2 weeks'
        },
        ...baseRecommendations
      ];
    }

    return baseRecommendations;
  }

  private getAnxietyRecommendations(severity: string): ClinicalAction[] {
    const baseRecommendations = [
      {
        type: 'routine' as const,
        description: 'Stress management education',
        evidenceLevel: 'B' as const,
        priority: 4,
        timeframe: '2-4 weeks'
      }
    ];

    if (severity === 'severe') {
      return [
        {
          type: 'urgent',
          description: 'Anxiety disorder evaluation',
          evidenceLevel: 'A',
          priority: 8,
          timeframe: '1 week'
        },
        {
          type: 'routine',
          description: 'Cognitive behavioral therapy referral',
          evidenceLevel: 'A',
          priority: 7,
          timeframe: '2-3 weeks'
        },
        ...baseRecommendations
      ];
    }

    return baseRecommendations;
  }
}

// Export singleton instance
export const clinicalDecisionEngine = ClinicalDecisionEngine.getInstance();