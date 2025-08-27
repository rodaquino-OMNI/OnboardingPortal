// Advanced Health Questionnaire System V2
// Implements evidence-based screening tools with fraud detection
//
// NOTE: This file contains the complete clinical questionnaires (PHQ-9, GAD-7, AUDIT-C, NIDA, 
// allergy screening, crisis intervention) and gamification logic.
// For flow orchestration and UI components, see unified-health-flow.ts
//
// CLINICAL STANDARDS IMPLEMENTED:
// ✅ Complete PHQ-9 (9 questions) - Depression screening with clinical cutoffs
// ✅ Complete GAD-7 (7 questions) - Anxiety screening with clinical cutoffs  
// ✅ AUDIT-C (3 questions) - Alcohol use disorder screening
// ✅ NIDA Quick Screen (2 questions) - Substance use screening
// ✅ Comprehensive Allergy Screening (7 questions) - Drug, food, environmental allergies
// ✅ Crisis Intervention Protocols (9 questions) - Safety assessment and suicide risk
// ✅ Enhanced Gamification - Badges for clinical excellence and safety

import type { QuestionValue } from '@/types';

export interface HealthQuestion {
  id: string;
  text: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'scale' | 'date' | 'chronic_conditions' | 'medication_list' | 'allergy_list' | 'emergency_contact' | 'surgery_history';
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

// Validated clinical screening tools - Complete PHQ-9 Implementation
export const PHQ9_QUESTIONS: HealthQuestion[] = [
  {
    id: 'phq9_1',
    text: 'Nas últimas 2 semanas, com que frequência você teve pouco interesse ou prazer em fazer as coisas?',
    type: 'select',
    category: 'mental_health',
    required: true,
    riskWeight: 3,
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Alguns dias' },
      { value: 2, label: 'Mais da metade dos dias' },
      { value: 3, label: 'Quase todos os dias' }
    ],
    metadata: { validatedTool: 'PHQ-9', clinicalCode: 'F32.9' }
  },
  {
    id: 'phq9_2',
    text: 'Nas últimas 2 semanas, com que frequência você se sentiu deprimido, triste ou sem esperança?',
    type: 'select',
    category: 'mental_health',
    required: true,
    riskWeight: 3,
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Alguns dias' },
      { value: 2, label: 'Mais da metade dos dias' },
      { value: 3, label: 'Quase todos os dias' }
    ],
    metadata: { validatedTool: 'PHQ-9', clinicalCode: 'F32.9' }
  },
  {
    id: 'phq9_3',
    text: 'Nas últimas 2 semanas, com que frequência você teve dificuldade para adormecer, continuar dormindo ou dormir demais?',
    type: 'select',
    category: 'mental_health',
    required: true,
    riskWeight: 3,
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Alguns dias' },
      { value: 2, label: 'Mais da metade dos dias' },
      { value: 3, label: 'Quase todos os dias' }
    ],
    metadata: { validatedTool: 'PHQ-9', clinicalCode: 'G47.00' }
  },
  {
    id: 'phq9_4',
    text: 'Nas últimas 2 semanas, com que frequência você se sentiu cansado ou com pouca energia?',
    type: 'select',
    category: 'mental_health',
    required: true,
    riskWeight: 3,
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Alguns dias' },
      { value: 2, label: 'Mais da metade dos dias' },
      { value: 3, label: 'Quase todos os dias' }
    ],
    metadata: { validatedTool: 'PHQ-9', clinicalCode: 'R53.83' }
  },
  {
    id: 'phq9_5',
    text: 'Nas últimas 2 semanas, com que frequência você teve falta de apetite ou comeu demais?',
    type: 'select',
    category: 'mental_health',
    required: true,
    riskWeight: 2,
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Alguns dias' },
      { value: 2, label: 'Mais da metade dos dias' },
      { value: 3, label: 'Quase todos os dias' }
    ],
    metadata: { validatedTool: 'PHQ-9', clinicalCode: 'R63.0' }
  },
  {
    id: 'phq9_6',
    text: 'Nas últimas 2 semanas, com que frequência você se sentiu mal consigo mesmo ou que é um fracasso ou que decepcionou sua família ou você mesmo?',
    type: 'select',
    category: 'mental_health',
    required: true,
    riskWeight: 4,
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Alguns dias' },
      { value: 2, label: 'Mais da metade dos dias' },
      { value: 3, label: 'Quase todos os dias' }
    ],
    metadata: { validatedTool: 'PHQ-9', clinicalCode: 'F32.9' }
  },
  {
    id: 'phq9_7',
    text: 'Nas últimas 2 semanas, com que frequência você teve dificuldade para se concentrar nas coisas como ler jornal ou assistir televisão?',
    type: 'select',
    category: 'mental_health',
    required: true,
    riskWeight: 3,
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Alguns dias' },
      { value: 2, label: 'Mais da metade dos dias' },
      { value: 3, label: 'Quase todos os dias' }
    ],
    metadata: { validatedTool: 'PHQ-9', clinicalCode: 'R41.840' }
  },
  {
    id: 'phq9_8',
    text: 'Nas últimas 2 semanas, com que frequência você se moveu ou falou tão devagar que outras pessoas poderiam ter notado? Ou o oposto - ficou tão agitado ou inquieto que se moveu muito mais do que o habitual?',
    type: 'select',
    category: 'mental_health',
    required: true,
    riskWeight: 3,
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Alguns dias' },
      { value: 2, label: 'Mais da metade dos dias' },
      { value: 3, label: 'Quase todos os dias' }
    ],
    metadata: { validatedTool: 'PHQ-9', clinicalCode: 'F32.9' }
  },
  {
    id: 'phq9_9',
    text: 'Nas últimas 2 semanas, teve pensamentos de que seria melhor estar morto ou de se machucar de alguma forma?',
    type: 'select',
    category: 'mental_health',
    required: true,
    riskWeight: 10, // Highest risk weight for suicide screening
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Alguns dias' },
      { value: 2, label: 'Mais da metade dos dias' },
      { value: 3, label: 'Quase todos os dias' }
    ],
    metadata: { validatedTool: 'PHQ-9', clinicalCode: 'R45.851', sensitiveInfo: true }
  }
];

