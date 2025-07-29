// Three-Layer Progressive Health Screening System
// Implements evidence-based screening with progressive disclosure

export interface ScreeningLayer {
  id: string;
  name: string;
  description: string;
  estimatedSeconds: number;
  triggers: TriggerCondition[];
  questions: ScreeningQuestion[];
  actions: ScreeningAction[];
}

export interface ScreeningQuestion {
  id: string;
  text: string;
  type: 'scale' | 'select' | 'multiselect';
  instrument: string; // NRS, PHQ-2, GAD-2, WHO-5, etc.
  options?: Array<{
    value: number | string;
    label: string;
    emoji?: string;
  }>;
  visual?: 'slider' | 'buttons' | 'emoji-scale';
  scoring?: {
    threshold: number;
    interpretation: string;
  };
  conditionalOn?: {
    questionId: string;
    operator: '>=' | '>' | '=' | '<=' | '<' | 'includes';
    value: number | string | string[];
  };
}

export interface TriggerCondition {
  questionId: string;
  operator: '>=' | '>' | '=' | '<=' | '<' | 'includes';
  value: number | string | string[];
  nextLayer?: string;
  action?: string;
}

export interface ScreeningAction {
  type: 'alert' | 'schedule' | 'resource' | 'followup' | 'education';
  priority: 'low' | 'moderate' | 'high' | 'critical';
  data: any;
}

// LAYER 1: Ultra-rapid Triage (30 seconds)
export const LAYER_1_TRIAGE: ScreeningLayer = {
  id: 'triage',
  name: 'Check-up Rápido',
  description: 'Avaliação rápida do seu bem-estar',
  estimatedSeconds: 30,
  questions: [
    {
      id: 'pain_now',
      text: 'Numa escala de 0 a 10, qual sua dor agora?',
      type: 'scale',
      instrument: 'NRS',
      visual: 'slider',
      options: Array.from({ length: 11 }, (_, i) => ({
        value: i,
        label: i.toString(),
        emoji: i === 0 ? '😊' : i <= 3 ? '😐' : i <= 6 ? '😣' : i <= 9 ? '😫' : '😭'
      })),
      scoring: {
        threshold: 4,
        interpretation: 'Dor clinicamente significativa'
      }
    },
    {
      id: 'phq2_interest',
      text: 'Nas últimas 2 semanas, você teve pouco interesse ou prazer em fazer as coisas?',
      type: 'select',
      instrument: 'PHQ-2',
      options: [
        { value: 0, label: 'Nunca' },
        { value: 1, label: 'Alguns dias' },
        { value: 2, label: 'Mais da metade dos dias' },
        { value: 3, label: 'Quase todos os dias' }
      ]
    },
    {
      id: 'gad2_nervous',
      text: 'Nas últimas 2 semanas, você se sentiu nervoso, ansioso ou tenso?',
      type: 'select',
      instrument: 'GAD-2',
      options: [
        { value: 0, label: 'Nunca' },
        { value: 1, label: 'Alguns dias' },
        { value: 2, label: 'Mais da metade dos dias' },
        { value: 3, label: 'Quase todos os dias' }
      ]
    }
  ],
  triggers: [
    {
      questionId: 'pain_now',
      operator: '>=',
      value: 4,
      nextLayer: 'targeted'
    },
    {
      questionId: 'phq2_interest',
      operator: '>=',
      value: 1,
      nextLayer: 'targeted'
    },
    {
      questionId: 'gad2_nervous',
      operator: '>=',
      value: 1,
      nextLayer: 'targeted'
    }
  ],
  actions: [
    {
      type: 'education',
      priority: 'low',
      data: {
        condition: 'all_normal',
        message: 'Ótimo! Seus sinais vitais estão bem.',
        resources: ['wellness_tips', 'preventive_care']
      }
    }
  ]
};

