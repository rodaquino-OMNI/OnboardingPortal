// Health questionnaire types
export type QuestionValue = string | number | boolean | string[] | null;

export interface HealthQuestion {
  id: string;
  text: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'scale' | 'date';
  category: 'screening' | 'medical_history' | 'lifestyle' | 'mental_health' | 'validation';
  required: boolean;
  options?: Array<{
    value: string | number;
    label: string;
    description?: string;
  }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    crossCheck?: string[];
  };
  conditionalOn?: {
    questionId: string;
    values: QuestionValue[];
  };
  riskWeight?: number;
  validationPair?: string;
  metadata?: {
    clinicalCode?: string;
    validatedTool?: string;
    sensitiveInfo?: boolean;
  };
}

export interface HealthSection {
  id: string;
  title: string;
  description: string;
  questions: HealthQuestion[];
  estimatedMinutes: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  unlockCondition?: {
    previousSection: string;
    minScore?: number;
  };
}

export interface RiskScore {
  overall: number;
  cardiovascular: number;
  mental: number;
  metabolic: number;
  flags: string[];
  recommendation: 'low' | 'moderate' | 'high' | 'critical';
}

export interface FraudIndicators {
  inconsistencyScore: number;
  rapidResponseCount: number;
  patternAnomalies: string[];
  validationFailures: string[];
  recommendation: 'accept' | 'review' | 'flag';
}

export interface HealthQuestionnaireResponse {
  id: string;
  userId: string;
  responses: Record<string, QuestionValue>;
  riskScore?: RiskScore;
  fraudIndicators?: FraudIndicators;
  healthScore?: number;
  completedAt: string;
  metadata?: Record<string, any>;
}