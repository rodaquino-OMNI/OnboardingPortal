// Session-Based Health Assessment with Advanced Detection Strategies
// Combines clinical rigor with conversational UX and sophisticated fraud detection

import type { QuestionValue } from '@/types';

export interface HealthSession {
  id: string;
  title: string;
  description: string;
  icon: string;
  estimatedMinutes: number;
  priority: 'required' | 'recommended' | 'optional';
  status: 'not_started' | 'in_progress' | 'completed' | 'flagged';
  category: 'emergency' | 'physical' | 'mental' | 'history' | 'lifestyle' | 'validation';
  questions: SessionQuestion[];
  detectionStrategies: DetectionStrategy[];
  completionRewards: {
    points: number;
    badges: string[];
  };
  prerequisites?: string[]; // Other sessions that should be completed first
}

export interface SessionQuestion {
  id: string;
  text: string;
  alternativeText?: string; // For validation pairs
  type: 'scale' | 'select' | 'multiselect' | 'boolean' | 'text' | 'number';
  clinicalPurpose: 'screening' | 'confirmation' | 'validation' | 'fraud_detection';
  detectionTechnique: 'direct' | 'indirect' | 'symptom_cluster' | 'temporal' | 'severity_escalation';
  options?: QuestionOption[];
  validationPair?: string; // ID of related question for cross-validation
  riskWeight: number;
  fraudFlags: FraudFlag[];
  expectedResponseTime: { min: number; max: number }; // In seconds
  metadata: {
    clinicalCode?: string;
    instrument?: string; // PHQ-9, GAD-7, etc.
    sensitiveLevel: 'low' | 'medium' | 'high' | 'critical';
    diseaseTargets: string[]; // Conditions this question helps detect
  };
}

export interface QuestionOption {
  value: QuestionValue;
  label: string;
  emoji?: string;
  riskScore: number;
  honestResponse?: boolean; // True if this is typically an honest high-risk response
  suggestsDeception?: boolean; // True if this response pattern suggests hiding something
}

export interface DetectionStrategy {
  type: 'clinical' | 'behavioral' | 'statistical' | 'temporal';
  technique: string;
  description: string;
  implementation: DetectionRule[];
}

export interface DetectionRule {
  trigger: ConditionalRule;
  action: 'flag_response' | 'ask_followup' | 'schedule_validation' | 'escalate_risk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message?: string;
}

export interface FraudFlag {
  type: 'response_time' | 'pattern_recognition' | 'statistical_outlier' | 'contradiction' | 'medical_impossibility';
  weight: number;
  description: string;
}

export interface ConditionalRule {
  questionId: string;
  operator: '>=' | '>' | '=' | '<=' | '<' | 'includes' | 'excludes' | 'pattern_match';
  value: QuestionValue;
}

