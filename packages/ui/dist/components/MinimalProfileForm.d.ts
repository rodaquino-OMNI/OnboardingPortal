/**
 * MinimalProfileForm - Pure presentation component
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
export interface ProfileData {
    name: string;
    cpf: string;
    birthdate: string;
    phone: string;
    address: string;
    email: string;
}
export interface ValidationErrors {
    name?: string;
    cpf?: string;
    birthdate?: string;
    phone?: string;
    address?: string;
}
export interface MinimalProfileFormProps {
    /** Parent-controlled submit handler (orchestration layer) */
    onSubmit: (data: ProfileData) => void;
    /** Loading state from parent (e.g., during API call) */
    isLoading?: boolean;
    /** Server-side validation errors from parent */
    errors?: ValidationErrors;
    /** Pre-filled email (from registration step) */
    initialEmail: string;
    /** Optional className for styling */
    className?: string;
}
export declare const MinimalProfileForm: React.FC<MinimalProfileFormProps>;
export default MinimalProfileForm;
//# sourceMappingURL=MinimalProfileForm.d.ts.map