// LAYER 2: Targeted Assessment (2-3 minutes)
export const LAYER_2_TARGETED: ScreeningLayer = {
  id: 'targeted',
  name: 'Avaliação Direcionada',
  description: 'Vamos entender melhor como você está se sentindo',
  estimatedSeconds: 180,
  questions: [
    // WHO-5 Well-being Index (Universal for all Layer 2 cases)
    {
      id: 'who5_1',
      text: 'Nas últimas 2 semanas: Eu me senti alegre e de bom humor',
      type: 'select',
      instrument: 'WHO-5',
      options: [
        { value: 0, label: 'Em nenhum momento' },
        { value: 1, label: 'Em alguns momentos' },
        { value: 2, label: 'Em menos da metade do tempo' },
        { value: 3, label: 'Em mais da metade do tempo' },
        { value: 4, label: 'Na maior parte do tempo' },
        { value: 5, label: 'O tempo todo' }
      ]
    },
    {
      id: 'who5_2',
      text: 'Nas últimas 2 semanas: Eu me senti calmo e relaxado',
      type: 'select',
      instrument: 'WHO-5',
      options: [
        { value: 0, label: 'Em nenhum momento' },
        { value: 1, label: 'Em alguns momentos' },
        { value: 2, label: 'Em menos da metade do tempo' },
        { value: 3, label: 'Em mais da metade do tempo' },
        { value: 4, label: 'Na maior parte do tempo' },
        { value: 5, label: 'O tempo todo' }
      ]
    },
    {
      id: 'who5_3',
      text: 'Nas últimas 2 semanas: Eu me senti ativo e com energia',
      type: 'select',
      instrument: 'WHO-5',
      options: [
        { value: 0, label: 'Em nenhum momento' },
        { value: 1, label: 'Em alguns momentos' },
        { value: 2, label: 'Em menos da metade do tempo' },
        { value: 3, label: 'Em mais da metade do tempo' },
        { value: 4, label: 'Na maior parte do tempo' },
        { value: 5, label: 'O tempo todo' }
      ]
    },
    {
      id: 'who5_4',
      text: 'Nas últimas 2 semanas: Acordei me sentindo descansado',
      type: 'select',
      instrument: 'WHO-5',
      options: [
        { value: 0, label: 'Em nenhum momento' },
        { value: 1, label: 'Em alguns momentos' },
        { value: 2, label: 'Em menos da metade do tempo' },
        { value: 3, label: 'Em mais da metade do tempo' },
        { value: 4, label: 'Na maior parte do tempo' },
        { value: 5, label: 'O tempo todo' }
      ]
    },
    {
      id: 'who5_5',
      text: 'Nas últimas 2 semanas: Meu dia a dia tem sido preenchido com coisas que me interessam',
      type: 'select',
      instrument: 'WHO-5',
      options: [
        { value: 0, label: 'Em nenhum momento' },
        { value: 1, label: 'Em alguns momentos' },
        { value: 2, label: 'Em menos da metade do tempo' },
        { value: 3, label: 'Em mais da metade do tempo' },
        { value: 4, label: 'Na maior parte do tempo' },
        { value: 5, label: 'O tempo todo' }
      ]
    },
    // Pain Interference Questions (PEG adapted) - Only if pain >= 4
    {
      id: 'pain_work',
      text: 'Como a dor interferiu no seu trabalho ou atividades diárias? (0 = não interferiu, 10 = interferiu completamente)',
      type: 'scale',
      instrument: 'PEG',
      visual: 'slider',
      options: Array.from({ length: 11 }, (_, i) => ({
        value: i,
        label: i.toString(),
        emoji: i === 0 ? '😊' : i <= 3 ? '😐' : i <= 6 ? '😔' : i <= 9 ? '😫' : '😭'
      })),
      conditionalOn: {
        questionId: 'pain_now',
        operator: '>=',
        value: 4
      }
    },
    {
      id: 'pain_mood',
      text: 'Como a dor afetou seu humor? (0 = não afetou, 10 = afetou muito)',
      type: 'scale',
      instrument: 'PEG',
      visual: 'slider',
      options: Array.from({ length: 11 }, (_, i) => ({
        value: i,
        label: i.toString(),
        emoji: i === 0 ? '😊' : i <= 3 ? '😐' : i <= 6 ? '😔' : i <= 9 ? '😫' : '😭'
      })),
      conditionalOn: {
        questionId: 'pain_now',
        operator: '>=',
        value: 4
      }
    },
    {
      id: 'pain_sleep',
      text: 'Como a dor interferiu no seu sono? (0 = não interferiu, 10 = interferiu completamente)',
      type: 'scale',
      instrument: 'PEG',
      visual: 'slider',
      options: Array.from({ length: 11 }, (_, i) => ({
        value: i,
        label: i.toString(),
        emoji: i === 0 ? '😴' : i <= 3 ? '😐' : i <= 6 ? '😔' : i <= 9 ? '😫' : '😭'
      })),
      conditionalOn: {
        questionId: 'pain_now',
        operator: '>=',
        value: 4
      }
    }
  ],
  triggers: [
    {
      questionId: 'who5_score',
      operator: '<=',
      value: 50,
      action: 'wellbeing_support'
    },
    {
      questionId: 'who5_score',
      operator: '<=',
      value: 28,
      nextLayer: 'specialized',
      action: 'depression_screening'
    },
    {
      questionId: 'pain_work',
      operator: '>=',
      value: 7,
      nextLayer: 'specialized'
    },
    {
      questionId: 'pain_mood',
      operator: '>=',
      value: 7,
      nextLayer: 'specialized'
    },
    {
      questionId: 'pain_sleep',
      operator: '>=',
      value: 7,
      nextLayer: 'specialized'
    }
  ],
  actions: [
    {
      type: 'resource',
      priority: 'moderate',
      data: {
        condition: 'moderate_symptoms',
        resources: ['self_help_apps', 'meditation_guides', 'pain_management']
      }
    },
    {
      type: 'schedule',
      priority: 'moderate',
      data: {
        message: 'Gostaria de conversar com um profissional? Posso agendar uma consulta.',
        specialties: ['psychology', 'pain_management']
      }
    },
    {
      type: 'followup',
      priority: 'moderate',
      data: {
        interval: '1_week',
        message: 'Farei um acompanhamento em 1 semana para ver como você está.'
      }
    }
  ]
};