export const GAD7_QUESTIONS: HealthQuestion[] = [
  {
    id: 'gad7_1',
    text: 'Nas últimas 2 semanas, com que frequência você se sentiu nervoso, ansioso ou no limite?',
    type: 'select',
    category: 'mental_health',
    required: true,
    riskWeight: 3,
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Alguns dias' },
      { value: 2, label: 'Mais da metade dos dias' },
      { value: 3, label: 'Quase todos os dias' }
    ],
    metadata: { validatedTool: 'GAD-7', clinicalCode: 'F41.1' }
  },
  {
    id: 'gad7_2',
    text: 'Nas últimas 2 semanas, com que frequência você não conseguiu parar ou controlar as preocupações?',
    type: 'select',
    category: 'mental_health',
    required: true,
    riskWeight: 3,
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Alguns dias' },
      { value: 2, label: 'Mais da metade dos dias' },
      { value: 3, label: 'Quase todos os dias' }
    ],
    metadata: { validatedTool: 'GAD-7', clinicalCode: 'F41.1' }
  },
  {
    id: 'gad7_3',
    text: 'Nas últimas 2 semanas, com que frequência você se preocupou demais com coisas diferentes?',
    type: 'select',
    category: 'mental_health',
    required: true,
    riskWeight: 3,
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Alguns dias' },
      { value: 2, label: 'Mais da metade dos dias' },
      { value: 3, label: 'Quase todos os dias' }
    ],
    metadata: { validatedTool: 'GAD-7', clinicalCode: 'F41.1' }
  },
  {
    id: 'gad7_4',
    text: 'Nas últimas 2 semanas, com que frequência você teve dificuldade para relaxar?',
    type: 'select',
    category: 'mental_health',
    required: true,
    riskWeight: 2,
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Alguns dias' },
      { value: 2, label: 'Mais da metade dos dias' },
      { value: 3, label: 'Quase todos os dias' }
    ],
    metadata: { validatedTool: 'GAD-7', clinicalCode: 'F41.1' }
  },
  {
    id: 'gad7_5',
    text: 'Nas últimas 2 semanas, com que frequência você ficou tão inquieto que foi difícil permanecer parado?',
    type: 'select',
    category: 'mental_health',
    required: true,
    riskWeight: 3,
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Alguns dias' },
      { value: 2, label: 'Mais da metade dos dias' },
      { value: 3, label: 'Quase todos os dias' }
    ],
    metadata: { validatedTool: 'GAD-7', clinicalCode: 'R45.1' }
  },
  {
    id: 'gad7_6',
    text: 'Nas últimas 2 semanas, com que frequência você ficou facilmente irritado ou chateado?',
    type: 'select',
    category: 'mental_health',
    required: true,
    riskWeight: 2,
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Alguns dias' },
      { value: 2, label: 'Mais da metade dos dias' },
      { value: 3, label: 'Quase todos os dias' }
    ],
    metadata: { validatedTool: 'GAD-7', clinicalCode: 'R45.4' }
  },
  {
    id: 'gad7_7',
    text: 'Nas últimas 2 semanas, com que frequência você sentiu medo como se algo terrível fosse acontecer?',
    type: 'select',
    category: 'mental_health',
    required: true,
    riskWeight: 4,
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Alguns dias' },
      { value: 2, label: 'Mais da metade dos dias' },
      { value: 3, label: 'Quase todos os dias' }
    ],
    metadata: { validatedTool: 'GAD-7', clinicalCode: 'F41.9' }
  }
];

