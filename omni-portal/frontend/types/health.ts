// Health Assessment Types with Strict TypeScript

export interface HealthAssessmentResult {
  id: string;
  userId: string;
  assessmentType: 'simple' | 'progressive' | 'clinical' | 'immersive';
  completedAt: Date;
  score: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: HealthRecommendation[];
  insights: HealthInsight[];
  pathwayTaken: string;
}

export interface HealthRecommendation {
  id: string;
  category: 'lifestyle' | 'medical' | 'nutrition' | 'exercise' | 'mental_health' | 'risk_behaviors' | 'allergies' | 'substance_use';
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
  title: string;
  description: string;
  actionItems: string[];
  riskLevel?: 'low' | 'moderate' | 'high' | 'critical';
  clinicalCode?: string;
}

export interface HealthInsight {
  id: string;
  type: 'risk_factor' | 'positive_habit' | 'warning' | 'improvement_area' | 'allergy_alert' | 'substance_risk' | 'safety_concern';
  message: string;
  confidence: number;
  relatedQuestions: string[];
  instrument?: string;
  clinicalSignificance?: 'low' | 'moderate' | 'high' | 'critical';
}

export interface QuestionResponse {
  questionId: string;
  value: string | number | boolean | string[];
  timestamp: Date;
  confidence?: number;
  fraudRisk?: number;
}

export interface PathwayDecision {
  primaryPathway: 'simple' | 'progressive' | 'clinical';
  confidence: number;
  reasoning: string[];
  alternativePathways: Array<{
    pathway: string;
    score: number;
    reasoning: string;
  }>;
}

export interface ClinicalAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  type: 'symptom' | 'condition' | 'medication' | 'vital' | 'allergy' | 'substance_use' | 'self_harm' | 'violence';
  message: string;
  action: string;
  timestamp: Date;
  instrument?: string;
  requiresImmediateAction?: boolean;
  escalationLevel?: 'primary_care' | 'specialist' | 'emergency' | 'crisis_intervention';
}

export interface AssessmentProgress {
  currentStep: number;
  totalSteps: number;
  percentComplete: number;
  estimatedTimeRemaining: number;
  sectionsCompleted: string[];
  currentDomain: string;
  currentLayer: string;
  triggeredDomains: string[];
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
}

export interface HealthMetrics {
  bloodPressure?: {
    systolic: number;
    diastolic: number;
    unit: 'mmHg';
  };
  heartRate?: {
    value: number;
    unit: 'bpm';
  };
  weight?: {
    value: number;
    unit: 'kg' | 'lbs';
  };
  height?: {
    value: number;
    unit: 'cm' | 'ft';
  };
  bmi?: number;
  temperature?: {
    value: number;
    unit: 'C' | 'F';
  };
}

// Enhanced interfaces for comprehensive health assessment
export interface MentalHealthAssessment {
  instrument: 'PHQ-9' | 'GAD-7' | 'WHO-5' | 'Columbia Scale';
  score: number;
  severity: 'minimal' | 'mild' | 'moderate' | 'moderately_severe' | 'severe';
  responses: Record<string, number>;
  clinicalSignificance: boolean;
  recommendedActions: string[];
}

export interface AllergyProfile {
  allergens: Array<{
    type: 'food' | 'drug' | 'environmental' | 'insect' | 'latex' | 'other';
    substance: string;
    severity: 'mild' | 'moderate' | 'severe';
    symptoms: string[];
    epinephrineRequired?: boolean;
  }>;
  lastUpdated: Date;
  emergencyContact?: string;
}

export interface RiskBehaviorAssessment {
  substanceUse: {
    substances: string[];
    frequency: 'never' | 'once_twice' | 'monthly' | 'weekly' | 'daily';
    riskLevel: 'low' | 'moderate' | 'high' | 'severe';
    interventionNeeded: boolean;
  };
  sexualHealth: {
    riskBehaviors: string[];
    protectionUse: 'always' | 'sometimes' | 'never';
    screeningNeeded: boolean;
  };
  safetyAssessment: {
    selfHarmRisk: 'none' | 'low' | 'moderate' | 'high' | 'imminent';
    violenceExposure: boolean;
    safetyPlan?: string;
    emergencyContacts: string[];
  };
}

export interface ClinicalValidation {
  validationPairs: Array<{
    question1: string;
    question2: string;
    consistency: 'consistent' | 'inconsistent' | 'needs_review';
    fraudRisk: number;
  }>;
  overallFraudScore: number;
  dataQuality: 'high' | 'moderate' | 'low' | 'suspicious';
  recommendedActions: string[];
}