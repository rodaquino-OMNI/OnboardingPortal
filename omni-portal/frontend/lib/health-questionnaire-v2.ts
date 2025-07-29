// Advanced Health Questionnaire System V2
// Implements evidence-based screening tools with fraud detection

import type { QuestionValue } from '@/types';

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
    crossCheck?: string[]; // IDs of related questions for consistency checking
  };
  conditionalOn?: {
    questionId: string;
    values: QuestionValue[];
  };
  riskWeight?: number; // For ML risk scoring
  validationPair?: string; // ID of paired question for consistency check
  metadata?: {
    clinicalCode?: string; // ICD-10, SNOMED codes
    validatedTool?: string; // PHQ-9, GAD-7, etc.
    sensitiveInfo?: boolean; // For handling sensitive medical data
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

// Validated clinical screening tools
export const PHQ9_QUESTIONS: HealthQuestion[] = [
  {
    id: 'phq9_1',
    text: 'Nas últimas 2 semanas, com que frequência você teve pouco interesse ou prazer em fazer as coisas?',
    type: 'select',
    category: 'mental_health',
    required: true,
    metadata: { validatedTool: 'PHQ-9' }
  },
  {
    id: 'phq9_2',
    text: 'Nas últimas 2 semanas, com que frequência você se sentiu deprimido, triste ou sem esperança?',
    type: 'select',
    category: 'mental_health',
    required: true,
    metadata: { validatedTool: 'PHQ-9' }
  },
  // ... rest of PHQ-9 questions
  {
    id: 'phq9_9',
    text: 'Nas últimas 2 semanas, teve pensamentos de que seria melhor estar morto ou de se machucar?',
    type: 'select',
    category: 'mental_health',
    required: true,
    riskWeight: 10, // Highest risk weight for suicide screening
    metadata: { validatedTool: 'PHQ-9', clinicalCode: 'R45.851' }
  }
];

export const GAD7_QUESTIONS: HealthQuestion[] = [
  {
    id: 'gad7_1',
    text: 'Nas últimas 2 semanas, com que frequência você se sentiu nervoso, ansioso ou no limite?',
    type: 'select',
    category: 'mental_health',
    required: true,
    metadata: { validatedTool: 'GAD-7' }
  },
  // ... rest of GAD-7 questions
];

// Consistency check questions (paired for fraud detection)
export const VALIDATION_PAIRS: HealthQuestion[] = [
  {
    id: 'height_1',
    text: 'Qual é sua altura em centímetros?',
    type: 'number',
    category: 'validation',
    required: true,
    validation: { min: 120, max: 250 },
    validationPair: 'height_2'
  },
  {
    id: 'height_2',
    text: 'Por favor, confirme sua altura (será usado para cálculos médicos importantes)',
    type: 'number',
    category: 'validation',
    required: true,
    validation: { min: 120, max: 250 },
    validationPair: 'height_1',
    conditionalOn: { questionId: 'height_1', values: ['*'] } // Show if height_1 has any value
  },
  {
    id: 'smoking_status',
    text: 'Você fuma ou já fumou?',
    type: 'select',
    category: 'lifestyle',
    required: true,
    validationPair: 'smoking_validation',
    options: [
      { value: 'never', label: 'Nunca fumei' },
      { value: 'former', label: 'Ex-fumante' },
      { value: 'current', label: 'Fumante atual' }
    ]
  },
  {
    id: 'smoking_validation',
    text: 'Algum médico já recomendou que você parasse de fumar?',
    type: 'boolean',
    category: 'validation',
    required: false,
    validationPair: 'smoking_status',
    conditionalOn: { questionId: 'smoking_status', values: ['current', 'former'] }
  }
];

// Progressive disclosure sections
export const HEALTH_QUESTIONNAIRE_SECTIONS: HealthSection[] = [
  {
    id: 'initial_screening',
    title: 'Avaliação Inicial Rápida',
    description: 'Algumas perguntas rápidas para personalizar sua experiência',
    estimatedMinutes: 2,
    priority: 'critical',
    questions: [
      {
        id: 'age',
        text: 'Qual é sua idade?',
        type: 'number',
        category: 'screening',
        required: true,
        validation: { min: 18, max: 120 }
      },
      {
        id: 'biological_sex',
        text: 'Qual é seu sexo biológico ao nascer? (Esta informação é importante para avaliações médicas e cálculos de risco à saúde)',
        type: 'select',
        category: 'screening',
        required: true,
        options: [
          { value: 'male', label: 'Masculino' },
          { value: 'female', label: 'Feminino' },
          { value: 'intersex', label: 'Intersexo' }
        ],
        metadata: { 
          clinicalCode: 'Z00.00',
          sensitiveInfo: true 
        }
      },
      {
        id: 'emergency_conditions',
        text: 'Você tem alguma destas condições que requerem atenção especial?',
        type: 'multiselect',
        category: 'screening',
        required: true,
        riskWeight: 8,
        options: [
          { value: 'pregnancy', label: 'Gravidez' },
          { value: 'recent_surgery', label: 'Cirurgia recente (últimos 30 dias)' },
          { value: 'active_cancer_treatment', label: 'Tratamento ativo de câncer' },
          { value: 'immunosuppressed', label: 'Sistema imunológico comprometido' },
          { value: 'chest_pain', label: 'Dor no peito atual' },
          { value: 'breathing_difficulty', label: 'Dificuldade respiratória atual' },
          { value: 'none', label: 'Nenhuma das acima' }
        ]
      }
    ]
  },
  {
    id: 'medical_history',
    title: 'Histórico Médico',
    description: 'Informações sobre sua saúde passada e atual',
    estimatedMinutes: 5,
    priority: 'high',
    questions: [
      {
        id: 'chronic_conditions',
        text: 'Selecione todas as condições que você tem ou teve:',
        type: 'multiselect',
        category: 'medical_history',
        required: true,
        riskWeight: 5,
        options: [
          { value: 'diabetes', label: 'Diabetes' },
          { value: 'hypertension', label: 'Hipertensão (Pressão Alta)' },
          { value: 'heart_disease', label: 'Doença Cardíaca' },
          { value: 'respiratory_disease', label: 'Doença Respiratória (Asma, DPOC)' },
          { value: 'cancer', label: 'Câncer' },
          { value: 'kidney_disease', label: 'Doença Renal' },
          { value: 'liver_disease', label: 'Doença Hepática' },
          { value: 'thyroid', label: 'Problemas de Tireoide' },
          { value: 'arthritis', label: 'Artrite/Artrose' },
          { value: 'mental_health', label: 'Condições de Saúde Mental' },
          { value: 'none', label: 'Nenhuma das acima' }
        ]
      },
      {
        id: 'condition_details',
        text: 'Para cada condição selecionada, quando foi diagnosticada?',
        type: 'text',
        category: 'medical_history',
        required: false,
        conditionalOn: { questionId: 'chronic_conditions', values: ['*'] }
      },
      {
        id: 'medications_current',
        text: 'Liste todos os medicamentos que você toma regularmente',
        type: 'text',
        category: 'medical_history',
        required: true,
        validation: { 
          crossCheck: ['medication_allergies', 'chronic_conditions']
        }
      },
      {
        id: 'surgeries',
        text: 'Você já fez alguma cirurgia? Se sim, quais e quando?',
        type: 'text',
        category: 'medical_history',
        required: false,
        validationPair: 'hospitalization_history'
      },
      {
        id: 'hospitalization_history',
        text: 'Quantas vezes você foi hospitalizado nos últimos 5 anos?',
        type: 'number',
        category: 'validation',
        required: true,
        validation: { min: 0, max: 50 },
        validationPair: 'surgeries'
      }
    ]
  },
  {
    id: 'family_history',
    title: 'Histórico Familiar',
    description: 'Condições de saúde em sua família',
    estimatedMinutes: 3,
    priority: 'medium',
    questions: [
      {
        id: 'family_conditions',
        text: 'Algum familiar direto (pais, irmãos) tem estas condições?',
        type: 'multiselect',
        category: 'medical_history',
        required: true,
        riskWeight: 3,
        options: [
          { value: 'diabetes', label: 'Diabetes' },
          { value: 'hypertension', label: 'Hipertensão' },
          { value: 'heart_disease', label: 'Doença Cardíaca' },
          { value: 'stroke', label: 'AVC (Derrame)' },
          { value: 'cancer', label: 'Câncer' },
          { value: 'mental_health', label: 'Transtornos Mentais' },
          { value: 'alzheimer', label: 'Alzheimer/Demência' },
          { value: 'none', label: 'Nenhuma das acima' }
        ]
      },
      {
        id: 'family_early_death',
        text: 'Algum familiar direto faleceu antes dos 60 anos por causas naturais?',
        type: 'boolean',
        category: 'medical_history',
        required: true,
        riskWeight: 4
      }
    ]
  },
  {
    id: 'lifestyle_assessment',
    title: 'Estilo de Vida',
    description: 'Hábitos que afetam sua saúde',
    estimatedMinutes: 4,
    priority: 'medium',
    questions: [
      ...VALIDATION_PAIRS.filter(q => q.category === 'lifestyle'),
      {
        id: 'exercise_frequency',
        text: 'Quantos dias por semana você pratica exercícios por pelo menos 30 minutos?',
        type: 'number',
        category: 'lifestyle',
        required: true,
        validation: { min: 0, max: 7 }
      },
      {
        id: 'alcohol_consumption',
        text: 'Quantas doses de álcool você consome por semana?',
        type: 'number',
        category: 'lifestyle',
        required: true,
        validation: { min: 0, max: 100 },
        riskWeight: 2
      },
      {
        id: 'sleep_hours',
        text: 'Quantas horas você dorme em média por noite?',
        type: 'number',
        category: 'lifestyle',
        required: true,
        validation: { min: 0, max: 24 }
      }
    ]
  },
  {
    id: 'mental_health_screening',
    title: 'Bem-estar Mental',
    description: 'Avaliação de saúde mental validada clinicamente',
    estimatedMinutes: 5,
    priority: 'high',
    unlockCondition: {
      previousSection: 'initial_screening',
      minScore: 0
    },
    questions: [
      ...PHQ9_QUESTIONS.slice(0, 2), // PHQ-2 for initial screening
      {
        id: 'phq2_followup',
        text: 'Você gostaria de responder mais perguntas sobre seu bem-estar emocional?',
        type: 'boolean',
        category: 'mental_health',
        required: true
      },
      // Full PHQ-9 if PHQ-2 positive or user wants to continue
      ...PHQ9_QUESTIONS.slice(2).map(q => ({
        ...q,
        conditionalOn: { questionId: 'phq2_followup', values: [true] }
      })),
      ...GAD7_QUESTIONS.map(q => ({
        ...q,
        conditionalOn: { questionId: 'phq2_followup', values: [true] }
      }))
    ]
  },
  {
    id: 'risk_behaviors',
    title: 'Fatores de Risco',
    description: 'Identificação de comportamentos de risco',
    estimatedMinutes: 3,
    priority: 'high',
    questions: [
      {
        id: 'substance_use',
        text: 'Você já usou substâncias não prescritas para lidar com stress ou problemas?',
        type: 'boolean',
        category: 'screening',
        required: true,
        riskWeight: 6
      },
      {
        id: 'driving_habits',
        text: 'Você sempre usa cinto de segurança ao dirigir ou andar de carro?',
        type: 'boolean',
        category: 'lifestyle',
        required: true
      },
      {
        id: 'sexual_health',
        text: 'Você faz exames regulares de saúde sexual?',
        type: 'boolean',
        category: 'screening',
        required: false
      }
    ]
  },
  {
    id: 'validation_section',
    title: 'Confirmação de Dados',
    description: 'Por favor, confirme algumas informações para garantir a precisão',
    estimatedMinutes: 2,
    priority: 'critical',
    questions: VALIDATION_PAIRS.filter(q => q.category === 'validation')
  }
];

// Risk scoring algorithm
export interface RiskScore {
  overall: number;
  categories: {
    cardiovascular: number;
    mental_health: number;
    substance_abuse: number;
    chronic_disease: number;
  };
  flags: string[];
  recommendations: string[];
}

export function calculateRiskScore(responses: Record<string, any>): RiskScore {
  const score: RiskScore = {
    overall: 0,
    categories: {
      cardiovascular: 0,
      mental_health: 0,
      substance_abuse: 0,
      chronic_disease: 0
    },
    flags: [],
    recommendations: []
  };

  // PHQ-9 scoring
  const phq9Score = Object.keys(responses)
    .filter(key => key.startsWith('phq9_'))
    .reduce((sum, key) => sum + (responses[key] || 0), 0);
  
  if (phq9Score >= 10) {
    score.categories.mental_health = phq9Score;
    score.flags.push('moderate_depression');
  }
  
  // Validate PHQ-9 question 9 response before flagging suicide risk
  if (responses.phq9_9 !== undefined && 
      responses.phq9_9 !== null && 
      typeof responses.phq9_9 === 'number' && 
      responses.phq9_9 > 0) {
    score.flags.push('suicide_risk');
    score.recommendations.push('Encaminhamento urgente para profissional de saúde mental');
  }

  // GAD-7 scoring
  const gad7Score = Object.keys(responses)
    .filter(key => key.startsWith('gad7_'))
    .reduce((sum, key) => sum + (responses[key] || 0), 0);
  
  if (gad7Score >= 8) {
    score.categories.mental_health += gad7Score;
    score.flags.push('anxiety_disorder');
  }

  // Cardiovascular risk factors
  const cvRiskFactors = [
    responses.chronic_conditions?.includes('hypertension'),
    responses.chronic_conditions?.includes('diabetes'),
    responses.chronic_conditions?.includes('heart_disease'),
    responses.smoking_status === 'current',
    responses.bmi > 30,
    responses.exercise_frequency < 3,
    responses.family_conditions?.includes('heart_disease')
  ].filter(Boolean).length;

  score.categories.cardiovascular = cvRiskFactors * 15;

  // Overall risk calculation
  score.overall = Object.values(score.categories).reduce((sum, val) => sum + val, 0);

  return score;
}

// Fraud detection system
export interface FraudIndicators {
  inconsistencyScore: number;
  suspiciousPatterns: string[];
  validationFailures: string[];
  recommendation: 'accept' | 'review' | 'flag';
}

export function detectFraudIndicators(responses: Record<string, any>): FraudIndicators {
  const indicators: FraudIndicators = {
    inconsistencyScore: 0,
    suspiciousPatterns: [],
    validationFailures: [],
    recommendation: 'accept'
  };

  // Check validation pairs
  VALIDATION_PAIRS.forEach(question => {
    if (question.validationPair && responses[question.id] && responses[question.validationPair]) {
      const val1 = responses[question.id];
      const val2 = responses[question.validationPair];
      
      // Height consistency check
      if (question.id.includes('height') && Math.abs(val1 - val2) > 5) {
        indicators.validationFailures.push('height_mismatch');
        indicators.inconsistencyScore += 20;
      }
      
      // Smoking contradiction
      if (question.id === 'smoking_status' && val1 === 'never' && responses.smoking_validation === true) {
        indicators.validationFailures.push('smoking_contradiction');
        indicators.inconsistencyScore += 30;
      }
    }
  });

  // Pattern detection
  // All answers are extreme (all yes or all no)
  const booleanAnswers = Object.values(responses).filter(v => typeof v === 'boolean');
  if (booleanAnswers.length > 10) {
    const trueCount = booleanAnswers.filter(v => v === true).length;
    const ratio = trueCount / booleanAnswers.length;
    if (ratio === 0 || ratio === 1) {
      indicators.suspiciousPatterns.push('extreme_response_pattern');
      indicators.inconsistencyScore += 25;
    }
  }

  // Straight-line responding on scales
  const scaleAnswers = Object.keys(responses)
    .filter(key => key.includes('scale') || key.includes('phq') || key.includes('gad'))
    .map(key => responses[key]);
  
  if (scaleAnswers.length > 5 && new Set(scaleAnswers).size === 1) {
    indicators.suspiciousPatterns.push('straight_line_responding');
    indicators.inconsistencyScore += 20;
  }

  // Impossible combinations
  if (responses.age < 30 && responses.chronic_conditions?.length > 5) {
    indicators.suspiciousPatterns.push('unlikely_condition_count_for_age');
    indicators.inconsistencyScore += 15;
  }

  if (responses.surgeries && !responses.hospitalization_history) {
    indicators.validationFailures.push('surgery_without_hospitalization');
    indicators.inconsistencyScore += 25;
  }

  // Set recommendation based on score
  if (indicators.inconsistencyScore >= 50) {
    indicators.recommendation = 'flag';
  } else if (indicators.inconsistencyScore >= 25) {
    indicators.recommendation = 'review';
  }

  return indicators;
}

// Gamification elements
export interface HealthScoreGamification {
  healthScore: number; // 0-100
  badges: string[];
  streaks: {
    honesty: number; // Days of consistent responses
    completion: number; // Completed sections
  };
  level: 'bronze' | 'silver' | 'gold' | 'platinum';
  nextRewards: string[];
}

export function calculateHealthScore(responses: Record<string, any>, fraudIndicators: FraudIndicators): HealthScoreGamification {
  let baseScore = 100;
  const badges: string[] = [];
  
  // Deduct points for risks
  const riskScore = calculateRiskScore(responses);
  baseScore -= Math.min(riskScore.overall / 10, 50);
  
  // Bonus for honest disclosure
  if (fraudIndicators.recommendation === 'accept') {
    baseScore += 10;
    badges.push('honest_reporter');
  }
  
  // Bonus for completeness
  const completionRate = Object.keys(responses).length / 50; // Assuming ~50 total questions
  if (completionRate > 0.9) {
    badges.push('thorough_responder');
    baseScore += 5;
  }
  
  // Health achievements
  if (responses.exercise_frequency >= 5) badges.push('fitness_enthusiast');
  if (responses.sleep_hours >= 7 && responses.sleep_hours <= 9) badges.push('sleep_champion');
  if (!responses.smoking_status || responses.smoking_status === 'never') badges.push('smoke_free');
  
  // Determine level
  let level: 'bronze' | 'silver' | 'gold' | 'platinum' = 'bronze';
  if (baseScore >= 90) level = 'platinum';
  else if (baseScore >= 80) level = 'gold';
  else if (baseScore >= 70) level = 'silver';
  
  return {
    healthScore: Math.max(0, Math.min(100, baseScore)),
    badges,
    streaks: {
      honesty: fraudIndicators.recommendation === 'accept' ? 1 : 0,
      completion: Math.floor(completionRate * 10)
    },
    level,
    nextRewards: [
      'Complete mental health section for "Mental Wellness" badge',
      'Add emergency contact for "Prepared" badge'
    ]
  };
}