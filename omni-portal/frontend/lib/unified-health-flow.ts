// Unified Intelligent Health Assessment Flow
// Uses progressive disclosure and adaptive routing for ALL health questions

export interface HealthDomain {
  id: string;
  name: string;
  description: string;
  priority: number; // Higher priority domains are assessed first
  triggerConditions: DomainTrigger[];
  layers: HealthLayer[];
  estimatedMinutes: number;
}

export interface HealthLayer {
  id: string;
  name: string;
  description: string;
  questions: HealthQuestion[];
  completionTriggers: LayerTrigger[];
  nextDomainTriggers: DomainTrigger[];
  estimatedSeconds: number;
}

export interface HealthQuestion {
  id: string;
  text: string;
  type: 'scale' | 'select' | 'multiselect' | 'boolean' | 'text' | 'number';
  domain: string; // pain, mental_health, chronic_disease, lifestyle, family_history
  instrument?: string; // PHQ-9, GAD-7, etc.
  options?: QuestionOption[];
  conditionalOn?: ConditionalRule[];
  riskWeight: number;
  validationPair?: string;
  metadata?: QuestionMetadata;
}

export interface QuestionOption {
  value: any;
  label: string;
  emoji?: string;
  riskScore?: number;
}

export interface ConditionalRule {
  questionId: string;
  operator: '>=' | '>' | '=' | '<=' | '<' | 'includes' | 'excludes';
  value: any;
}

export interface DomainTrigger {
  condition: ConditionalRule;
  action: 'enter_domain' | 'skip_domain' | 'prioritize_domain';
  targetDomain: string;
}

export interface LayerTrigger {
  conditions: ConditionalRule[];
  operator: 'AND' | 'OR';
  action: 'complete_layer' | 'advance_layer' | 'branch_domain';
  target?: string;
}

export interface QuestionMetadata {
  clinicalCode?: string;
  validatedTool?: string;
  sensitiveInfo?: boolean;
  fraudDetection?: boolean;
}