// LAYER 3: Specialized Assessment (5-7 minutes)
export const LAYER_3_SPECIALIZED: ScreeningLayer = {
  id: 'specialized',
  name: 'Avaliação Especializada',
  description: 'Avaliação detalhada para oferecer o melhor cuidado',
  estimatedSeconds: 420,
  questions: [
    // These would include full PHQ-9, GAD-7, and suicide risk assessment
    // Implemented based on triggers from Layer 2
  ],
  triggers: [
    {
      questionId: 'phq9_suicide',
      operator: '>',
      value: 0,
      action: 'crisis_intervention'
    }
  ],
  actions: [
    {
      type: 'alert',
      priority: 'critical',
      data: {
        notify: 'clinical_team',
        urgency: 'immediate',
        message: 'Paciente necessita avaliação clínica urgente'
      }
    },
    {
      type: 'resource',
      priority: 'critical',
      data: {
        condition: 'crisis',
        resources: ['crisis_hotline', 'emergency_contacts', 'support_centers'],
        message: 'Recursos de apoio disponíveis 24h'
      }
    }
  ]
};

// Scoring Functions
export function calculateWHO5Score(responses: Record<string, number>): number {
  const who5Questions = ['who5_1', 'who5_2', 'who5_3', 'who5_4', 'who5_5'];
  const sum = who5Questions.reduce((total, q) => total + (responses[q] || 0), 0);
  return (sum / 25) * 100; // Convert to percentage (0-100)
}

export function calculatePHQ2Score(responses: Record<string, number>): number {
  return (responses['phq2_interest'] || 0) + (responses['phq2_depressed'] || 0);
}

export function calculateGAD2Score(responses: Record<string, number>): number {
  return (responses['gad2_nervous'] || 0) + (responses['gad2_worry'] || 0);
}

// Progressive Screening Flow Manager
export class ProgressiveScreeningFlow {
  private currentLayer: ScreeningLayer;
  private responses: Record<string, any> = {};
  private triggeredActions: ScreeningAction[] = [];

  constructor() {
    this.currentLayer = LAYER_1_TRIAGE;
  }