// AUDIT-C (Alcohol Use Disorders Identification Test - Consumption)
export const AUDIT_C_QUESTIONS: HealthQuestion[] = [
  {
    id: 'audit_c_1',
    text: 'Com que frequência você toma bebidas alcoólicas?',
    type: 'select',
    category: 'screening',
    required: true,
    riskWeight: 3,
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Mensalmente ou menos' },
      { value: 2, label: '2-4 vezes por mês' },
      { value: 3, label: '2-3 vezes por semana' },
      { value: 4, label: '4 ou mais vezes por semana' }
    ],
    metadata: { validatedTool: 'AUDIT-C', clinicalCode: 'F10.10' }
  },
  {
    id: 'audit_c_2',
    text: 'Quantas doses de álcool você toma em um dia típico quando está bebendo?',
    type: 'select',
    category: 'screening',
    required: true,
    riskWeight: 3,
    conditionalOn: {
      questionId: 'audit_c_1',
      values: [1, 2, 3, 4]
    },
    options: [
      { value: 0, label: '1 ou 2' },
      { value: 1, label: '3 ou 4' },
      { value: 2, label: '5 ou 6' },
      { value: 3, label: '7-9' },
      { value: 4, label: '10 ou mais' }
    ],
    metadata: { validatedTool: 'AUDIT-C', clinicalCode: 'F10.10' }
  },
  {
    id: 'audit_c_3',
    text: 'Com que frequência você toma 6 ou mais doses de bebida em uma ocasião?',
    type: 'select',
    category: 'screening',
    required: true,
    riskWeight: 4,
    conditionalOn: {
      questionId: 'audit_c_1',
      values: [1, 2, 3, 4]
    },
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Menos que mensalmente' },
      { value: 2, label: 'Mensalmente' },
      { value: 3, label: 'Semanalmente' },
      { value: 4, label: 'Diariamente ou quase' }
    ],
    metadata: { validatedTool: 'AUDIT-C', clinicalCode: 'F10.10' }
  }
];

// NIDA Quick Screen (Modified for Substance Use)
export const NIDA_QUESTIONS: HealthQuestion[] = [
  {
    id: 'nida_1',
    text: 'No último ano, você usou alguma dessas substâncias mais do que pretendia?',
    type: 'select',
    category: 'screening',
    required: true,
    riskWeight: 4,
    options: [
      { value: 'no', label: 'Não' },
      { value: 'yes_alcohol', label: 'Sim - Álcool' },
      { value: 'yes_tobacco', label: 'Sim - Tabaco/Nicotina' },
      { value: 'yes_prescription', label: 'Sim - Medicamentos controlados' },
      { value: 'yes_illegal', label: 'Sim - Drogas ilícitas' }
    ],
    metadata: { validatedTool: 'NIDA-Modified', clinicalCode: 'F19', sensitiveInfo: true }
  },
  {
    id: 'nida_2',
    text: 'Nos últimos 12 meses, você usou alguma dessas substâncias?',
    type: 'multiselect',
    category: 'screening',
    required: true,
    riskWeight: 4,
    conditionalOn: {
      questionId: 'nida_1',
      values: ['yes_alcohol', 'yes_tobacco', 'yes_prescription', 'yes_illegal']
    },
    options: [
      { value: 'none', label: 'Nenhuma das listadas' },
      { value: 'tobacco', label: 'Tabaco/Cigarro' },
      { value: 'cannabis', label: 'Maconha/Cannabis' },
      { value: 'cocaine', label: 'Cocaína' },
      { value: 'stimulants', label: 'Estimulantes (anfetaminas)' },
      { value: 'sedatives', label: 'Sedativos (sem prescrição)' },
      { value: 'hallucinogens', label: 'Alucinógenos' },
      { value: 'opioids', label: 'Opioides (sem prescrição)' },
      { value: 'inhalants', label: 'Inalantes' }
    ],
    metadata: { validatedTool: 'ASSIST', clinicalCode: 'F19', sensitiveInfo: true }
  }
];