// UNIVERSAL TRIAGE LAYER - Entry point for everyone
export const UNIVERSAL_TRIAGE: HealthLayer = {
  id: 'universal_triage',
  name: 'Avaliação Inicial',
  description: 'Vamos começar com algumas perguntas básicas para personalizar sua experiência',
  estimatedSeconds: 60,
  questions: [
    {
      id: 'age',
      text: 'Qual é sua idade?',
      type: 'number',
      domain: 'demographics',
      riskWeight: 1,
      metadata: { clinicalCode: 'Z00.00' }
    },
    {
      id: 'biological_sex',
      text: 'Qual é seu sexo biológico ao nascer? (Importante para cálculos de risco médico)',
      type: 'select',
      domain: 'demographics',
      riskWeight: 0,
      options: [
        { value: 'male', label: 'Masculino' },
        { value: 'female', label: 'Feminino' },
        { value: 'intersex', label: 'Intersexo' }
      ],
      metadata: { sensitiveInfo: true }
    },
    {
      id: 'emergency_check',
      text: 'Você tem alguma destas condições que precisam de atenção imediata?',
      type: 'multiselect',
      domain: 'emergency',
      riskWeight: 10,
      options: [
        { value: 'chest_pain', label: 'Dor no peito agora', riskScore: 10 },
        { value: 'breathing_difficulty', label: 'Dificuldade para respirar', riskScore: 10 },
        { value: 'severe_bleeding', label: 'Sangramento intenso', riskScore: 10 },
        { value: 'suicide_thoughts', label: 'Pensamentos de autolesão', riskScore: 10 },
        { value: 'pregnancy_complications', label: 'Complicações na gravidez', riskScore: 8 },
        { value: 'none', label: 'Nenhuma das acima', riskScore: 0 }
      ]
    },
    {
      id: 'pain_severity',
      text: 'Em uma escala de 0 a 10, qual é sua dor AGORA?',
      type: 'scale',
      domain: 'pain',
      instrument: 'NRS',
      riskWeight: 2,
      options: Array.from({ length: 11 }, (_, i) => ({
        value: i,
        label: i.toString(),
        emoji: i === 0 ? '😊' : i <= 3 ? '😐' : i <= 6 ? '😣' : i <= 9 ? '😫' : '😭'
      }))
    },
    {
      id: 'mood_interest',
      text: 'Nas últimas 2 semanas, você teve pouco interesse em fazer as coisas?',
      type: 'select',
      domain: 'mental_health',
      instrument: 'PHQ-2',
      riskWeight: 3,
      options: [
        { value: 0, label: 'Nunca', riskScore: 0 },
        { value: 1, label: 'Alguns dias', riskScore: 1 },
        { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
        { value: 3, label: 'Quase todos os dias', riskScore: 3 }
      ]
    },
    {
      id: 'chronic_conditions_flag',
      text: 'Você tem alguma condição crônica de saúde?',
      type: 'boolean',
      domain: 'chronic_disease',
      riskWeight: 4,
    }
  ],
  completionTriggers: [
    {
      conditions: [{ questionId: 'age', operator: '>', value: 0 }],
      operator: 'AND',
      action: 'complete_layer'
    }
  ],
  nextDomainTriggers: [
    {
      condition: { questionId: 'emergency_check', operator: 'excludes', value: 'none' },
      action: 'prioritize_domain',
      targetDomain: 'emergency_response'
    },
    {
      condition: { questionId: 'pain_severity', operator: '>=', value: 4 },
      action: 'enter_domain',
      targetDomain: 'pain_management'
    },
    {
      condition: { questionId: 'mood_interest', operator: '>=', value: 1 },
      action: 'enter_domain',
      targetDomain: 'mental_health'
    },
    {
      condition: { questionId: 'chronic_conditions_flag', operator: '=', value: true },
      action: 'enter_domain',
      targetDomain: 'chronic_disease'
    }
  ]
};

// PAIN MANAGEMENT DOMAIN
export const PAIN_DOMAIN: HealthDomain = {
  id: 'pain_management',
  name: 'Avaliação de Dor',
  description: 'Vamos entender melhor sua dor para ajudá-lo adequadamente',
  priority: 8,
  estimatedMinutes: 3,
  triggerConditions: [
    {
      condition: { questionId: 'pain_severity', operator: '>=', value: 4 },
      action: 'enter_domain',
      targetDomain: 'pain_management'
    }
  ],
  layers: [
    {
      id: 'pain_interference',
      name: 'Impacto da Dor',
      description: 'Como a dor afeta sua vida diária',
      estimatedSeconds: 120,
      questions: [
        {
          id: 'pain_duration',
          text: 'Há quanto tempo você tem essa dor?',
          type: 'select',
          domain: 'pain',
          riskWeight: 2,
          options: [
            { value: 'acute', label: 'Menos de 3 meses', riskScore: 1 },
            { value: 'subacute', label: '3-6 meses', riskScore: 2 },
            { value: 'chronic', label: 'Mais de 6 meses', riskScore: 3 }
          ]
        },
        {
          id: 'pain_work_interference',
          text: 'Como a dor interfere no seu trabalho? (0 = não interfere, 10 = interfere completamente)',
          type: 'scale',
          domain: 'pain',
          instrument: 'PEG',
          riskWeight: 2,
          options: Array.from({ length: 11 }, (_, i) => ({
            value: i,
            label: i.toString(),
            emoji: i === 0 ? '💼' : i <= 3 ? '😐' : i <= 6 ? '😔' : '😫'
          }))
        },
        {
          id: 'pain_sleep_interference',
          text: 'Como a dor afeta seu sono? (0 = não afeta, 10 = afeta muito)',
          type: 'scale',
          domain: 'pain',
          instrument: 'PEG',
          riskWeight: 2,
          options: Array.from({ length: 11 }, (_, i) => ({
            value: i,
            label: i.toString(),
            emoji: i === 0 ? '😴' : i <= 3 ? '😐' : i <= 6 ? '😔' : '😵'
          }))
        },
        {
          id: 'pain_medications',
          text: 'Você toma algum medicamento para dor?',
          type: 'multiselect',
          domain: 'pain',
          riskWeight: 1,
          options: [
            { value: 'none', label: 'Não tomo medicamentos' },
            { value: 'otc_analgesics', label: 'Analgésicos sem receita (paracetamol, ibuprofeno)' },
            { value: 'prescription_pain', label: 'Medicamentos prescritos para dor' },
            { value: 'opioids', label: 'Opioides (morfina, codeína, tramadol)', riskScore: 3 },
            { value: 'topical', label: 'Pomadas e géis' },
            { value: 'alternative', label: 'Medicamentos alternativos/fitoterápicos' }
          ]
        }
      ],
      completionTriggers: [
        {
          conditions: [
            { questionId: 'pain_work_interference', operator: '>', value: -1 },
            { questionId: 'pain_sleep_interference', operator: '>', value: -1 }
          ],
          operator: 'AND',
          action: 'complete_layer'
        }
      ],
      nextDomainTriggers: [
        {
          condition: { questionId: 'pain_medications', operator: 'includes', value: 'opioids' },
          action: 'enter_domain',
          targetDomain: 'substance_monitoring'
        }
      ]
    }
  ]
};

// MENTAL HEALTH DOMAIN
export const MENTAL_HEALTH_DOMAIN: HealthDomain = {
  id: 'mental_health',
  name: 'Bem-estar Mental',
  description: 'Avaliação cuidadosa do seu bem-estar emocional',
  priority: 9,
  estimatedMinutes: 4,
  triggerConditions: [
    {
      condition: { questionId: 'mood_interest', operator: '>=', value: 1 },
      action: 'enter_domain',
      targetDomain: 'mental_health'
    }
  ],
  layers: [
    {
      id: 'wellbeing_assessment',
      name: 'Avaliação de Bem-estar',
      description: 'Como você tem se sentido ultimamente',
      estimatedSeconds: 180,
      questions: [
        {
          id: 'who5_1',
          text: 'Nas últimas 2 semanas: Eu me senti alegre e de bom humor',
          type: 'select',
          domain: 'mental_health',
          instrument: 'WHO-5',
          riskWeight: 2,
          options: [
            { value: 0, label: 'Em nenhum momento', riskScore: 4 },
            { value: 1, label: 'Em alguns momentos', riskScore: 3 },
            { value: 2, label: 'Em menos da metade do tempo', riskScore: 2 },
            { value: 3, label: 'Em mais da metade do tempo', riskScore: 1 },
            { value: 4, label: 'Na maior parte do tempo', riskScore: 0 },
            { value: 5, label: 'O tempo todo', riskScore: 0 }
          ]
        },
        {
          id: 'who5_2',
          text: 'Nas últimas 2 semanas: Eu me senti calmo e relaxado',
          type: 'select',
          domain: 'mental_health',
          instrument: 'WHO-5',
          riskWeight: 2,
          options: [
            { value: 0, label: 'Em nenhum momento', riskScore: 4 },
            { value: 1, label: 'Em alguns momentos', riskScore: 3 },
            { value: 2, label: 'Em menos da metade do tempo', riskScore: 2 },
            { value: 3, label: 'Em mais da metade do tempo', riskScore: 1 },
            { value: 4, label: 'Na maior parte do tempo', riskScore: 0 },
            { value: 5, label: 'O tempo todo', riskScore: 0 }
          ]
        },
        {
          id: 'anxiety_nervousness',
          text: 'Nas últimas 2 semanas, você se sentiu nervoso, ansioso ou tenso?',
          type: 'select',
          domain: 'mental_health',
          instrument: 'GAD-2',
          riskWeight: 3,
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: 'Alguns dias', riskScore: 1 },
            { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
            { value: 3, label: 'Quase todos os dias', riskScore: 3 }
          ]
        },
        {
          id: 'sleep_quality',
          text: 'Como você classificaria a qualidade do seu sono?',
          type: 'select',
          domain: 'mental_health',
          riskWeight: 2,
          options: [
            { value: 'excellent', label: 'Excelente', riskScore: 0 },
            { value: 'good', label: 'Bom', riskScore: 0 },
            { value: 'fair', label: 'Regular', riskScore: 1 },
            { value: 'poor', label: 'Ruim', riskScore: 2 },
            { value: 'very_poor', label: 'Muito ruim', riskScore: 3 }
          ]
        }
      ],
      completionTriggers: [
        {
          conditions: [{ questionId: 'who5_2', operator: '>', value: -1 }],
          operator: 'AND',
          action: 'complete_layer'
        }
      ],
      nextDomainTriggers: [
        {
          condition: { questionId: 'anxiety_nervousness', operator: '>=', value: 2 },
          action: 'enter_domain',
          targetDomain: 'anxiety_assessment'
        }
      ]
    }
  ]
};