  async processResponse(questionId: string, value: any) {
    this.responses[questionId] = value;
    
    // Check triggers for this response
    const triggers = this.currentLayer.triggers.filter(t => t.questionId === questionId);
    
    for (const trigger of triggers) {
      if (this.evaluateTrigger(trigger, value)) {
        if (trigger.nextLayer) {
          // Progress to next layer
          return trigger.nextLayer;
        }
        if (trigger.action) {
          // Queue action
          const action = this.currentLayer.actions.find(a => a.data.condition === trigger.action);
          if (action) {
            this.triggeredActions.push(action);
          }
        }
      }
    }
    
    return null; // Stay in current layer
  }

  private evaluateTrigger(trigger: TriggerCondition, value: any): boolean {
    switch (trigger.operator) {
      case '>=': return value >= trigger.value;
      case '>': return value > trigger.value;
      case '=': return value === trigger.value;
      case '<=': return value <= trigger.value;
      case '<': return value < trigger.value;
      case 'includes': return Array.isArray(value) && value.includes(trigger.value);
      default: return false;
    }
  }

  getNextQuestion(): ScreeningQuestion | null {
    const answeredIds = Object.keys(this.responses);
    
    // Find the next unanswered question that meets its conditional requirements
    return this.currentLayer.questions.find(q => {
      // Skip if already answered
      if (answeredIds.includes(q.id)) return false;
      
      // Check if conditional requirements are met
      if (q.conditionalOn) {
        const conditionValue = this.responses[q.conditionalOn.questionId];
        if (conditionValue === undefined) return false;
        
        // Check if condition is satisfied
        return this.evaluateTrigger({
          questionId: q.conditionalOn.questionId,
          operator: q.conditionalOn.operator,
          value: q.conditionalOn.value,
        }, conditionValue);
      }
      
      // No conditional requirements, question is available
      return true;
    }) || null;
  }

  getTriggeredActions(): ScreeningAction[] {
    return this.triggeredActions;
  }

  shouldProgressToNextLayer(): boolean {
    // Check if all available questions (considering conditionals) are answered
    const availableQuestions = this.currentLayer.questions.filter(q => {
      if (q.conditionalOn) {
        const conditionValue = this.responses[q.conditionalOn.questionId];
        if (conditionValue === undefined) return false;
        
        return this.evaluateTrigger({
          questionId: q.conditionalOn.questionId,
          operator: q.conditionalOn.operator,
          value: q.conditionalOn.value,
        }, conditionValue);
      }
      return true;
    });
    
    const answeredCount = availableQuestions.filter(q => 
      this.responses[q.id] !== undefined
    ).length;
    
    return answeredCount === availableQuestions.length;
  }

  public transitionToLayer(layerId: string): void {
    switch (layerId) {
      case 'targeted':
        this.currentLayer = LAYER_2_TARGETED;
        break;
      case 'specialized':
        this.currentLayer = LAYER_3_SPECIALIZED;
        break;
    }
  }

  public getCurrentLayer(): ScreeningLayer {
    return this.currentLayer;
  }
}

// Automated Response Templates
export const RESPONSE_TEMPLATES = {
  low_risk: {
    title: "Ótimo! Seus sinais vitais estão bem.",
    message: "Continue cuidando da sua saúde. Aqui estão algumas dicas personalizadas para você:",
    actions: ["wellness_tips", "preventive_reminders"]
  },
  moderate_risk: {
    title: "Identificamos alguns pontos que merecem atenção.",
    message: "Vamos ajudá-lo a se sentir melhor. Aqui estão alguns recursos:",
    actions: ["self_help_resources", "schedule_consultation", "weekly_followup"]
  },
  high_risk: {
    title: "Sua saúde é nossa prioridade.",
    message: "Um profissional de saúde entrará em contato nas próximas 24 horas.",
    actions: ["clinical_alert", "immediate_resources", "crisis_support"]
  }
};

// Integration with existing questionnaire system
export function integrateProgressiveScreening(existingSections: any[]): any[] {
  // Insert progressive screening as the first section
  return [
    {
      id: 'progressive_screening',
      title: 'Avaliação de Bem-estar',
      description: 'Vamos fazer um check-up rápido do seu bem-estar',
      estimatedMinutes: 1,
      priority: 'critical',
      isProgressive: true,
      layers: [LAYER_1_TRIAGE, LAYER_2_TARGETED, LAYER_3_SPECIALIZED]
    },
    ...existingSections
  ];
}