// SESSION 1: BASIC INFO & EMERGENCY SCREENING
export const BASIC_INFO_SESSION: HealthSession = {
  id: 'basic_info',
  title: 'Informações Básicas',
  description: 'Vamos começar com algumas informações essenciais sobre você',
  icon: '👤',
  estimatedMinutes: 3,
  priority: 'required',
  status: 'not_started',
  category: 'emergency',
  completionRewards: {
    points: 100,
    badges: ['first_steps']
  },
  questions: [
    {
      id: 'age',
      text: 'Qual é sua idade?',
      type: 'number',
      clinicalPurpose: 'screening',
      detectionTechnique: 'direct',
      riskWeight: 1,
      fraudFlags: [
        {
          type: 'statistical_outlier',
          weight: 20,
          description: 'Age inconsistent with other demographic data'
        }
      ],
      expectedResponseTime: { min: 2, max: 15 },
      metadata: {
        sensitiveLevel: 'low',
        diseaseTargets: ['age_related_conditions']
      }
    },
    {
      id: 'biological_sex',
      text: 'Qual é seu sexo biológico ao nascer? (Importante para cálculos de risco médico precisos)',
      type: 'select',
      clinicalPurpose: 'screening',
      detectionTechnique: 'direct',
      riskWeight: 0,
      options: [
        { value: 'male', label: 'Masculino', riskScore: 0, honestResponse: true },
        { value: 'female', label: 'Feminino', riskScore: 0, honestResponse: true },
        { value: 'intersex', label: 'Intersexo', riskScore: 0, honestResponse: true }
      ],
      fraudFlags: [],
      expectedResponseTime: { min: 3, max: 20 },
      metadata: {
        clinicalCode: 'Z00.00',
        sensitiveLevel: 'medium',
        diseaseTargets: ['sex_specific_conditions']
      }
    },
    {
      id: 'emergency_symptoms',
      text: 'Você está sentindo algum destes sintomas AGORA? (Se sim, busque atendimento médico imediato)',
      alternativeText: 'Alguém já te disse para procurar um médico por causa destes sintomas?',
      type: 'multiselect',
      clinicalPurpose: 'screening',
      detectionTechnique: 'severity_escalation',
      riskWeight: 10,
      options: [
        { value: 'chest_pain', label: 'Dor no peito intensa', riskScore: 10, honestResponse: true },
        { value: 'breathing_severe', label: 'Muita dificuldade para respirar', riskScore: 10, honestResponse: true },
        { value: 'severe_bleeding', label: 'Sangramento que não para', riskScore: 10, honestResponse: true },
        { value: 'unconsciousness', label: 'Desmaios frequentes', riskScore: 8, honestResponse: true },
        { value: 'severe_pain', label: 'Dor insuportável (10/10)', riskScore: 8, honestResponse: true },
        { value: 'confusion', label: 'Confusão mental ou desorientação', riskScore: 7, honestResponse: true },
        { value: 'none', label: 'Nenhum destes sintomas', riskScore: 0, suggestsDeception: false }
      ],
      validationPair: 'recent_er_visits',
      fraudFlags: [
        {
          type: 'contradiction',
          weight: 30,
          description: 'Reports emergency symptoms but no recent medical care'
        }
      ],
      expectedResponseTime: { min: 10, max: 60 },
      metadata: {
        sensitiveLevel: 'critical',
        diseaseTargets: ['cardiovascular_emergency', 'respiratory_emergency', 'neurological_emergency']
      }
    }
  ],
  detectionStrategies: [
    {
      type: 'clinical',
      technique: 'Emergency Contradiction Detection',
      description: 'Cross-validate emergency symptoms with recent medical care',
      implementation: [
        {
          trigger: { questionId: 'emergency_symptoms', operator: 'excludes', value: 'none' },
          action: 'ask_followup',
          severity: 'high',
          message: 'Given these symptoms, have you sought medical care recently?'
        }
      ]
    }
  ]
};