// CHRONIC DISEASE DOMAIN
export const CHRONIC_DISEASE_DOMAIN: HealthDomain = {
  id: 'chronic_disease',
  name: 'Condições Crônicas',
  description: 'Informações sobre sua saúde e histórico médico',
  priority: 7,
  estimatedMinutes: 5,
  triggerConditions: [
    {
      condition: { questionId: 'chronic_conditions_flag', operator: '=', value: true },
      action: 'enter_domain',
      targetDomain: 'chronic_disease'
    }
  ],
  layers: [
    {
      id: 'medical_history',
      name: 'Histórico Médico',
      description: 'Suas condições de saúde atuais e passadas',
      estimatedSeconds: 240,
      questions: [
        {
          id: 'chronic_conditions',
          text: 'Quais dessas condições você tem ou já teve?',
          type: 'multiselect',
          domain: 'chronic_disease',
          riskWeight: 5,
          options: [
            { value: 'diabetes', label: 'Diabetes', riskScore: 3 },
            { value: 'hypertension', label: 'Pressão alta (Hipertensão)', riskScore: 2 },
            { value: 'heart_disease', label: 'Doença cardíaca', riskScore: 4 },
            { value: 'asthma', label: 'Asma', riskScore: 2 },
            { value: 'copd', label: 'DPOC (Doença Pulmonar)', riskScore: 3 },
            { value: 'arthritis', label: 'Artrite/Artrose', riskScore: 1 },
            { value: 'cancer', label: 'Câncer', riskScore: 5 },
            { value: 'kidney_disease', label: 'Doença renal', riskScore: 4 },
            { value: 'liver_disease', label: 'Doença hepática', riskScore: 3 },
            { value: 'thyroid', label: 'Problemas de tireoide', riskScore: 1 },
            { value: 'none', label: 'Nenhuma das acima', riskScore: 0 }
          ]
        },
        {
          id: 'current_medications',
          text: 'Você toma medicamentos regularmente?',
          type: 'boolean',
          domain: 'chronic_disease',
          riskWeight: 1,
        },
        {
          id: 'medication_list',
          text: 'Quais medicamentos você toma? (Liste os principais)',
          type: 'text',
          domain: 'chronic_disease',
          riskWeight: 1,
          conditionalOn: [
            { questionId: 'current_medications', operator: '=', value: true }
          ],
          metadata: { fraudDetection: true }
        },
        {
          id: 'hospitalizations',
          text: 'Quantas vezes você foi hospitalizado nos últimos 2 anos?',
          type: 'select',
          domain: 'chronic_disease',
          riskWeight: 2,
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: '1 vez', riskScore: 1 },
            { value: 2, label: '2 vezes', riskScore: 2 },
            { value: 3, label: '3 ou mais vezes', riskScore: 3 }
          ],
          validationPair: 'surgery_history'
        }
      ],
      completionTriggers: [
        {
          conditions: [{ questionId: 'chronic_conditions', operator: '>', value: -1 }],
          operator: 'AND',
          action: 'complete_layer'
        }
      ],
      nextDomainTriggers: []
    }
  ]
};

