/**
 * Questionnaire Branching Logic
 *
 * Implements conditional question display based on previous answers
 * Supports PHQ-9, GAD-7, and other validated screening tools
 */

export interface Question {
  id: string;
  text: string;
  type: 'single_choice' | 'multiple_choice' | 'text' | 'scale';
  options?: Array<{ value: string | number; label: string }>;
  required: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface BranchingRule {
  id: string;
  condition: (answers: Record<string, any>) => boolean;
  questions: Question[];
  description: string;
}

/**
 * Evaluate branching logic to determine visible questions
 *
 * Examples:
 * - If PHQ-9 Q9 (suicidal ideation) > 0, add safety planning questions
 * - If GAD-7 total ≥ 10, add panic disorder screening
 * - If substance use indicated, add AUDIT-C questions
 */
export function evaluateBranchingLogic(
  rules: BranchingRule[] | undefined,
  answers: Record<string, any>
): Question[] {
  if (!rules || rules.length === 0) {
    return [];
  }

  const visibleQuestions: Question[] = [];
  const addedQuestionIds = new Set<string>();

  for (const rule of rules) {
    try {
      // Evaluate rule condition
      if (rule.condition(answers)) {
        // Add questions that haven't been added yet
        for (const question of rule.questions) {
          if (!addedQuestionIds.has(question.id)) {
            visibleQuestions.push(question);
            addedQuestionIds.add(question.id);
          }
        }
      }
    } catch (error) {
      console.error(`Error evaluating branching rule ${rule.id}:`, error);
      // Continue with other rules even if one fails
    }
  }

  return visibleQuestions;
}

/**
 * Check if a specific question should be shown
 */
export function shouldShowQuestion(
  questionId: string,
  visibleQuestions: Question[]
): boolean {
  return visibleQuestions.some(q => q.id === questionId);
}

/**
 * Calculate PHQ-9 total score
 */
export function calculatePHQ9Score(answers: Record<string, any>): number {
  const phq9Questions = [
    'phq9_q1', 'phq9_q2', 'phq9_q3', 'phq9_q4', 'phq9_q5',
    'phq9_q6', 'phq9_q7', 'phq9_q8', 'phq9_q9'
  ];

  return phq9Questions.reduce((total, questionId) => {
    const value = answers[questionId];
    return total + (typeof value === 'number' ? value : 0);
  }, 0);
}

/**
 * Calculate GAD-7 total score
 */
export function calculateGAD7Score(answers: Record<string, any>): number {
  const gad7Questions = [
    'gad7_q1', 'gad7_q2', 'gad7_q3', 'gad7_q4',
    'gad7_q5', 'gad7_q6', 'gad7_q7'
  ];

  return gad7Questions.reduce((total, questionId) => {
    const value = answers[questionId];
    return total + (typeof value === 'number' ? value : 0);
  }, 0);
}

/**
 * Determine risk band based on scores
 */
export function determineRiskBand(phq9Score: number, gad7Score: number): string {
  // PHQ-9 severity: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-19 moderately severe, 20-27 severe
  // GAD-7 severity: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-21 severe

  const maxScore = Math.max(phq9Score, gad7Score);

  if (maxScore >= 15) return 'high';
  if (maxScore >= 10) return 'moderate';
  if (maxScore >= 5) return 'low';
  return 'minimal';
}

/**
 * Example branching rules for PHQ-9 and GAD-7
 */
export const defaultBranchingRules: BranchingRule[] = [
  {
    id: 'phq9_safety_planning',
    description: 'Add safety planning questions if suicidal ideation present',
    condition: (answers) => {
      const q9Value = answers['phq9_q9'];
      return typeof q9Value === 'number' && q9Value > 0;
    },
    questions: [
      {
        id: 'safety_plan_contact',
        text: 'Do you have someone you can contact in a crisis?',
        type: 'single_choice',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
        required: true,
      },
      {
        id: 'safety_plan_activities',
        text: 'What activities help you feel better when distressed?',
        type: 'text',
        required: false,
      },
    ],
  },
  {
    id: 'gad7_panic_screening',
    description: 'Add panic disorder screening if moderate/severe anxiety',
    condition: (answers) => {
      const gad7Score = calculateGAD7Score(answers);
      return gad7Score >= 10;
    },
    questions: [
      {
        id: 'panic_episodes',
        text: 'Have you experienced sudden episodes of intense fear or panic?',
        type: 'single_choice',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
        required: true,
      },
    ],
  },
];