// Comprehensive Allergy Screening
export const ALLERGY_SCREENING_QUESTIONS: HealthQuestion[] = [
  {
    id: 'has_allergies',
    text: 'Você tem alguma alergia conhecida?',
    type: 'boolean',
    category: 'medical_history',
    required: true,
    riskWeight: 2,
    metadata: { clinicalCode: 'Z88' }
  },
  {
    id: 'medication_allergies',
    text: 'Selecione todas as alergias a medicamentos que você tem:',
    type: 'allergy_list',
    category: 'medical_history',
    required: true,
    riskWeight: 3,
    conditionalOn: {
      questionId: 'has_allergies',
      values: [true]
    },
    options: [
      { value: 'penicillin', label: 'Penicilina' },
      { value: 'aspirin', label: 'Aspirina' },
      { value: 'ibuprofen', label: 'Ibuprofeno' },
      { value: 'sulfa', label: 'Sulfa' },
      { value: 'contrast_dye', label: 'Contraste radiológico' },
      { value: 'anesthesia', label: 'Anestesia' },
      { value: 'codeine', label: 'Codeína' },
      { value: 'antibiotics_other', label: 'Outros antibióticos' },
      { value: 'none', label: 'Nenhuma alergia a medicamentos' },
      { value: 'other', label: 'Outra (especificar)' }
    ],
    metadata: { clinicalCode: 'Z88.0' }
  },
  {
    id: 'medication_allergy_reactions',
    text: 'Que tipo de reação você teve aos medicamentos?',
    type: 'multiselect',
    category: 'medical_history',
    required: true,
    riskWeight: 3,
    conditionalOn: {
      questionId: 'medication_allergies',
      values: ['penicillin', 'aspirin', 'ibuprofen', 'sulfa', 'contrast_dye', 'anesthesia', 'codeine', 'antibiotics_other', 'other']
    },
    options: [
      { value: 'rash', label: 'Erupção cutânea/Urticária' },
      { value: 'breathing_difficulty', label: 'Dificuldade para respirar' },
      { value: 'swelling', label: 'Inchaço (face, lábios, língua)' },
      { value: 'nausea', label: 'Náusea/Vômito' },
      { value: 'diarrhea', label: 'Diarreia' },
      { value: 'anaphylaxis', label: 'Anafilaxia (reação grave)' },
      { value: 'other', label: 'Outra reação' }
    ],
    metadata: { clinicalCode: 'T88.6' }
  },
  {
    id: 'food_allergies',
    text: 'Você tem alergias alimentares?',
    type: 'allergy_list',
    category: 'medical_history',
    required: true,
    riskWeight: 2,
    conditionalOn: {
      questionId: 'has_allergies',
      values: [true]
    },
    options: [
      { value: 'peanuts', label: 'Amendoim' },
      { value: 'tree_nuts', label: 'Castanhas/Nozes' },
      { value: 'shellfish', label: 'Frutos do mar/Crustáceos' },
      { value: 'fish', label: 'Peixes' },
      { value: 'eggs', label: 'Ovos' },
      { value: 'milk', label: 'Leite/Laticínios' },
      { value: 'soy', label: 'Soja' },
      { value: 'wheat', label: 'Trigo/Glúten' },
      { value: 'none', label: 'Nenhuma alergia alimentar' },
      { value: 'other', label: 'Outra (especificar)' }
    ],
    metadata: { clinicalCode: 'Z91.010' }
  },
  {
    id: 'environmental_allergies',
    text: 'Você tem alergias ambientais?',
    type: 'allergy_list',
    category: 'medical_history',
    required: true,
    riskWeight: 1,
    conditionalOn: {
      questionId: 'has_allergies',
      values: [true]
    },
    options: [
      { value: 'pollen', label: 'Pólen' },
      { value: 'dust_mites', label: 'Ácaros' },
      { value: 'pet_dander', label: 'Pelos de animais' },
      { value: 'mold', label: 'Mofo/Fungos' },
      { value: 'latex', label: 'Látex' },
      { value: 'insects', label: 'Picadas de insetos' },
      { value: 'perfumes', label: 'Perfumes/Químicos' },
      { value: 'none', label: 'Nenhuma alergia ambiental' },
      { value: 'other', label: 'Outra (especificar)' }
    ],
    metadata: { clinicalCode: 'J30.9' }
  },
  {
    id: 'allergy_severity',
    text: 'Em geral, como você classificaria a gravidade das suas alergias?',
    type: 'select',
    category: 'medical_history',
    required: true,
    riskWeight: 3,
    conditionalOn: {
      questionId: 'has_allergies',
      values: [true]
    },
    options: [
      { value: 'mild', label: 'Leve (sintomas menores, controláveis)' },
      { value: 'moderate', label: 'Moderada (requer medicação regularmente)' },
      { value: 'severe', label: 'Grave (interfere nas atividades diárias)' },
      { value: 'life_threatening', label: 'Risco de vida (anafilaxia/emergência)' }
    ],
    metadata: { clinicalCode: 'T78.4' }
  },
  {
    id: 'carries_epinephrine',
    text: 'Você carrega um auto-injetor de epinefrina (EpiPen)?',
    type: 'boolean',
    category: 'medical_history',
    required: true,
    riskWeight: 4,
    conditionalOn: {
      questionId: 'allergy_severity',
      values: ['severe', 'life_threatening']
    },
    metadata: { clinicalCode: 'Z88.1' }
  }
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
        id: 'chronic_conditions_structured',
        text: 'Condições Crônicas de Saúde - Seleção Estruturada',
        type: 'chronic_conditions',
        category: 'medical_history',
        required: true,
        riskWeight: 5,
        metadata: {
          clinicalCode: 'Z87.891'
        }
      },
      {
        id: 'medications_current',
        text: 'Medicamentos Atuais - Seleção Estruturada',
        type: 'medication_list',
        category: 'medical_history',
        required: true,
        riskWeight: 3,
        validation: { 
          crossCheck: ['medication_allergies', 'chronic_conditions']
        },
        metadata: {
          clinicalCode: 'Z88.3'
        }
      },
      {
        id: 'surgeries',
        text: 'Histórico de Cirurgias - Seleção Estruturada',
        type: 'surgery_history',
        category: 'medical_history',
        required: true,
        riskWeight: 2,
        validationPair: 'hospitalization_history',
        metadata: {
          clinicalCode: 'Z98.89'
        }
      },
      {
        id: 'emergency_contact',
        text: 'Contato de Emergência - Informações Estruturadas',
        type: 'emergency_contact',
        category: 'medical_history',
        required: true,
        riskWeight: 1,
        metadata: {
          clinicalCode: 'Z76.2'
        }
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
    id: 'crisis_intervention',
    title: 'Avaliação de Segurança',
    description: 'Protocolo de segurança e bem-estar',
    estimatedMinutes: 3,
    priority: 'critical',
    questions: [
      {
        id: 'safety_check',
        text: 'Você está se sentindo seguro neste momento?',
        type: 'boolean',
        category: 'screening',
        required: true,
        riskWeight: 10,
        metadata: { sensitiveInfo: true, clinicalCode: 'Z91.5' }
      },
      {
        id: 'suicidal_ideation_screen',
        text: 'Nos últimos 2 meses, você teve pensamentos de se machucar?',
        type: 'select',
        category: 'screening',
        required: true,
        riskWeight: 10,
        options: [
          { value: 'never', label: 'Nunca' },
          { value: 'passive', label: 'Pensamentos passivos (seria melhor estar morto)' },
          { value: 'active_no_plan', label: 'Pensamentos ativos sem plano específico' },
          { value: 'active_with_plan', label: 'Pensamentos com plano específico' },
          { value: 'recent_attempt', label: 'Tentativa recente' }
        ],
        metadata: { sensitiveInfo: true, clinicalCode: 'R45.851' }
      },
      {
        id: 'suicide_plan_details',
        text: 'Você tem um plano específico para se machucar?',
        type: 'boolean',
        category: 'screening',
        required: true,
        riskWeight: 10,
        conditionalOn: {
          questionId: 'suicidal_ideation_screen',
          values: ['active_with_plan', 'recent_attempt']
        },
        metadata: { sensitiveInfo: true, clinicalCode: 'R45.851' }
      },
      {
        id: 'suicide_means_access',
        text: 'Você tem acesso aos meios para executar esse plano?',
        type: 'boolean',
        category: 'screening',
        required: true,
        riskWeight: 10,
        conditionalOn: {
          questionId: 'suicide_plan_details',
          values: [true]
        },
        metadata: { sensitiveInfo: true }
      },
      {
        id: 'protective_factors',
        text: 'O que tem impedido você de agir sobre esses pensamentos?',
        type: 'multiselect',
        category: 'screening',
        required: true,
        riskWeight: -2,
        conditionalOn: {
          questionId: 'suicidal_ideation_screen',
          values: ['passive', 'active_no_plan', 'active_with_plan']
        },
        options: [
          { value: 'family', label: 'Família/Amigos' },
          { value: 'children', label: 'Filhos' },
          { value: 'pets', label: 'Animais de estimação' },
          { value: 'religion', label: 'Crenças religiosas/espirituais' },
          { value: 'hope', label: 'Esperança de melhora' },
          { value: 'fear', label: 'Medo da dor' },
          { value: 'none', label: 'Nada específico' }
        ]
      },
      {
        id: 'support_system',
        text: 'Há alguém com você ou que você possa contatar agora se precisar de ajuda?',
        type: 'boolean',
        category: 'screening',
        required: true,
        riskWeight: -3,
        conditionalOn: {
          questionId: 'suicidal_ideation_screen',
          values: ['passive', 'active_no_plan', 'active_with_plan', 'recent_attempt']
        }
      },
      {
        id: 'previous_attempts',
        text: 'Você já tentou se machucar antes?',
        type: 'boolean',
        category: 'screening',
        required: true,
        riskWeight: 8,
        conditionalOn: {
          questionId: 'suicidal_ideation_screen',
          values: ['passive', 'active_no_plan', 'active_with_plan']
        },
        metadata: { sensitiveInfo: true, clinicalCode: 'Z91.5' }
      },
      {
        id: 'violence_safety',
        text: 'Você já se sentiu ameaçado ou machucado por alguém próximo a você?',
        type: 'select',
        category: 'screening',
        required: true,
        riskWeight: 5,
        options: [
          { value: 'never', label: 'Nunca' },
          { value: 'past', label: 'No passado, mas não atualmente' },
          { value: 'current', label: 'Sim, atualmente' }
        ],
        metadata: { sensitiveInfo: true, clinicalCode: 'Z91.410' }
      },
      {
        id: 'safety_plan_willingness',
        text: 'Você está disposto a criar um plano de segurança conosco agora?',
        type: 'boolean',
        category: 'screening',
        required: true,
        riskWeight: -3,
        conditionalOn: {
          questionId: 'suicidal_ideation_screen',
          values: ['passive', 'active_no_plan', 'active_with_plan', 'recent_attempt']
        },
        metadata: { clinicalCode: 'Z73.6' }
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
    id: 'substance_screening',
    title: 'Avaliação de Uso de Substâncias',
    description: 'Triagem clínica para álcool e outras substâncias (AUDIT-C e NIDA)',
    estimatedMinutes: 4,
    priority: 'high',
    questions: [
      // Complete AUDIT-C alcohol screening
      ...AUDIT_C_QUESTIONS,
      // Complete NIDA substance use screening  
      ...NIDA_QUESTIONS,
      // Additional lifestyle risk factors
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
    id: 'allergy_assessment',
    title: 'Avaliação de Alergias e Segurança',
    description: 'Triagem abrangente de alergias para sua segurança médica',
    estimatedMinutes: 3,
    priority: 'high',
    questions: [
      // Complete comprehensive allergy screening
      ...ALLERGY_SCREENING_QUESTIONS
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
    allergy_risk: number;
    safety_risk: number;
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
      chronic_disease: 0,
      allergy_risk: 0,
      safety_risk: 0
    },
    flags: [],
    recommendations: []
  };

  // Enhanced PHQ-9 scoring with clinical cutoffs
  const phq9Score = PHQ9_QUESTIONS.reduce((sum, q) => sum + (responses[q.id] || 0), 0);
  
  if (phq9Score >= 20) {
    score.categories.mental_health += 30;
    score.flags.push('severe_depression');
    score.recommendations.push('Encaminhamento urgente para psiquiatra - depressão severa');
  } else if (phq9Score >= 15) {
    score.categories.mental_health += 25;
    score.flags.push('moderately_severe_depression');
    score.recommendations.push('Encaminhamento para profissional de saúde mental - depressão moderadamente severa');
  } else if (phq9Score >= 10) {
    score.categories.mental_health += 20;
    score.flags.push('moderate_depression');
    score.recommendations.push('Avaliação de saúde mental recomendada - depressão moderada');
  } else if (phq9Score >= 5) {
    score.categories.mental_health += 10;
    score.flags.push('mild_depression');
    score.recommendations.push('Monitoramento de sintomas depressivos leves');
  }
  
  // Critical PHQ-9 question 9 (suicidal ideation)
  if (responses.phq9_9 !== undefined && 
      responses.phq9_9 !== null && 
      typeof responses.phq9_9 === 'number' && 
      responses.phq9_9 > 0) {
    score.categories.safety_risk += 50;
    score.flags.push('suicide_risk');
    score.recommendations.push('EMERGÊNCIA: Encaminhamento imediato para profissional de saúde mental');
  }

  // Enhanced GAD-7 scoring with clinical cutoffs
  const gad7Score = GAD7_QUESTIONS.reduce((sum, q) => sum + (responses[q.id] || 0), 0);
  
  if (gad7Score >= 15) {
    score.categories.mental_health += 25;
    score.flags.push('severe_anxiety');
    score.recommendations.push('Encaminhamento urgente para avaliação de transtorno de ansiedade severo');
  } else if (gad7Score >= 10) {
    score.categories.mental_health += 20;
    score.flags.push('moderate_anxiety');
    score.recommendations.push('Avaliação para transtorno de ansiedade moderado');
  } else if (gad7Score >= 5) {
    score.categories.mental_health += 10;
    score.flags.push('mild_anxiety');
    score.recommendations.push('Monitoramento de sintomas de ansiedade leves');
  }

  // AUDIT-C alcohol screening with clinical cutoffs
  const auditScore = (responses.audit_c_1 || 0) + (responses.audit_c_2 || 0) + (responses.audit_c_3 || 0);
  if (auditScore >= 8) {
    score.categories.substance_abuse += 30;
    score.flags.push('high_risk_alcohol_use');
    score.recommendations.push('Encaminhamento para avaliação de transtorno por uso de álcool');
  } else if (auditScore >= 4) {
    score.categories.substance_abuse += 20;
    score.flags.push('moderate_risk_alcohol_use');
    score.recommendations.push('Intervenção breve para uso de álcool recomendada');
  } else if (auditScore >= 3) {
    score.categories.substance_abuse += 10;
    score.flags.push('mild_risk_alcohol_use');
    score.recommendations.push('Educação sobre uso seguro de álcool');
  }

  // NIDA substance use screening
  if (responses.nida_1 && responses.nida_1 !== 'no') {
    score.categories.substance_abuse += 25;
    score.flags.push('substance_use_concern');
    score.recommendations.push('Avaliação completa de uso de substâncias recomendada');
    
    if (responses.nida_1 === 'yes_illegal') {
      score.categories.substance_abuse += 15;
      score.flags.push('illegal_drug_use');
    }
    
    if (responses.nida_2 && responses.nida_2.includes('cocaine')) {
      score.categories.substance_abuse += 20;
      score.flags.push('high_risk_drug_use');
    }
  }

  // Allergy risk assessment
  if (responses.allergy_severity === 'life_threatening') {
    score.categories.allergy_risk += 40;
    score.flags.push('life_threatening_allergies');
    score.recommendations.push('Protocolo de emergência para anafilaxia deve estar disponível');
    
    if (responses.carries_epinephrine !== true) {
      score.categories.allergy_risk += 20;
      score.flags.push('missing_epinephrine');
      score.recommendations.push('Prescrição de auto-injetor de epinefrina urgente');
    }
  } else if (responses.allergy_severity === 'severe') {
    score.categories.allergy_risk += 25;
    score.flags.push('severe_allergies');
    score.recommendations.push('Avaliação alergológica especializada recomendada');
  }

  // Crisis intervention and safety assessment
  if (responses.suicidal_ideation_screen && responses.suicidal_ideation_screen !== 'never') {
    if (responses.suicidal_ideation_screen === 'recent_attempt') {
      score.categories.safety_risk += 60;
      score.flags.push('recent_suicide_attempt');
      score.recommendations.push('EMERGÊNCIA: Avaliação psiquiátrica imediata obrigatória');
    } else if (responses.suicidal_ideation_screen === 'active_with_plan') {
      score.categories.safety_risk += 50;
      score.flags.push('active_suicidal_ideation_with_plan');
      score.recommendations.push('EMERGÊNCIA: Intervenção de crise imediata');
    } else if (responses.suicidal_ideation_screen === 'active_no_plan') {
      score.categories.safety_risk += 35;
      score.flags.push('active_suicidal_ideation');
      score.recommendations.push('Avaliação de risco suicida urgente');
    } else if (responses.suicidal_ideation_screen === 'passive') {
      score.categories.safety_risk += 20;
      score.flags.push('passive_suicidal_ideation');
      score.recommendations.push('Acompanhamento de saúde mental prioritário');
    }
  }

  if (responses.violence_safety === 'current') {
    score.categories.safety_risk += 30;
    score.flags.push('current_violence_exposure');
    score.recommendations.push('Protocolo de segurança para violência doméstica');
  }

  // Enhanced cardiovascular risk factors
  const cvRiskFactors = [
    responses.chronic_conditions?.includes('hypertension'),
    responses.chronic_conditions?.includes('diabetes'),
    responses.chronic_conditions?.includes('heart_disease'),
    responses.smoking_status === 'current',
    responses.bmi > 30,
    responses.exercise_frequency < 3,
    responses.family_conditions?.includes('heart_disease'),
    responses.audit_c_1 >= 3, // Heavy alcohol use
    responses.age > 65
  ].filter(Boolean).length;

  score.categories.cardiovascular = cvRiskFactors * 12;

  // Enhanced chronic disease risk
  if (responses.chronic_conditions?.length > 3) {
    score.categories.chronic_disease += 25;
    score.flags.push('multiple_chronic_conditions');
  } else if (responses.chronic_conditions?.length > 1) {
    score.categories.chronic_disease += 15;
    score.flags.push('comorbid_conditions');
  }

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
  
  // Updated total question count to include all new clinical assessments
  const expectedQuestions = 80; // Updated for PHQ-9, GAD-7, AUDIT-C, NIDA, allergy screening, crisis intervention
  const completionRate = Object.keys(responses).length / expectedQuestions;
  if (completionRate > 0.9) {
    badges.push('thorough_responder');
    baseScore += 5;
  }
  
  // Mental Health badges - Complete PHQ-9 and GAD-7 assessments
  const phq9Completed = PHQ9_QUESTIONS.every(q => responses[q.id] !== undefined);
  const gad7Completed = GAD7_QUESTIONS.every(q => responses[q.id] !== undefined);
  if (phq9Completed && gad7Completed) {
    badges.push('mental_wellness_champion');
    baseScore += 15;
    
    // Additional badge for completing mental health screening with low risk
    const phq9Score = PHQ9_QUESTIONS.reduce((sum, q) => sum + (responses[q.id] || 0), 0);
    const gad7Score = GAD7_QUESTIONS.reduce((sum, q) => sum + (responses[q.id] || 0), 0);
    if (phq9Score < 5 && gad7Score < 5) {
      badges.push('mental_health_resilient');
      baseScore += 10;
    }
  }
  
  // Substance screening badges - Complete AUDIT-C and NIDA assessments
  const auditCompleted = AUDIT_C_QUESTIONS.every(q => responses[q.id] !== undefined);
  const nidaCompleted = NIDA_QUESTIONS.every(q => responses[q.id] !== undefined);
  if (auditCompleted && nidaCompleted) {
    badges.push('substance_awareness_advocate');
    baseScore += 10;
    
    // Low-risk substance use badge
    if (responses.audit_c_1 === 0 && responses.nida_1 === 'no') {
      badges.push('substance_free_lifestyle');
      baseScore += 15;
    }
  }
  
  // Allergy safety badges - Complete comprehensive allergy screening
  const allergyCompleted = ALLERGY_SCREENING_QUESTIONS.every(q => 
    responses[q.id] !== undefined || 
    (q.conditionalOn && !q.conditionalOn.values.includes(responses[q.conditionalOn.questionId]))
  );
  if (allergyCompleted) {
    badges.push('allergy_safety_expert');
    baseScore += 8;
    
    // Carries EpiPen badge for severe allergies
    if (responses.carries_epinephrine === true) {
      badges.push('emergency_prepared');
      baseScore += 12;
    }
  }
  
  // Crisis intervention and safety badges
  if (responses.safety_check === true && responses.suicidal_ideation_screen === 'never') {
    badges.push('safety_first_champion');
    baseScore += 20;
  }
  
  if (responses.safety_plan_willingness === true) {
    badges.push('proactive_safety_planner');
    baseScore += 10;
  }
  
  // Health lifestyle achievements (existing)
  if (responses.exercise_frequency >= 5) badges.push('fitness_enthusiast');
  if (responses.sleep_hours >= 7 && responses.sleep_hours <= 9) badges.push('sleep_champion');
  if (!responses.smoking_status || responses.smoking_status === 'never') badges.push('smoke_free');
  
  // Clinical excellence badges - completion of all major sections
  const majorSectionsCompleted = [
    phq9Completed && gad7Completed,
    auditCompleted && nidaCompleted,
    allergyCompleted,
    responses.safety_check !== undefined
  ].filter(Boolean).length;
  
  if (majorSectionsCompleted >= 3) {
    badges.push('clinical_excellence');
    baseScore += 25;
  }
  
  if (majorSectionsCompleted === 4) {
    badges.push('comprehensive_health_advocate');
    baseScore += 30;
  }
  
  // Determine level with updated thresholds
  let level: 'bronze' | 'silver' | 'gold' | 'platinum' = 'bronze';
  if (baseScore >= 95) level = 'platinum';
  else if (baseScore >= 85) level = 'gold';
  else if (baseScore >= 75) level = 'silver';
  
  return {
    healthScore: Math.max(0, Math.min(100, baseScore)),
    badges,
    streaks: {
      honesty: fraudIndicators.recommendation === 'accept' ? 1 : 0,
      completion: Math.floor(completionRate * 10)
    },
    level,
    nextRewards: [
      'Complete all clinical assessments for "Clinical Excellence" badge',
      'Maintain safety protocols for "Safety Champion" badge',
      'Complete substance screening for "Substance Awareness" badge'
    ]
  };
}