// LIFESTYLE DOMAIN
export const LIFESTYLE_DOMAIN: HealthDomain = {
  id: 'lifestyle',
  name: 'Estilo de Vida',
  description: 'Seus hábitos e comportamentos de saúde',
  priority: 5,
  estimatedMinutes: 3,
  triggerConditions: [
    {
      condition: { questionId: 'age', operator: '>=', value: 18 },
      action: 'enter_domain',
      targetDomain: 'lifestyle'
    }
  ],
  layers: [
    {
      id: 'health_behaviors',
      name: 'Comportamentos de Saúde',
      description: 'Atividade física, alimentação e outros hábitos',
      estimatedSeconds: 180,
      questions: [
        {
          id: 'exercise_frequency',
          text: 'Quantos dias por semana você faz pelo menos 30 minutos de atividade física?',
          type: 'select',
          domain: 'lifestyle',
          riskWeight: 2,
          options: [
            { value: 0, label: 'Nenhum dia', riskScore: 3 },
            { value: 1, label: '1 dia', riskScore: 2 },
            { value: 2, label: '2 dias', riskScore: 2 },
            { value: 3, label: '3 dias', riskScore: 1 },
            { value: 4, label: '4 dias', riskScore: 1 },
            { value: 5, label: '5 dias', riskScore: 0 },
            { value: 6, label: '6 dias', riskScore: 0 },
            { value: 7, label: 'Todos os dias', riskScore: 0 }
          ]
        },
        {
          id: 'smoking_status',
          text: 'Qual é sua situação em relação ao cigarro?',
          type: 'select',
          domain: 'lifestyle',
          riskWeight: 4,
          options: [
            { value: 'never', label: 'Nunca fumei', riskScore: 0 },
            { value: 'former', label: 'Ex-fumante', riskScore: 1 },
            { value: 'current', label: 'Fumante atual', riskScore: 4 }
          ],
          validationPair: 'smoking_advice'
        },
        {
          id: 'smoking_advice',
          text: 'Algum médico já recomendou que você parasse de fumar?',
          type: 'boolean',
          domain: 'lifestyle',
          riskWeight: 1,
          conditionalOn: [
            { questionId: 'smoking_status', operator: '=', value: 'current' }
          ],
          validationPair: 'smoking_status',
          metadata: { fraudDetection: true }
        },
        {
          id: 'alcohol_consumption',
          text: 'Com que frequência você consome bebidas alcoólicas?',
          type: 'select',
          domain: 'lifestyle',
          riskWeight: 2,
          options: [
            { value: 'never', label: 'Nunca', riskScore: 0 },
            { value: 'monthly', label: 'Mensalmente ou menos', riskScore: 0 },
            { value: 'weekly', label: '2-4 vezes por mês', riskScore: 1 },
            { value: 'frequent', label: '2-3 vezes por semana', riskScore: 2 },
            { value: 'daily', label: '4 ou mais vezes por semana', riskScore: 3 }
          ]
        }
      ],
      completionTriggers: [
        {
          conditions: [{ questionId: 'exercise_frequency', operator: '>', value: -1 }],
          operator: 'AND',
          action: 'complete_layer'
        }
      ],
      nextDomainTriggers: [
        {
          condition: { questionId: 'smoking_status', operator: '=', value: 'current' },
          action: 'enter_domain',
          targetDomain: 'substance_monitoring'
        }
      ]
    }
  ]
};

