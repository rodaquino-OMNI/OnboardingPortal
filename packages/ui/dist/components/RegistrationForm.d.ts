/**
 * RegistrationForm - Pure presentation component
 *
 * ADR-003 Compliance:
 * ✅ NO network calls (fetch/axios)
 * ✅ NO storage (localStorage/sessionStorage/IndexedDB)
 * ✅ NO orchestration logic
 * ✅ ALL data via props
 * ✅ ALL interactions via callbacks
 *
 * @see docs/ARCHITECTURE_DECISIONS.md - ADR-003: Component Boundaries
 */
import React from 'react';
export interface RegisterData {
    email: string;
    password: string;
    confirmPassword: string;
    termsAccepted: boolean;
}
export interface ValidationErrors {
    email?: string;
    password?: string;
    confirmPassword?: string;
    termsAccepted?: string;
}
export interface RegistrationFormProps {
    /** Parent-controlled submit handler (orchestration layer) */
    onSubmit: (data: RegisterData) => void;
    /** Loading state from parent (e.g., during API call) */
    isLoading?: boolean;
    /** Server-side validation errors from parent */
    errors?: ValidationErrors;
    /** Optional className for styling */
    className?: string;
}
export declare const RegistrationForm: React.FC<RegistrationFormProps>;
export default RegistrationForm;
//# sourceMappingURL=RegistrationForm.d.ts.map