// SESSION 2: PAIN & PHYSICAL HEALTH
export const PAIN_PHYSICAL_SESSION: HealthSession = {
  id: 'pain_physical',
  title: 'Dor e Saúde Física',
  description: 'Como está seu corpo? Vamos falar sobre dor e sintomas físicos',
  icon: '🩺',
  estimatedMinutes: 5,
  priority: 'required',
  status: 'not_started',
  category: 'physical',
  completionRewards: {
    points: 150,
    badges: ['physical_health_aware']
  },
  questions: [
    {
      id: 'pain_current',
      text: 'Em uma escala de 0 a 10, qual é sua dor AGORA neste momento?',
      type: 'scale',
      clinicalPurpose: 'screening',
      detectionTechnique: 'direct',
      riskWeight: 2,
      options: Array.from({ length: 11 }, (_, i) => ({
        value: i,
        label: i.toString(),
        emoji: i === 0 ? '😊' : i <= 3 ? '😐' : i <= 6 ? '😣' : i <= 9 ? '😫' : '😭',
        riskScore: i,
        honestResponse: i >= 1 // Any pain admission is honest
      })),
      fraudFlags: [
        {
          type: 'pattern_recognition',
          weight: 15,
          description: 'Always reports 0 pain despite other physical complaints'
        }
      ],
      expectedResponseTime: { min: 3, max: 15 },
      metadata: {
        sensitiveLevel: 'medium',
        diseaseTargets: ['chronic_pain', 'acute_conditions']
      }
    },
    {
      id: 'pain_affects_life',
      text: 'Você já deixou de fazer algo importante por causa de dor?',
      type: 'boolean',
      clinicalPurpose: 'validation',
      detectionTechnique: 'indirect',
      riskWeight: 3,
      validationPair: 'pain_current',
      fraudFlags: [
        {
          type: 'contradiction',
          weight: 25,
          description: 'Reports no current pain but pain affects daily life'
        }
      ],
      expectedResponseTime: { min: 5, max: 25 },
      metadata: {
        sensitiveLevel: 'medium',
        diseaseTargets: ['chronic_pain', 'functional_impairment']
      }
    },
    {
      id: 'unexplained_symptoms',
      text: 'Nos últimos 6 meses, você teve algum destes sintomas sem explicação médica?',
      type: 'multiselect',
      clinicalPurpose: 'screening',
      detectionTechnique: 'symptom_cluster',
      riskWeight: 4,
      options: [
        { value: 'fatigue', label: 'Cansaço extremo sem motivo aparente', riskScore: 3, honestResponse: true },
        { value: 'weight_loss', label: 'Perda de peso sem estar fazendo dieta', riskScore: 4, honestResponse: true },
        { value: 'weight_gain', label: 'Ganho de peso inexplicável', riskScore: 2, honestResponse: true },
        { value: 'fever', label: 'Febres recorrentes', riskScore: 4, honestResponse: true },
        { value: 'night_sweats', label: 'Suores noturnos intensos', riskScore: 3, honestResponse: true },
        { value: 'shortness_breath', label: 'Falta de ar em atividades simples', riskScore: 3, honestResponse: true },
        { value: 'heart_palpitations', label: 'Coração acelerado sem motivo', riskScore: 2, honestResponse: true },
        { value: 'vision_changes', label: 'Mudanças na visão', riskScore: 3, honestResponse: true },
        { value: 'hearing_changes', label: 'Mudanças na audição', riskScore: 2, honestResponse: true },
        { value: 'none', label: 'Nenhum destes sintomas', riskScore: 0, suggestsDeception: false }
      ],
      fraudFlags: [
        {
          type: 'pattern_recognition',
          weight: 20,
          description: 'Multiple serious symptoms but claims never saw doctor'
        }
      ],
      expectedResponseTime: { min: 15, max: 90 },
      metadata: {
        sensitiveLevel: 'high',
        diseaseTargets: ['autoimmune_disease', 'cancer', 'cardiovascular_disease', 'endocrine_disorders']
      }
    },
    {
      id: 'doctor_visits_last_year',
      text: 'Quantas vezes você foi ao médico no último ano? (Incluindo emergência, consultas, exames)',
      alternativeText: 'Alguém da sua família te levou ao médico recentemente?',
      type: 'select',
      clinicalPurpose: 'validation',
      detectionTechnique: 'temporal',
      riskWeight: 1,
      options: [
        { value: 0, label: 'Nenhuma vez', riskScore: 2, suggestsDeception: true },
        { value: 1, label: '1 vez', riskScore: 1, honestResponse: true },
        { value: 2, label: '2-3 vezes', riskScore: 0, honestResponse: true },
        { value: 4, label: '4-6 vezes', riskScore: 1, honestResponse: true },
        { value: 7, label: '7+ vezes', riskScore: 2, honestResponse: true }
      ],
      validationPair: 'unexplained_symptoms',
      fraudFlags: [
        {
          type: 'medical_impossibility',
          weight: 35,
          description: 'Multiple serious symptoms but zero medical visits'
        }
      ],
      expectedResponseTime: { min: 5, max: 30 },
      metadata: {
        sensitiveLevel: 'medium',
        diseaseTargets: ['healthcare_avoidance', 'undiagnosed_conditions']
      }
    }
  ],
  detectionStrategies: [
    {
      type: 'clinical',
      technique: 'Symptom-Care Correlation',
      description: 'Validate symptom severity against healthcare utilization',
      implementation: [
        {
          trigger: { questionId: 'unexplained_symptoms', operator: 'excludes', value: 'none' },
          action: 'ask_followup',
          severity: 'medium',
          message: 'Com esses sintomas, você procurou algum médico para investigar?'
        }
      ]
    },
    {
      type: 'behavioral',
      technique: 'Pain Consistency Check',
      description: 'Cross-validate pain levels with functional impact',
      implementation: [
        {
          trigger: { questionId: 'pain_current', operator: '>=', value: 6 },
          action: 'ask_followup',
          severity: 'medium',
          message: 'Com essa dor, como você consegue fazer suas atividades do dia a dia?'
        }
      ]
    }
  ]
};

