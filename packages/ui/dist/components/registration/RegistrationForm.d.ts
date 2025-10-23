/**
 * Registration Form Component
 * Sprint 2C - Registration Pages
 *
 * Pure presentation component - NO orchestration logic
 * ADR-003 Compliance: Components only render, pages orchestrate
 */
export interface RegistrationFormData {
    email: string;
    password: string;
    confirmPassword: string;
    cpf: string;
    phone: string;
    lgpdConsent: boolean;
}
export interface RegistrationFormProps {
    onSubmit: (data: RegistrationFormData) => void;
    isLoading?: boolean;
    error?: string | null;
    utmParams?: {
        source?: string;
        medium?: string;
        campaign?: string;
    };
}
/**
 * Registration form presentation component
 * Receives data via props, emits events via callbacks
 */
export declare function RegistrationForm({ onSubmit, isLoading, error, utmParams }: RegistrationFormProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=RegistrationForm.d.ts.map