// FAMILY HISTORY DOMAIN
export const FAMILY_HISTORY_DOMAIN: HealthDomain = {
  id: 'family_history',
  name: 'Histórico Familiar',
  description: 'Informações sobre a saúde da sua família',
  priority: 4,
  estimatedMinutes: 2,
  triggerConditions: [
    {
      condition: { questionId: 'age', operator: '>=', value: 25 },
      action: 'enter_domain',
      targetDomain: 'family_history'
    }
  ],
  layers: [
    {
      id: 'family_conditions',
      name: 'Condições Familiares',
      description: 'Doenças em parentes próximos',
      estimatedSeconds: 120,
      questions: [
        {
          id: 'family_heart_disease',
          text: 'Algum parente próximo (pais, irmãos) tem ou teve doença cardíaca?',
          type: 'boolean',
          domain: 'family_history',
          riskWeight: 2,
        },
        {
          id: 'family_diabetes',
          text: 'Algum parente próximo tem ou teve diabetes?',
          type: 'boolean',
          domain: 'family_history',
          riskWeight: 2,
        },
        {
          id: 'family_cancer',
          text: 'Algum parente próximo teve câncer?',
          type: 'multiselect',
          domain: 'family_history',
          riskWeight: 3,
          options: [
            { value: 'none', label: 'Nenhum', riskScore: 0 },
            { value: 'breast', label: 'Câncer de mama', riskScore: 2 },
            { value: 'colon', label: 'Câncer de cólon', riskScore: 2 },
            { value: 'lung', label: 'Câncer de pulmão', riskScore: 2 },
            { value: 'prostate', label: 'Câncer de próstata', riskScore: 1 },
            { value: 'other', label: 'Outros tipos', riskScore: 1 }
          ]
        }
      ],
      completionTriggers: [
        {
          conditions: [{ questionId: 'family_heart_disease', operator: '>', value: -1 }],
          operator: 'AND',
          action: 'complete_layer'
        }
      ],
      nextDomainTriggers: []
    }
  ]
};

