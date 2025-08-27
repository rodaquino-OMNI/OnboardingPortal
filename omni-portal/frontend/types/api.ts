// API response types
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  success: boolean;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface DashboardSummary {
  totalUsers: number;
  activeQuestionnaireResponses: number;
  pendingInterviews: number;
  completedOnboardings: number;
  averageCompletionTime: number;
  healthRiskDistribution: {
    low: number;
    moderate: number;
    high: number;
    critical: number;
  };
}

export interface GamificationLevel {
  id: string;
  name: string;
  minPoints: number;
  maxPoints: number;
  rewards: string[];
  benefits: string[];
}

// Fix for clinical questionnaire types
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

export interface ClinicalAssessmentResults {
  scores: {
    overallSeverity: 'minimal' | 'mild' | 'moderate' | 'severe';
  };
  riskStratification: {
    level: 'low' | 'moderate' | 'high' | 'critical';
    confidenceScore: number;
    primaryConcerns: string[];
    timeToIntervention: number;
    escalationRequired: boolean;
  };
  emergencyDetected: boolean;
  emergencyProtocol?: EmergencyProtocol;
}