// SESSION 3: MENTAL HEALTH & WELLBEING  
export const MENTAL_HEALTH_SESSION: HealthSession = {
  id: 'mental_health',
  title: 'Bem-estar Mental',
  description: 'Como você tem se sentido? Vamos conversar sobre seu bem-estar emocional',
  icon: '🧠',
  estimatedMinutes: 6,
  priority: 'required',
  status: 'not_started',
  category: 'mental',
  completionRewards: {
    points: 200,
    badges: ['mental_wellness_champion']
  },
  questions: [
    {
      id: 'mood_lately',
      text: 'Como você descreveria seu humor nas últimas 2 semanas?',
      type: 'select',
      clinicalPurpose: 'screening',
      detectionTechnique: 'indirect',
      riskWeight: 3,
      options: [
        { value: 'excellent', label: 'Excelente - me sinto ótimo!', riskScore: 0, honestResponse: true },
        { value: 'good', label: 'Bom - normal para mim', riskScore: 0, honestResponse: true },
        { value: 'okay', label: 'Ok - alguns altos e baixos', riskScore: 1, honestResponse: true },
        { value: 'difficult', label: 'Difícil - mais baixos que altos', riskScore: 3, honestResponse: true },
        { value: 'very_difficult', label: 'Muito difícil - principalmente baixo', riskScore: 5, honestResponse: true }
      ],
      fraudFlags: [
        {
          type: 'pattern_recognition',
          weight: 15,
          description: 'Always reports excellent mood despite other indicators'
        }
      ],
      expectedResponseTime: { min: 5, max: 30 },
      metadata: {
        sensitiveLevel: 'medium',
        diseaseTargets: ['depression', 'bipolar_disorder', 'anxiety_disorders']
      }
    },
    {
      id: 'phq2_interest',
      text: 'Nas últimas 2 semanas, você teve pouco interesse ou prazer em fazer as coisas?',
      type: 'select',
      clinicalPurpose: 'screening',
      detectionTechnique: 'direct',
      riskWeight: 4,
      options: [
        { value: 0, label: 'Nunca', riskScore: 0, honestResponse: true },
        { value: 1, label: 'Alguns dias', riskScore: 1, honestResponse: true },
        { value: 2, label: 'Mais da metade dos dias', riskScore: 3, honestResponse: true },
        { value: 3, label: 'Quase todos os dias', riskScore: 5, honestResponse: true }
      ],
      validationPair: 'mood_lately',
      fraudFlags: [
        {
          type: 'contradiction',
          weight: 25,
          description: 'Reports excellent mood but lacks interest in activities'
        }
      ],
      expectedResponseTime: { min: 8, max: 45 },
      metadata: {
        clinicalCode: 'F32.9',
        sensitiveLevel: 'high',
        diseaseTargets: ['major_depression', 'dysthymia']
      }
    },
    {
      id: 'anxiety_worry',
      text: 'Você se preocupa mais do que outras pessoas dizem que é normal?',
      type: 'boolean',
      clinicalPurpose: 'screening',
      detectionTechnique: 'indirect',
      riskWeight: 3,
      fraudFlags: [
        {
          type: 'response_time',
          weight: 10,
          description: 'Answered too quickly for reflection on anxiety patterns'
        }
      ],
      expectedResponseTime: { min: 8, max: 40 },
      metadata: {
        sensitiveLevel: 'medium',
        diseaseTargets: ['generalized_anxiety', 'panic_disorder']
      }
    },
    {
      id: 'sleep_quality',
      text: 'Seu sono tem sido...',
      type: 'select',
      clinicalPurpose: 'screening',
      detectionTechnique: 'symptom_cluster',
      riskWeight: 2,
      options: [
        { value: 'excellent', label: 'Excelente - durmo bem e acordo descansado', riskScore: 0, honestResponse: true },
        { value: 'good', label: 'Bom - algumas noites ruins ocasionais', riskScore: 0, honestResponse: true },
        { value: 'fair', label: 'Regular - acordo cansado às vezes', riskScore: 1, honestResponse: true },
        { value: 'poor', label: 'Ruim - dificuldade para dormir ou acordar', riskScore: 2, honestResponse: true },
        { value: 'terrible', label: 'Terrível - mal consigo dormir', riskScore: 3, honestResponse: true }
      ],
      fraudFlags: [],
      expectedResponseTime: { min: 5, max: 25 },
      metadata: {
        sensitiveLevel: 'medium',
        diseaseTargets: ['depression', 'anxiety', 'sleep_disorders']
      }
    },
    {
      id: 'harmful_thoughts',
      text: 'Às vezes, quando as pessoas passam por momentos difíceis, têm pensamentos sobre se machucar. Isso já aconteceu com você?',
      alternativeText: 'Você já pensou que seria melhor se não estivesse aqui?',
      type: 'boolean',
      clinicalPurpose: 'screening',
      detectionTechnique: 'severity_escalation',
      riskWeight: 10,
      fraudFlags: [
        {
          type: 'response_time',
          weight: 20,
          description: 'Answered too quickly for such a serious question'
        }
      ],
      expectedResponseTime: { min: 15, max: 120 },
      metadata: {
        clinicalCode: 'R45.851',
        sensitiveLevel: 'critical',
        diseaseTargets: ['suicidal_ideation', 'major_depression']
      }
    }
  ],
  detectionStrategies: [
    {
      type: 'clinical',
      technique: 'Suicide Risk Protocol',
      description: 'Immediate escalation for any positive suicide screening',
      implementation: [
        {
          trigger: { questionId: 'harmful_thoughts', operator: '=', value: true },
          action: 'escalate_risk',
          severity: 'critical',
          message: 'Immediate safety assessment required'
        }
      ]
    },
    {
      type: 'behavioral',
      technique: 'Mood-Interest Correlation',
      description: 'Validate mood reports against interest levels',
      implementation: [
        {
          trigger: { questionId: 'mood_lately', operator: '=', value: 'excellent' },
          action: 'flag_response',
          severity: 'low',
          message: 'Monitor for potential mood minimization'
        }
      ]
    }
  ]
};