// VALIDATION DOMAIN (Final step)
export const VALIDATION_DOMAIN: HealthDomain = {
  id: 'validation',
  name: 'Validação',
  description: 'Confirmação de algumas informações importantes',
  priority: 1,
  estimatedMinutes: 2,
  triggerConditions: [
    {
      condition: { questionId: 'age', operator: '>', value: 0 },
      action: 'enter_domain',
      targetDomain: 'validation'
    }
  ],
  layers: [
    {
      id: 'data_validation',
      name: 'Confirmação de Dados',
      description: 'Vamos confirmar algumas informações importantes',
      estimatedSeconds: 120,
      questions: [
        {
          id: 'height_confirmation',
          text: 'Por favor, confirme sua altura em centímetros (será usada para cálculos médicos)',
          type: 'number',
          domain: 'validation',
          riskWeight: 0,
          metadata: { fraudDetection: true }
        },
        {
          id: 'weight_confirmation',
          text: 'Por favor, confirme seu peso em quilogramas',
          type: 'number',
          domain: 'validation',
          riskWeight: 0,
          metadata: { fraudDetection: true }
        },
        {
          id: 'emergency_contact',
          text: 'Em caso de emergência, quem devemos contactar? (Nome e telefone)',
          type: 'text',
          domain: 'validation',
          riskWeight: 0,
        }
      ],
      completionTriggers: [
        {
          conditions: [{ questionId: 'height_confirmation', operator: '>', value: 0 }],
          operator: 'AND',
          action: 'complete_layer'
        }
      ],
      nextDomainTriggers: []
    }
  ]
};

// UNIFIED FLOW MANAGER
export class UnifiedHealthFlow {
  private currentDomain: HealthDomain | null = null;
  private currentLayer: HealthLayer | null = null;
  private responses: Record<string, any> = {};
  private completedDomains: Set<string> = new Set();
  private triggeredDomains: HealthDomain[] = [];
  private riskScores: Record<string, number> = {};
  private isTriageComplete = false;

  constructor() {
    // Start with universal triage
    this.currentLayer = UNIVERSAL_TRIAGE;
  }

  async processResponse(questionId: string, value: any): Promise<FlowResult> {
    this.responses[questionId] = value;
    
    // Calculate risk scores for this response
    this.updateRiskScores(questionId, value);
    
    // Check if we need to trigger any domains
    if (!this.isTriageComplete) {
      this.evaluateDomainTriggers();
    }
    
    // Get next question or advance flow
    const nextQuestion = this.getNextQuestion();
    
    if (!nextQuestion) {
      return this.advanceFlow();
    }
    
    return {
      type: 'question',
      question: nextQuestion,
      progress: this.calculateProgress(),
      currentDomain: this.currentDomain?.name || 'Avaliação Inicial',
      currentLayer: this.currentLayer?.name || '',
      estimatedTimeRemaining: this.calculateTimeRemaining()
    };
  }

  private updateRiskScores(questionId: string, value: any): void {
    const question = this.findQuestion(questionId);
    if (!question) return;

    const domain = question.domain;
    if (!this.riskScores[domain]) {
      this.riskScores[domain] = 0;
    }

    // Add base risk weight
    this.riskScores[domain] += question.riskWeight;

    // Add option-specific risk score
    if (question.options && typeof value !== 'boolean') {
      const option = question.options.find(opt => opt.value === value);
      if (option && option.riskScore) {
        this.riskScores[domain] += option.riskScore;
      }
    }
  }

