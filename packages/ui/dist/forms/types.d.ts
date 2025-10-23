/**
 * Type definitions for health questionnaire form components
 * ADR-003: Presentation-only types with no business logic
 */
export interface Question {
    id: string;
    type: 'text' | 'number' | 'select' | 'radio' | 'checkbox' | 'textarea' | 'scale';
    label: string;
    required: boolean;
    options?: Array<{
        value: string;
        label: string;
    }>;
    validation?: {
        min?: number;
        max?: number;
        pattern?: string;
    };
    helpText?: string;
    ariaLabel?: string;
}
export interface DynamicFormRendererProps {
    questions: Question[];
    values: Record<string, any>;
    errors: Record<string, string>;
    onChange: (questionId: string, value: any) => void;
    onBlur?: (questionId: string) => void;
}
export interface QuestionnaireProgressProps {
    currentStep: number;
    totalSteps: number;
    completionPercentage: number;
    stepLabels?: string[];
}
export interface ErrorSummaryProps {
    errors: Record<string, string>;
    onErrorClick?: (fieldId: string) => void;
}
export interface SectionHeaderProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;
}
//# sourceMappingURL=types.d.ts.map