// Enhanced Detection Engine
export class SessionBasedDetectionEngine {
  private sessionResponses: Map<string, Record<string, any>> = new Map();
  private detectionFlags: DetectionFlag[] = [];
  private responseTimings: Map<string, number> = new Map();

  recordResponse(sessionId: string, questionId: string, value: QuestionValue, responseTime: number): void {
    // Store response
    if (!this.sessionResponses.has(sessionId)) {
      this.sessionResponses.set(sessionId, {});
    }
    this.sessionResponses.get(sessionId)![questionId] = value;
    this.responseTimings.set(`${sessionId}_${questionId}`, responseTime);

    // Run detection algorithms
    this.runDetectionAlgorithms(sessionId, questionId, value, responseTime);
  }

  private runDetectionAlgorithms(sessionId: string, questionId: string, value: QuestionValue, responseTime: number): void {
    // 1. Response Time Analysis
    this.analyzeResponseTime(sessionId, questionId, responseTime);
    
    // 2. Cross-Session Consistency
    this.analyzeCrossSessionConsistency(sessionId, questionId, value);
    
    // 3. Medical Impossibility Detection
    this.analyzemedicalImpossibilities(sessionId, questionId, value);
    
    // 4. Statistical Outlier Detection
    this.analyzeStatisticalOutliers(sessionId, questionId, value);
  }

  private analyzeResponseTime(sessionId: string, questionId: string, responseTime: number): void {
    // Get expected response time for this question
    const question = this.getQuestionById(sessionId, questionId);
    if (!question) return;

    const { min, max } = question.expectedResponseTime;
    
    if (responseTime < min) {
      this.addDetectionFlag({
        type: 'response_time',
        severity: 'medium',
        message: `Response too fast (${responseTime}s) - may not have read question properly`,
        questionId,
        sessionId,
        weight: 15
      });
    } else if (responseTime > max) {
      this.addDetectionFlag({
        type: 'response_time',
        severity: 'low',
        message: `Response very slow (${responseTime}s) - may indicate overthinking or deception`,
        questionId,
        sessionId,
        weight: 10
      });
    }
  }

  private analyzeCrossSessionConsistency(sessionId: string, questionId: string, value: QuestionValue): void {
    // Check for contradictions across sessions
    // For example: Reports no pain in pain session but says pain affects sleep in lifestyle session
    
    const allResponses = Array.from(this.sessionResponses.values()).reduce((acc, session) => ({...acc, ...session}), {});
    
    // Specific consistency checks
    if (questionId === 'pain_current' && value === 0) {
      // Check if they reported pain affecting life in other sessions
      if (allResponses['pain_affects_life'] === true) {
        this.addDetectionFlag({
          type: 'contradiction',
          severity: 'medium',
          message: 'Reports no current pain but says pain affects daily life',
          questionId,
          sessionId,
          weight: 25
        });
      }
    }

    if (questionId === 'emergency_symptoms' && !value.includes('none')) {
      // Check if they reported no doctor visits
      if (allResponses['doctor_visits_last_year'] === 0) {
        this.addDetectionFlag({
          type: 'medical_impossibility',
          severity: 'high',
          message: 'Reports emergency symptoms but no medical care',
          questionId,
          sessionId,
          weight: 35
        });
      }
    }
  }