  private evaluateDomainTriggers(): void {
    const allDomains = [
      PAIN_DOMAIN,
      MENTAL_HEALTH_DOMAIN,
      CHRONIC_DISEASE_DOMAIN,
      LIFESTYLE_DOMAIN,
      FAMILY_HISTORY_DOMAIN,
      VALIDATION_DOMAIN
    ];

    for (const domain of allDomains) {
      if (this.completedDomains.has(domain.id)) continue;
      
      for (const trigger of domain.triggerConditions) {
        if (this.evaluateCondition(trigger.condition)) {
          if (trigger.action === 'enter_domain' || trigger.action === 'prioritize_domain') {
            this.triggeredDomains.push(domain);
          }
        }
      }
    }

    // Sort by priority (higher first)
    this.triggeredDomains.sort((a, b) => b.priority - a.priority);
  }

  private evaluateCondition(condition: ConditionalRule): boolean {
    const value = this.responses[condition.questionId];
    if (value === undefined) return false;

    switch (condition.operator) {
      case '>=': return value >= condition.value;
      case '>': return value > condition.value;
      case '=': return value === condition.value;
      case '<=': return value <= condition.value;
      case '<': return value < condition.value;
      case 'includes': return Array.isArray(value) && value.includes(condition.value);
      case 'excludes': return Array.isArray(value) && !value.includes(condition.value);
      default: return false;
    }
  }

  private getNextQuestion(): HealthQuestion | null {
    if (!this.currentLayer) return null;

    const answeredIds = Object.keys(this.responses);
    
    return this.currentLayer.questions.find(q => {
      // Skip if already answered
      if (answeredIds.includes(q.id)) return false;
      
      // Check conditional requirements
      if (q.conditionalOn && q.conditionalOn.length > 0) {
        return q.conditionalOn.every(condition => this.evaluateCondition(condition));
      }
      
      return true;
    }) || null;
  }

  private advanceFlow(): FlowResult {
    if (!this.isTriageComplete) {
      // Complete triage, move to domain assessment
      this.isTriageComplete = true;
      return this.startNextDomain();
    }

    if (this.currentDomain) {
      // Complete current domain
      this.completedDomains.add(this.currentDomain.id);
      return this.startNextDomain();
    }

    // All domains complete
    return {
      type: 'complete',
      results: this.generateResults(),
      progress: 100,
      currentDomain: 'Completo',
      currentLayer: 'Finalizado',
      estimatedTimeRemaining: 0
    };
  }

  private startNextDomain(): FlowResult {
    // Get next prioritized domain
    const nextDomain = this.triggeredDomains.find(d => !this.completedDomains.has(d.id));
    
    if (!nextDomain) {
      // All triggered domains complete, always end with validation
      if (!this.completedDomains.has('validation')) {
        this.currentDomain = VALIDATION_DOMAIN;
        this.currentLayer = VALIDATION_DOMAIN.layers[0];
        return this.processNextQuestion();
      }
      
      // Everything complete
      return this.advanceFlow();
    }

    this.currentDomain = nextDomain;
    this.currentLayer = nextDomain.layers[0];
    
    return {
      type: 'domain_transition',
      domain: nextDomain,
      message: `Agora vamos falar sobre ${nextDomain.name.toLowerCase()}. ${nextDomain.description}`,
      progress: this.calculateProgress(),
      currentDomain: nextDomain.name,
      currentLayer: this.currentLayer.name,
      estimatedTimeRemaining: this.calculateTimeRemaining()
    };
  }

  private processNextQuestion(): FlowResult {
    const nextQuestion = this.getNextQuestion();
    
    if (nextQuestion) {
      return {
        type: 'question',
        question: nextQuestion,
        progress: this.calculateProgress(),
        currentDomain: this.currentDomain?.name || '',
        currentLayer: this.currentLayer?.name || '',
        estimatedTimeRemaining: this.calculateTimeRemaining()
      };
    }
    
    return this.advanceFlow();
  }

  private calculateProgress(): number {
    const totalDomains = this.triggeredDomains.length + 1; // +1 for triage
    const completedCount = this.completedDomains.size + (this.isTriageComplete ? 1 : 0);
    return Math.round((completedCount / totalDomains) * 100);
  }

  private calculateTimeRemaining(): number {
    const remainingDomains = this.triggeredDomains.filter(d => !this.completedDomains.has(d.id));
    return remainingDomains.reduce((total, domain) => total + domain.estimatedMinutes, 0);
  }

