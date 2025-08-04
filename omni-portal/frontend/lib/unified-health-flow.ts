// Unified Intelligent Health Assessment Flow
// Uses progressive disclosure and adaptive routing for ALL health questions
//
// NOTE: This file handles flow orchestration, domain triggers, and UI state management.
// For complete clinical questionnaires (PHQ-9, GAD-7, AUDIT-C, NIDA, etc.) and 
// updated gamification logic, see health-questionnaire-v2.ts
//
// ARCHITECTURE:
// - This file: Flow logic, domain triggers, state management, interfaces
// - health-questionnaire-v2.ts: Clinical questions, scoring, gamification
// - Components use both files for complete functionality

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
        // PHQ-9 Questions 1 and 2 (also PHQ-2)
        {
          id: 'phq9_1_interest',
          text: 'Nas últimas 2 semanas: Pouco interesse ou prazer em fazer as coisas?',
          type: 'select',
          domain: 'mental_health',
          instrument: 'PHQ-9',
          riskWeight: 3,
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: 'Alguns dias', riskScore: 1 },
            { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
            { value: 3, label: 'Quase todos os dias', riskScore: 3 }
          ],
          metadata: { clinicalCode: 'F32.9' }
        },
        {
          id: 'phq9_2_depressed',
          text: 'Nas últimas 2 semanas: Sentir-se deprimido, triste ou sem esperança?',
          type: 'select',
          domain: 'mental_health',
          instrument: 'PHQ-9',
          riskWeight: 3,
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: 'Alguns dias', riskScore: 1 },
            { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
            { value: 3, label: 'Quase todos os dias', riskScore: 3 }
          ],
          metadata: { clinicalCode: 'F32.9' }
        },
        // WHO-5 Wellbeing Index
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
          id: 'gad7_1_nervousness',
          text: 'Nas últimas 2 semanas: Sentir-se nervoso, ansioso ou tenso?',
          type: 'select',
          domain: 'mental_health',
          instrument: 'GAD-7',
          riskWeight: 3,
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: 'Alguns dias', riskScore: 1 },
            { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
            { value: 3, label: 'Quase todos os dias', riskScore: 3 }
          ],
          metadata: { clinicalCode: 'F41.1' }
        },
        {
          id: 'gad7_2_worry_control',
          text: 'Nas últimas 2 semanas: Não conseguir parar ou controlar as preocupações?',
          type: 'select',
          domain: 'mental_health',
          instrument: 'GAD-7',
          riskWeight: 3,
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: 'Alguns dias', riskScore: 1 },
            { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
            { value: 3, label: 'Quase todos os dias', riskScore: 3 }
          ],
          metadata: { clinicalCode: 'F41.1' }
        },
        {
          id: 'gad7_3_excessive_worry',
          text: 'Nas últimas 2 semanas: Preocupar-se demais com coisas diferentes?',
          type: 'select',
          domain: 'mental_health',
          instrument: 'GAD-7',
          riskWeight: 3,
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: 'Alguns dias', riskScore: 1 },
            { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
            { value: 3, label: 'Quase todos os dias', riskScore: 3 }
          ],
          metadata: { clinicalCode: 'F41.1' }
        },
        {
          id: 'gad7_4_trouble_relaxing',
          text: 'Nas últimas 2 semanas: Dificuldade para relaxar?',
          type: 'select',
          domain: 'mental_health',
          instrument: 'GAD-7',
          riskWeight: 2,
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: 'Alguns dias', riskScore: 1 },
            { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
            { value: 3, label: 'Quase todos os dias', riskScore: 3 }
          ],
          metadata: { clinicalCode: 'F41.1' }
        },
        {
          id: 'gad7_5_restlessness',
          text: 'Nas últimas 2 semanas: Ficar tão inquieto que é difícil permanecer parado?',
          type: 'select',
          domain: 'mental_health',
          instrument: 'GAD-7',
          riskWeight: 3,
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: 'Alguns dias', riskScore: 1 },
            { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
            { value: 3, label: 'Quase todos os dias', riskScore: 3 }
          ],
          metadata: { clinicalCode: 'R45.1' }
        },
        {
          id: 'gad7_6_irritability',
          text: 'Nas últimas 2 semanas: Ficar facilmente irritado ou chateado?',
          type: 'select',
          domain: 'mental_health',
          instrument: 'GAD-7',
          riskWeight: 2,
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: 'Alguns dias', riskScore: 1 },
            { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
            { value: 3, label: 'Quase todos os dias', riskScore: 3 }
          ],
          metadata: { clinicalCode: 'R45.4' }
        },
        {
          id: 'gad7_7_fear_awful',
          text: 'Nas últimas 2 semanas: Sentir medo como se algo terrível fosse acontecer?',
          type: 'select',
          domain: 'mental_health',
          instrument: 'GAD-7',
          riskWeight: 4,
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: 'Alguns dias', riskScore: 1 },
            { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
            { value: 3, label: 'Quase todos os dias', riskScore: 3 }
          ],
          metadata: { clinicalCode: 'F41.9' }
        },
        {
          id: 'phq9_3_sleep',
          text: 'Nas últimas 2 semanas: Dificuldade para adormecer, continuar dormindo ou dormir demais?',
          type: 'select',
          domain: 'mental_health',
          instrument: 'PHQ-9',
          riskWeight: 3,
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: 'Alguns dias', riskScore: 1 },
            { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
            { value: 3, label: 'Quase todos os dias', riskScore: 3 }
          ],
          metadata: { clinicalCode: 'G47.00' }
        },
        {
          id: 'phq9_4_fatigue',
          text: 'Nas últimas 2 semanas: Sentir-se cansado ou com pouca energia?',
          type: 'select',
          domain: 'mental_health',
          instrument: 'PHQ-9',
          riskWeight: 3,
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: 'Alguns dias', riskScore: 1 },
            { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
            { value: 3, label: 'Quase todos os dias', riskScore: 3 }
          ],
          metadata: { clinicalCode: 'R53.83' }
        },
        {
          id: 'phq9_5_appetite',
          text: 'Nas últimas 2 semanas: Falta de apetite ou comer demais?',
          type: 'select',
          domain: 'mental_health',
          instrument: 'PHQ-9',
          riskWeight: 2,
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: 'Alguns dias', riskScore: 1 },
            { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
            { value: 3, label: 'Quase todos os dias', riskScore: 3 }
          ],
          metadata: { clinicalCode: 'R63.0' }
        },
        {
          id: 'phq9_6_self_worth',
          text: 'Nas últimas 2 semanas: Sentir-se mal consigo mesmo ou que é um fracasso?',
          type: 'select',
          domain: 'mental_health',
          instrument: 'PHQ-9',
          riskWeight: 4,
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: 'Alguns dias', riskScore: 1 },
            { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
            { value: 3, label: 'Quase todos os dias', riskScore: 3 }
          ],
          metadata: { clinicalCode: 'F32.9' }
        },
        {
          id: 'phq9_7_concentration',
          text: 'Nas últimas 2 semanas: Dificuldade para se concentrar (ler, assistir TV)?',
          type: 'select',
          domain: 'mental_health',
          instrument: 'PHQ-9',
          riskWeight: 3,
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: 'Alguns dias', riskScore: 1 },
            { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
            { value: 3, label: 'Quase todos os dias', riskScore: 3 }
          ],
          metadata: { clinicalCode: 'R41.840' }
        },
        {
          id: 'phq9_8_psychomotor',
          text: 'Nas últimas 2 semanas: Mover-se ou falar tão devagar que outros notaram? Ou o oposto - ficar agitado?',
          type: 'select',
          domain: 'mental_health',
          instrument: 'PHQ-9',
          riskWeight: 3,
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: 'Alguns dias', riskScore: 1 },
            { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
            { value: 3, label: 'Quase todos os dias', riskScore: 3 }
          ],
          metadata: { clinicalCode: 'F32.9' }
        },
        {
          id: 'phq9_9_suicidal_ideation',
          text: 'Nas últimas 2 semanas, teve pensamentos de que seria melhor estar morto ou de se machucar?',
          type: 'select',
          domain: 'mental_health',
          instrument: 'PHQ-9',
          riskWeight: 5,
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: 'Alguns dias', riskScore: 2 },
            { value: 2, label: 'Mais da metade dos dias', riskScore: 4 },
            { value: 3, label: 'Quase todos os dias', riskScore: 5 }
          ],
          metadata: { sensitiveInfo: true, clinicalCode: 'R45.851' }
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
        },
        // PHQ-9 Functional Impact Question
        {
          id: 'phq9_functional_impact',
          text: 'Se você marcou qualquer problema acima, o quanto esses problemas atrapalharam você a trabalhar, cuidar de casa ou se relacionar com outras pessoas?',
          type: 'select',
          domain: 'mental_health',
          instrument: 'PHQ-9',
          riskWeight: 2,
          options: [
            { value: 'not_difficult', label: 'Não atrapalhou', riskScore: 0 },
            { value: 'somewhat_difficult', label: 'Atrapalhou um pouco', riskScore: 1 },
            { value: 'very_difficult', label: 'Atrapalhou muito', riskScore: 2 },
            { value: 'extremely_difficult', label: 'Atrapalhou extremamente', riskScore: 3 }
          ],
          conditionalOn: [
            { questionId: 'phq9_1_interest', operator: '>', value: 0 },
            { questionId: 'phq9_2_depressed', operator: '>', value: 0 },
            { questionId: 'phq9_3_sleep', operator: '>', value: 0 },
            { questionId: 'phq9_4_fatigue', operator: '>', value: 0 },
            { questionId: 'phq9_5_appetite', operator: '>', value: 0 },
            { questionId: 'phq9_6_self_worth', operator: '>', value: 0 },
            { questionId: 'phq9_7_concentration', operator: '>', value: 0 },
            { questionId: 'phq9_8_psychomotor', operator: '>', value: 0 },
            { questionId: 'phq9_9_suicidal_ideation', operator: '>', value: 0 }
          ],
          metadata: { clinicalCode: 'Z73.6' }
        },
        // GAD-7 Functional Impact Question
        {
          id: 'gad7_functional_impact',
          text: 'Se você marcou problemas de ansiedade acima, o quanto esses problemas dificultaram suas atividades diárias?',
          type: 'select',
          domain: 'mental_health',
          instrument: 'GAD-7',
          riskWeight: 2,
          options: [
            { value: 'not_difficult', label: 'Não dificultou', riskScore: 0 },
            { value: 'somewhat_difficult', label: 'Dificultou um pouco', riskScore: 1 },
            { value: 'very_difficult', label: 'Dificultou muito', riskScore: 2 },
            { value: 'extremely_difficult', label: 'Dificultou extremamente', riskScore: 3 }
          ],
          conditionalOn: [
            { questionId: 'gad7_1_nervousness', operator: '>', value: 0 },
            { questionId: 'gad7_2_worry_control', operator: '>', value: 0 },
            { questionId: 'gad7_3_excessive_worry', operator: '>', value: 0 },
            { questionId: 'gad7_4_trouble_relaxing', operator: '>', value: 0 },
            { questionId: 'gad7_5_restlessness', operator: '>', value: 0 },
            { questionId: 'gad7_6_irritability', operator: '>', value: 0 },
            { questionId: 'gad7_7_fear_awful', operator: '>', value: 0 }
          ],
          metadata: { clinicalCode: 'Z73.6' }
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
          condition: { questionId: 'gad7_1_nervousness', operator: '>=', value: 2 },
          action: 'enter_domain',
          targetDomain: 'risk_behaviors'
        },
        {
          condition: { questionId: 'gad7_7_fear_awful', operator: '>=', value: 2 },
          action: 'prioritize_domain',
          targetDomain: 'risk_behaviors'
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
        // Comprehensive Allergy Screening
        {
          id: 'has_allergies',
          text: 'Você tem alguma alergia conhecida?',
          type: 'boolean',
          domain: 'chronic_disease',
          riskWeight: 2,
          metadata: { clinicalCode: 'Z88' }
        },
        {
          id: 'medication_allergies',
          text: 'Selecione todas as alergias a medicamentos que você tem:',
          type: 'multiselect',
          domain: 'chronic_disease',
          riskWeight: 3,
          conditionalOn: [
            { questionId: 'has_allergies', operator: '=', value: true }
          ],
          options: [
            { value: 'penicillin', label: 'Penicilina', riskScore: 3 },
            { value: 'aspirin', label: 'Aspirina', riskScore: 2 },
            { value: 'ibuprofen', label: 'Ibuprofeno', riskScore: 2 },
            { value: 'sulfa', label: 'Sulfa', riskScore: 3 },
            { value: 'contrast_dye', label: 'Contraste radiológico', riskScore: 3 },
            { value: 'anesthesia', label: 'Anestesia', riskScore: 4 },
            { value: 'codeine', label: 'Codeína', riskScore: 2 },
            { value: 'antibiotics_other', label: 'Outros antibióticos', riskScore: 2 },
            { value: 'none', label: 'Nenhuma alergia a medicamentos', riskScore: 0 },
            { value: 'other', label: 'Outra (especificar)', riskScore: 2 }
          ],
          metadata: { clinicalCode: 'Z88.0' }
        },
        {
          id: 'medication_allergy_reactions',
          text: 'Que tipo de reação você teve aos medicamentos?',
          type: 'multiselect',
          domain: 'chronic_disease',
          riskWeight: 3,
          conditionalOn: [
            { questionId: 'medication_allergies', operator: 'excludes', value: 'none' }
          ],
          options: [
            { value: 'rash', label: 'Erupção cutânea/Urticária', riskScore: 2 },
            { value: 'breathing_difficulty', label: 'Dificuldade para respirar', riskScore: 4 },
            { value: 'swelling', label: 'Inchaço (face, lábios, língua)', riskScore: 4 },
            { value: 'nausea', label: 'Náusea/Vômito', riskScore: 1 },
            { value: 'diarrhea', label: 'Diarreia', riskScore: 1 },
            { value: 'anaphylaxis', label: 'Anafilaxia (reação grave)', riskScore: 5 },
            { value: 'other', label: 'Outra reação', riskScore: 1 }
          ],
          metadata: { clinicalCode: 'T88.6' }
        },
        {
          id: 'food_allergies',
          text: 'Você tem alergias alimentares?',
          type: 'multiselect',
          domain: 'chronic_disease',
          riskWeight: 2,
          conditionalOn: [
            { questionId: 'has_allergies', operator: '=', value: true }
          ],
          options: [
            { value: 'peanuts', label: 'Amendoim', riskScore: 3 },
            { value: 'tree_nuts', label: 'Castanhas/Nozes', riskScore: 3 },
            { value: 'shellfish', label: 'Frutos do mar/Crustáceos', riskScore: 3 },
            { value: 'fish', label: 'Peixes', riskScore: 2 },
            { value: 'eggs', label: 'Ovos', riskScore: 2 },
            { value: 'milk', label: 'Leite/Laticínios', riskScore: 2 },
            { value: 'soy', label: 'Soja', riskScore: 1 },
            { value: 'wheat', label: 'Trigo/Glúten', riskScore: 2 },
            { value: 'none', label: 'Nenhuma alergia alimentar', riskScore: 0 },
            { value: 'other', label: 'Outra (especificar)', riskScore: 1 }
          ],
          metadata: { clinicalCode: 'Z91.010' }
        },
        {
          id: 'environmental_allergies',
          text: 'Você tem alergias ambientais?',
          type: 'multiselect',
          domain: 'chronic_disease',
          riskWeight: 1,
          conditionalOn: [
            { questionId: 'has_allergies', operator: '=', value: true }
          ],
          options: [
            { value: 'pollen', label: 'Pólen', riskScore: 1 },
            { value: 'dust_mites', label: 'Ácaros', riskScore: 1 },
            { value: 'pet_dander', label: 'Pelos de animais', riskScore: 1 },
            { value: 'mold', label: 'Mofo/Fungos', riskScore: 1 },
            { value: 'latex', label: 'Látex', riskScore: 2 },
            { value: 'insects', label: 'Picadas de insetos', riskScore: 2 },
            { value: 'perfumes', label: 'Perfumes/Químicos', riskScore: 1 },
            { value: 'none', label: 'Nenhuma alergia ambiental', riskScore: 0 },
            { value: 'other', label: 'Outra (especificar)', riskScore: 1 }
          ],
          metadata: { clinicalCode: 'J30.9' }
        },
        {
          id: 'allergy_severity',
          text: 'Em geral, como você classificaria a gravidade das suas alergias?',
          type: 'select',
          domain: 'chronic_disease',
          riskWeight: 3,
          conditionalOn: [
            { questionId: 'has_allergies', operator: '=', value: true }
          ],
          options: [
            { value: 'mild', label: 'Leve (sintomas menores, controláveis)', riskScore: 1 },
            { value: 'moderate', label: 'Moderada (requer medicação regularmente)', riskScore: 2 },
            { value: 'severe', label: 'Grave (interfere nas atividades diárias)', riskScore: 3 },
            { value: 'life_threatening', label: 'Risco de vida (anafilaxia/emergência)', riskScore: 5 }
          ],
          metadata: { clinicalCode: 'T78.4' }
        },
        {
          id: 'carries_epinephrine',
          text: 'Você carrega um auto-injetor de epinefrina (EpiPen)?',
          type: 'boolean',
          domain: 'chronic_disease',
          riskWeight: 4,
          conditionalOn: [
            { questionId: 'allergy_severity', operator: '=', value: 'severe' },
            { questionId: 'allergy_severity', operator: '=', value: 'life_threatening' }
          ],
          metadata: { clinicalCode: 'Z88.1' }
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

// RISK BEHAVIORS DOMAIN (Stage 7)
export const RISK_BEHAVIORS_DOMAIN: HealthDomain = {
  id: 'risk_behaviors',
  name: 'Comportamentos de Risco',
  description: 'Avaliação de comportamentos que podem afetar sua saúde',
  priority: 6,
  estimatedMinutes: 4,
  triggerConditions: [
    {
      condition: { questionId: 'age', operator: '>=', value: 16 },
      action: 'enter_domain',
      targetDomain: 'risk_behaviors'
    }
  ],
  layers: [
    {
      id: 'substance_risk_assessment',
      name: 'Avaliação de Substâncias',
      description: 'Uso de substâncias e comportamentos de risco',
      estimatedSeconds: 240,
      questions: [
        // AUDIT-C (Alcohol Use Disorders Identification Test - Consumption)
        {
          id: 'audit_c_1_frequency',
          text: 'Com que frequência você toma bebidas alcoólicas?',
          type: 'select',
          domain: 'risk_behaviors',
          instrument: 'AUDIT-C',
          riskWeight: 3,
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: 'Mensalmente ou menos', riskScore: 1 },
            { value: 2, label: '2-4 vezes por mês', riskScore: 1 },
            { value: 3, label: '2-3 vezes por semana', riskScore: 2 },
            { value: 4, label: '4 ou mais vezes por semana', riskScore: 3 }
          ],
          metadata: { clinicalCode: 'F10.10' }
        },
        {
          id: 'audit_c_2_amount',
          text: 'Quantas doses de álcool você toma em um dia típico quando está bebendo?',
          type: 'select',
          domain: 'risk_behaviors',
          instrument: 'AUDIT-C',
          riskWeight: 3,
          conditionalOn: [
            { questionId: 'audit_c_1_frequency', operator: '>', value: 0 }
          ],
          options: [
            { value: 0, label: '1 ou 2', riskScore: 0 },
            { value: 1, label: '3 ou 4', riskScore: 1 },
            { value: 2, label: '5 ou 6', riskScore: 2 },
            { value: 3, label: '7-9', riskScore: 3 },
            { value: 4, label: '10 ou mais', riskScore: 4 }
          ],
          metadata: { clinicalCode: 'F10.10' }
        },
        {
          id: 'audit_c_3_binge',
          text: 'Com que frequência você toma 6 ou mais doses de bebida em uma ocasião?',
          type: 'select',
          domain: 'risk_behaviors',
          instrument: 'AUDIT-C',
          riskWeight: 4,
          conditionalOn: [
            { questionId: 'audit_c_1_frequency', operator: '>', value: 0 }
          ],
          options: [
            { value: 0, label: 'Nunca', riskScore: 0 },
            { value: 1, label: 'Menos que mensalmente', riskScore: 1 },
            { value: 2, label: 'Mensalmente', riskScore: 2 },
            { value: 3, label: 'Semanalmente', riskScore: 3 },
            { value: 4, label: 'Diariamente ou quase', riskScore: 4 }
          ],
          metadata: { clinicalCode: 'F10.10' }
        },
        // NIDA Quick Screen
        {
          id: 'nida_quick_screen',
          text: 'No último ano, você usou alguma dessas substâncias mais do que pretendia?',
          type: 'multiselect',  // CRITICAL FIX 2: Change to multiselect to allow multiple substance selections
          domain: 'risk_behaviors',
          instrument: 'NIDA-Modified',
          riskWeight: 4,
          options: [
            { value: 'no', label: 'Não', riskScore: 0 },
            { value: 'yes_alcohol', label: 'Sim - Álcool', riskScore: 2 },
            { value: 'yes_tobacco', label: 'Sim - Tabaco/Nicotina', riskScore: 1 },
            { value: 'yes_prescription', label: 'Sim - Medicamentos controlados', riskScore: 3 },
            { value: 'yes_illegal', label: 'Sim - Drogas ilícitas', riskScore: 4 }
          ],
          validation: {
            // If 'no' is selected, don't allow other selections
            exclusiveOptions: ['no']
          },
          metadata: { sensitiveInfo: true, clinicalCode: 'F19' }
        },
        {
          id: 'substance_use_details',
          text: 'Nos últimos 12 meses, você usou alguma dessas substâncias?',
          type: 'multiselect',
          domain: 'risk_behaviors',
          instrument: 'ASSIST',
          riskWeight: 4,
          conditionalOn: [
            { questionId: 'nida_quick_screen', operator: '!=', value: 'no' }
          ],
          options: [
            { value: 'none', label: 'Nenhuma das listadas', riskScore: 0 },
            { value: 'tobacco', label: 'Tabaco/Cigarro', riskScore: 1 },
            { value: 'cannabis', label: 'Maconha/Cannabis', riskScore: 2 },
            { value: 'cocaine', label: 'Cocaína', riskScore: 4 },
            { value: 'stimulants', label: 'Estimulantes (anfetaminas)', riskScore: 3 },
            { value: 'sedatives', label: 'Sedativos (sem prescrição)', riskScore: 3 },
            { value: 'hallucinogens', label: 'Alucinógenos', riskScore: 3 },
            { value: 'opioids', label: 'Opioides (sem prescrição)', riskScore: 4 },
            { value: 'inhalants', label: 'Inalantes', riskScore: 3 }
          ],
          metadata: { sensitiveInfo: true, clinicalCode: 'F19' }
        },
        {
          id: 'substance_interference',
          text: 'O uso de substâncias tem interferido em suas responsabilidades ou relacionamentos?',
          type: 'select',
          domain: 'risk_behaviors',
          instrument: 'ASSIST',
          riskWeight: 4,
          conditionalOn: [
            { questionId: 'substance_use_details', operator: 'excludes', value: 'none' }
          ],
          options: [
            { value: 'never', label: 'Nunca', riskScore: 0 },
            { value: 'rarely', label: 'Raramente', riskScore: 1 },
            { value: 'sometimes', label: 'Às vezes', riskScore: 2 },
            { value: 'often', label: 'Frequentemente', riskScore: 3 },
            { value: 'always', label: 'Sempre', riskScore: 4 }
          ],
          metadata: { sensitiveInfo: true, clinicalCode: 'F19.9' }
        },
        // Smoking/Tobacco Assessment
        {
          id: 'tobacco_use',
          text: 'Você fuma ou usa produtos de tabaco?',
          type: 'select',
          domain: 'risk_behaviors',
          riskWeight: 2,
          options: [
            { value: 'never', label: 'Nunca fumei', riskScore: 0 },
            { value: 'former', label: 'Ex-fumante', riskScore: 1 },
            { value: 'current_light', label: 'Fumante atual (menos de 1 maço/dia)', riskScore: 2 },
            { value: 'current_heavy', label: 'Fumante atual (1 maço ou mais/dia)', riskScore: 3 }
          ],
          metadata: { clinicalCode: 'Z87.891' }
        },
        {
          id: 'risky_sexual_behavior',
          text: 'Nos últimos 6 meses, você teve comportamentos sexuais de risco?',
          type: 'multiselect',
          domain: 'risk_behaviors',
          riskWeight: 3,
          options: [
            { value: 'none', label: 'Nenhum comportamento de risco', riskScore: 0 },
            { value: 'unprotected', label: 'Relações sem proteção com novos parceiros', riskScore: 3 },
            { value: 'multiple_partners', label: 'Múltiplos parceiros sexuais', riskScore: 2 },
            { value: 'substance_influence', label: 'Relações sob influência de substâncias', riskScore: 3 },
            { value: 'commercial', label: 'Atividades sexuais comerciais', riskScore: 4 }
          ],
          metadata: { sensitiveInfo: true, clinicalCode: 'Z72.5' }
        },
        // Driving Safety Assessment
        {
          id: 'driving_habits',
          text: 'Você dirige regularmente?',
          type: 'boolean',
          domain: 'risk_behaviors',
          riskWeight: 1
        },
        {
          id: 'driving_safety',
          text: 'Nos últimos 12 meses, você já:',
          type: 'multiselect',
          domain: 'risk_behaviors',
          riskWeight: 4,
          conditionalOn: [
            { questionId: 'driving_habits', operator: '=', value: true }
          ],
          options: [
            { value: 'none', label: 'Nenhuma das situações abaixo', riskScore: 0 },
            { value: 'no_seatbelt', label: 'Dirigiu sem cinto de segurança', riskScore: 2 },
            { value: 'drunk_driving', label: 'Dirigiu após beber álcool', riskScore: 4 },
            { value: 'drug_driving', label: 'Dirigiu sob efeito de substâncias', riskScore: 4 },
            { value: 'texting', label: 'Usou celular enquanto dirigia', riskScore: 2 },
            { value: 'speeding', label: 'Dirigiu muito acima do limite de velocidade', riskScore: 3 },
            { value: 'drowsy', label: 'Dirigiu com muito sono', riskScore: 3 }
          ],
          metadata: { clinicalCode: 'Z72.8' }
        },
        // Violence and Safety Screening
        {
          id: 'domestic_violence_screen',
          text: 'Você já se sentiu ameaçado ou machucado por alguém próximo a você?',
          type: 'select',
          domain: 'risk_behaviors',
          riskWeight: 5,
          options: [
            { value: 'never', label: 'Nunca', riskScore: 0 },
            { value: 'past', label: 'No passado, mas não atualmente', riskScore: 2 },
            { value: 'current', label: 'Sim, atualmente', riskScore: 5 }
          ],
          metadata: { sensitiveInfo: true, clinicalCode: 'Z91.410' }
        },
        {
          id: 'self_harm_risk',
          text: 'Nos últimos 2 meses, você teve pensamentos de se machucar?',
          type: 'select',
          domain: 'risk_behaviors',
          instrument: 'Columbia Scale',
          riskWeight: 5,
          options: [
            { value: 'never', label: 'Nunca', riskScore: 0 },
            { value: 'passive', label: 'Pensamentos passivos (seria melhor estar morto)', riskScore: 2 },
            { value: 'active_no_plan', label: 'Pensamentos ativos sem plano específico', riskScore: 4 },
            { value: 'active_with_plan', label: 'Pensamentos com plano específico', riskScore: 5 },
            { value: 'recent_attempt', label: 'Tentativa recente', riskScore: 5 }
          ],
          metadata: { sensitiveInfo: true, clinicalCode: 'R45.851' }
        },
        {
          id: 'violence_exposure',
          text: 'Você se sente seguro em casa e no trabalho?',
          type: 'select',
          domain: 'risk_behaviors',
          riskWeight: 3,
          options: [
            { value: 'always_safe', label: 'Sempre me sinto seguro', riskScore: 0 },
            { value: 'mostly_safe', label: 'Na maior parte do tempo', riskScore: 1 },
            { value: 'sometimes_unsafe', label: 'Às vezes me sinto inseguro', riskScore: 2 },
            { value: 'frequently_unsafe', label: 'Frequentemente inseguro', riskScore: 3 },
            { value: 'never_safe', label: 'Nunca me sinto seguro', riskScore: 4 }
          ],
          metadata: { sensitiveInfo: true, clinicalCode: 'Z91.82' }
        }
      ],
      completionTriggers: [
        {
          conditions: [{ questionId: 'substance_use_screening', operator: '>', value: -1 }],
          operator: 'AND',
          action: 'complete_layer'
        }
      ],
      nextDomainTriggers: [
        {
          condition: { questionId: 'self_harm_risk', operator: '>=', value: 2 },
          action: 'prioritize_domain',
          targetDomain: 'mental_health_crisis'
        }
      ]
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

// CRISIS INTERVENTION DOMAIN (Emergency Response)
export const CRISIS_INTERVENTION_DOMAIN: HealthDomain = {
  id: 'crisis_intervention',
  name: 'Intervenção de Crise',
  description: 'Protocolo de resposta a emergências e crises',
  priority: 10, // Highest priority
  estimatedMinutes: 5,
  triggerConditions: [
    {
      condition: { questionId: 'emergency_check', operator: 'excludes', value: 'none' },
      action: 'enter_domain',
      targetDomain: 'crisis_intervention'
    },
    {
      condition: { questionId: 'phq9_9_suicidal_ideation', operator: '>', value: 0 },
      action: 'enter_domain',
      targetDomain: 'crisis_intervention'
    },
    {
      condition: { questionId: 'self_harm_risk', operator: '>=', value: 2 },
      action: 'enter_domain',
      targetDomain: 'crisis_intervention'
    }
  ],
  layers: [
    {
      id: 'crisis_assessment',
      name: 'Avaliação de Crise',
      description: 'Protocolo de segurança imediata',
      estimatedSeconds: 120,
      questions: [
        {
          id: 'crisis_type',
          text: 'Qual situação de emergência você está enfrentando?',
          type: 'select',
          domain: 'crisis_intervention',
          riskWeight: 10,
          options: [
            { value: 'suicidal_thoughts', label: 'Pensamentos suicidas', riskScore: 10 },
            { value: 'self_harm_urge', label: 'Vontade de se machucar', riskScore: 9 },
            { value: 'panic_attack', label: 'Ataque de pânico', riskScore: 7 },
            { value: 'severe_depression', label: 'Depressão severa', riskScore: 8 },
            { value: 'violence_threat', label: 'Ameaça de violência', riskScore: 10 },
            { value: 'substance_crisis', label: 'Crise relacionada a substâncias', riskScore: 8 }
          ],
          metadata: { criticalPath: true, clinicalCode: 'Z91.5' }
        },
        {
          id: 'immediate_safety',
          text: 'Você está em segurança neste momento?',
          type: 'boolean',
          domain: 'crisis_intervention',
          riskWeight: 10,
          metadata: { criticalPath: true }
        },
        {
          id: 'support_available',
          text: 'Há alguém com você ou que você possa contatar agora?',
          type: 'boolean',
          domain: 'crisis_intervention',
          riskWeight: 8,
          metadata: { criticalPath: true }
        },
        {
          id: 'emergency_contact_permission',
          text: 'Podemos entrar em contato com seu contato de emergência?',
          type: 'boolean',
          domain: 'crisis_intervention',
          riskWeight: 5,
          conditionalOn: [
            { questionId: 'immediate_safety', operator: '=', value: false }
          ]
        },
        {
          id: 'suicide_plan',
          text: 'Você tem um plano específico para se machucar?',
          type: 'boolean',
          domain: 'crisis_intervention',
          riskWeight: 10,
          conditionalOn: [
            { questionId: 'crisis_type', operator: '=', value: 'suicidal_thoughts' },
            { questionId: 'crisis_type', operator: '=', value: 'self_harm_urge' }
          ],
          metadata: { criticalPath: true, clinicalCode: 'R45.851' }
        },
        {
          id: 'suicide_means',
          text: 'Você tem acesso aos meios para executar esse plano?',
          type: 'boolean',
          domain: 'crisis_intervention',
          riskWeight: 10,
          conditionalOn: [
            { questionId: 'suicide_plan', operator: '=', value: true }
          ],
          metadata: { criticalPath: true }
        },
        {
          id: 'suicide_timeline',
          text: 'Quando você estava planejando fazer isso?',
          type: 'select',
          domain: 'crisis_intervention',
          riskWeight: 10,
          conditionalOn: [
            { questionId: 'suicide_plan', operator: '=', value: true }
          ],
          options: [
            { value: 'immediately', label: 'Imediatamente/Hoje', riskScore: 10 },
            { value: 'within_days', label: 'Nos próximos dias', riskScore: 8 },
            { value: 'within_weeks', label: 'Nas próximas semanas', riskScore: 6 },
            { value: 'no_timeline', label: 'Não tenho data específica', riskScore: 4 }
          ],
          metadata: { criticalPath: true }
        },
        {
          id: 'protective_factors',
          text: 'O que tem impedido você de agir sobre esses pensamentos?',
          type: 'multiselect',
          domain: 'crisis_intervention',
          riskWeight: -2, // Negative weight for protective factors
          conditionalOn: [
            { questionId: 'crisis_type', operator: '=', value: 'suicidal_thoughts' },
            { questionId: 'crisis_type', operator: '=', value: 'self_harm_urge' }
          ],
          options: [
            { value: 'family', label: 'Família/Amigos', riskScore: -2 },
            { value: 'children', label: 'Filhos', riskScore: -3 },
            { value: 'pets', label: 'Animais de estimação', riskScore: -1 },
            { value: 'religion', label: 'Crenças religiosas/espirituais', riskScore: -2 },
            { value: 'hope', label: 'Esperança de melhora', riskScore: -2 },
            { value: 'fear', label: 'Medo da dor', riskScore: -1 },
            { value: 'none', label: 'Nada específico', riskScore: 2 }
          ]
        },
        {
          id: 'previous_attempts',
          text: 'Você já tentou se machucar antes?',
          type: 'boolean',
          domain: 'crisis_intervention',
          riskWeight: 8,
          conditionalOn: [
            { questionId: 'crisis_type', operator: '=', value: 'suicidal_thoughts' },
            { questionId: 'crisis_type', operator: '=', value: 'self_harm_urge' }
          ],
          metadata: { sensitiveInfo: true, clinicalCode: 'Z91.5' }
        },
        {
          id: 'safety_plan_agreement',
          text: 'Você está disposto a criar um plano de segurança conosco agora?',
          type: 'boolean',
          domain: 'crisis_intervention',
          riskWeight: -3, // Negative weight for willingness to engage
          metadata: { criticalPath: true }
        }
      ],
      completionTriggers: [
        {
          conditions: [{ questionId: 'safety_plan_agreement', operator: '!=', value: null }],
          operator: 'AND',
          action: 'complete_domain'
        }
      ],
      nextDomainTriggers: []
    }
  ]
};

// UNIFIED FLOW MANAGER
export class UnifiedHealthFlow {
  // Total possible domains: pain_management, mental_health, chronic_disease, lifestyle, family_history, risk_behaviors, crisis_intervention, validation
  private static readonly TOTAL_POSSIBLE_DOMAINS = 8;
  
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
      RISK_BEHAVIORS_DOMAIN,
      CRISIS_INTERVENTION_DOMAIN,
      VALIDATION_DOMAIN
    ];

    for (const domain of allDomains) {
      if (this.completedDomains.has(domain.id)) continue;
      
      // Avoid duplicate entries
      if (this.triggeredDomains.find(d => d.id === domain.id)) continue;
      
      for (const trigger of domain.triggerConditions) {
        if (this.evaluateCondition(trigger.condition)) {
          if (trigger.action === 'enter_domain' || trigger.action === 'prioritize_domain') {
            this.triggeredDomains.push(domain);
            break; // Only add once per domain
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
        this.currentLayer = VALIDATION_DOMAIN.layers[0] || null;
        return this.processNextQuestion();
      }
      
      // Everything complete - prevent infinite recursion
      return {
        type: 'complete',
        results: this.generateResults(),
        progress: 100,
        currentDomain: 'Completo',
        currentLayer: 'Finalizado',
        estimatedTimeRemaining: 0
      };
    }

    this.currentDomain = nextDomain;
    this.currentLayer = nextDomain.layers[0] || null;
    
    return {
      type: 'domain_transition',
      domain: nextDomain,
      message: `Agora vamos falar sobre ${nextDomain.name.toLowerCase()}. ${nextDomain.description}`,
      progress: this.calculateProgress(),
      currentDomain: nextDomain.name,
      currentLayer: this.currentLayer?.name || 'unknown',
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
    // Use total possible domains instead of triggered domains to avoid 50% bug
    // This ensures consistent progress calculation regardless of how many domains are triggered
    const totalDomains = UnifiedHealthFlow.TOTAL_POSSIBLE_DOMAINS + 1; // +1 for triage (7 total)
    const completedCount = this.completedDomains.size + (this.isTriageComplete ? 1 : 0);
    return Math.round((completedCount / totalDomains) * 100);
  }

  private calculateTimeRemaining(): number {
    // Calculate remaining time based on triggered domains only (this is correct behavior)
    const remainingDomains = this.triggeredDomains.filter(d => !this.completedDomains.has(d.id));
    const remainingTime = remainingDomains.reduce((total, domain) => total + domain.estimatedMinutes, 0);
    
    // Add triage time if not complete
    const triageTimeRemaining = this.isTriageComplete ? 0 : 1; // 1 minute for triage
    
    return remainingTime + triageTimeRemaining;
  }

  private findQuestion(questionId: string): HealthQuestion | null {
    // Check current layer first
    if (this.currentLayer) {
      const question = this.currentLayer.questions.find(q => q.id === questionId);
      if (question) return question;
    }

    // Search all domains
    const allDomains = [PAIN_DOMAIN, MENTAL_HEALTH_DOMAIN, CHRONIC_DISEASE_DOMAIN, LIFESTYLE_DOMAIN, FAMILY_HISTORY_DOMAIN, RISK_BEHAVIORS_DOMAIN, CRISIS_INTERVENTION_DOMAIN, VALIDATION_DOMAIN];
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
    
    if ((this.riskScores.pain || 0) >= 5) {
      recommendations.push('Considere consultar um especialista em manejo da dor');
    }
    
    if ((this.riskScores.mental_health || 0) >= 5) {
      recommendations.push('Recomendamos conversar com um profissional de saúde mental');
    }
    
    if ((this.riskScores.lifestyle || 0) >= 8) {
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