  private analyzemedicalImpossibilities(sessionId: string, questionId: string, value: QuestionValue): void {
    const allResponses = Array.from(this.sessionResponses.values()).reduce((acc, session) => ({...acc, ...session}), {});
    
    // Age-condition inconsistencies
    const age = allResponses['age'];
    if (age && age < 25) {
      // Check for too many chronic conditions for young age
      const chronicConditions = allResponses['chronic_conditions'];
      if (Array.isArray(chronicConditions) && chronicConditions.length > 3) {
        this.addDetectionFlag({
          type: 'medical_impossibility',
          severity: 'medium',
          message: 'Unusual number of chronic conditions for reported age',
          questionId,
          sessionId,
          weight: 20
        });
      }
    }
  }

  private analyzeStatisticalOutliers(sessionId: string, questionId: string, value: QuestionValue): void {
    // Pattern: All responses are extremes (all 0s or all 10s)
    const currentSessionResponses = this.sessionResponses.get(sessionId) || {};
    const numericResponses = Object.values(currentSessionResponses).filter(v => typeof v === 'number');
    
    if (numericResponses.length >= 3) {
      const allSame = numericResponses.every(v => v === numericResponses[0]);
      const allExtremes = numericResponses.every(v => v === 0 || v >= 8);
      
      if (allSame || allExtremes) {
        this.addDetectionFlag({
          type: 'pattern_recognition',
          severity: 'medium',
          message: 'Unusual response pattern detected - all similar values',
          questionId,
          sessionId,
          weight: 20
        });
      }
    }
  }

  private addDetectionFlag(flag: DetectionFlag): void {
    this.detectionFlags.push(flag);
  }

  private getQuestionById(sessionId: string, questionId: string): SessionQuestion | null {
    // This would lookup the question from the session definition
    // Implementation depends on how sessions are stored
    return null; // Placeholder
  }

  getDetectionReport(): DetectionReport {
    const totalWeight = this.detectionFlags.reduce((sum, flag) => sum + flag.weight, 0);
    
    return {
      overallRiskScore: Math.min(totalWeight, 100),
      flags: this.detectionFlags,
      recommendation: totalWeight > 50 ? 'manual_review' : totalWeight > 25 ? 'automated_validation' : 'accept',
      sessionsCompleted: this.sessionResponses.size,
      crossSessionInconsistencies: this.detectionFlags.filter(f => f.type === 'contradiction').length
    };
  }
}

export interface DetectionFlag {
  type: 'response_time' | 'contradiction' | 'medical_impossibility' | 'pattern_recognition' | 'statistical_outlier';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  questionId: string;
  sessionId: string;
  weight: number;
}

export interface DetectionReport {
  overallRiskScore: number;
  flags: DetectionFlag[];
  recommendation: 'accept' | 'automated_validation' | 'manual_review';
  sessionsCompleted: number;
  crossSessionInconsistencies: number;
}

// Session Manager
export class HealthSessionManager {
  private sessions: HealthSession[] = [
    BASIC_INFO_SESSION,
    PAIN_PHYSICAL_SESSION,
    MENTAL_HEALTH_SESSION
    // Add other sessions here
  ];

  private detectionEngine = new SessionBasedDetectionEngine();

  getAvailableSessions(): HealthSession[] {
    return this.sessions;
  }

  getSessionById(id: string): HealthSession | null {
    return this.sessions.find(s => s.id === id) || null;
  }

  recordResponse(sessionId: string, questionId: string, value: QuestionValue, responseTime: number): void {
    this.detectionEngine.recordResponse(sessionId, questionId, value, responseTime);
  }

  getDetectionReport(): DetectionReport {
    return this.detectionEngine.getDetectionReport();
  }

  calculateOverallCompletionStatus(): {
    completed: number;
    total: number;
    percentage: number;
    requiredRemaining: number;
  } {
    const completed = this.sessions.filter(s => s.status === 'completed').length;
    const total = this.sessions.length;
    const requiredRemaining = this.sessions.filter(s => s.priority === 'required' && s.status !== 'completed').length;
    
    return {
      completed,
      total,
      percentage: Math.round((completed / total) * 100),
      requiredRemaining
    };
  }
}