  private findQuestion(questionId: string): HealthQuestion | null {
    // Check current layer first
    if (this.currentLayer) {
      const question = this.currentLayer.questions.find(q => q.id === questionId);
      if (question) return question;
    }

    // Search all domains
    const allDomains = [PAIN_DOMAIN, MENTAL_HEALTH_DOMAIN, CHRONIC_DISEASE_DOMAIN, LIFESTYLE_DOMAIN, FAMILY_HISTORY_DOMAIN, VALIDATION_DOMAIN];
    for (const domain of allDomains) {
      for (const layer of domain.layers) {
        const question = layer.questions.find(q => q.id === questionId);
        if (question) return question;
      }
    }

    return null;
  }

  private generateResults(): HealthAssessmentResults {
    return {
      responses: this.responses,
      riskScores: this.riskScores,
      completedDomains: Array.from(this.completedDomains),
      totalRiskScore: Object.values(this.riskScores).reduce((sum, score) => sum + score, 0),
      riskLevel: this.calculateOverallRiskLevel(),
      recommendations: this.generateRecommendations(),
      nextSteps: this.generateNextSteps(),
      fraudDetectionScore: this.calculateFraudScore(),
      timestamp: new Date().toISOString()
    };
  }

  private calculateOverallRiskLevel(): 'low' | 'moderate' | 'high' | 'critical' {
    const totalRisk = Object.values(this.riskScores).reduce((sum, score) => sum + score, 0);
    
    // Check for critical indicators
    if (this.responses.emergency_check && !this.responses.emergency_check.includes('none')) {
      return 'critical';
    }
    
    if (totalRisk >= 25) return 'high';
    if (totalRisk >= 15) return 'moderate';
    return 'low';
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.riskScores.pain >= 5) {
      recommendations.push('Considere consultar um especialista em manejo da dor');
    }
    
    if (this.riskScores.mental_health >= 5) {
      recommendations.push('Recomendamos conversar com um profissional de saúde mental');
    }
    
    if (this.riskScores.lifestyle >= 8) {
      recommendations.push('Mudanças no estilo de vida podem melhorar significativamente sua saúde');
    }
    
    return recommendations;
  }

  private generateNextSteps(): string[] {
    const steps: string[] = [];
    const riskLevel = this.calculateOverallRiskLevel();
    
    switch (riskLevel) {
      case 'critical':
        steps.push('Contato imediato com equipe médica');
        steps.push('Recursos de emergência disponibilizados');
        break;
      case 'high':
        steps.push('Agendamento prioritário com profissional de saúde');
        steps.push('Acompanhamento em 48 horas');
        break;
      case 'moderate':
        steps.push('Recomendações personalizadas de saúde');
        steps.push('Acompanhamento em 1 semana');
        break;
      default:
        steps.push('Manutenção dos bons hábitos de saúde');
        steps.push('Próxima avaliação em 6 meses');
    }
    
    return steps;
  }

  private calculateFraudScore(): number {
    // Implement fraud detection logic based on response patterns
    let fraudScore = 0;
    
    // Check for impossible combinations
    if (this.responses.age < 25 && this.responses.chronic_conditions?.length > 4) {
      fraudScore += 20;
    }
    
    // Check validation pairs
    if (this.responses.smoking_status === 'never' && this.responses.smoking_advice === true) {
      fraudScore += 30;
    }
    
    return fraudScore;
  }

  public getCurrentDomain(): string {
    return this.currentDomain?.name || 'Avaliação Inicial';
  }

  public getCurrentLayer(): string {
    return this.currentLayer?.name || '';
  }

  public getResponses(): Record<string, any> {
    return { ...this.responses };
  }
}

export interface FlowResult {
  type: 'question' | 'domain_transition' | 'complete';
  question?: HealthQuestion;
  domain?: HealthDomain;
  message?: string;
  results?: HealthAssessmentResults;
  progress: number;
  currentDomain: string;
  currentLayer: string;
  estimatedTimeRemaining: number;
}

export interface HealthAssessmentResults {
  responses: Record<string, any>;
  riskScores: Record<string, number>;
  completedDomains: string[];
  totalRiskScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  recommendations: string[];
  nextSteps: string[];
  fraudDetectionScore: number;
  timestamp: string;
}