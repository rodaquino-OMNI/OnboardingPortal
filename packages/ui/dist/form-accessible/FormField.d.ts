/**
 * FormField - Accessible form field wrapper
 * ADR-003: Presentation-only wrapper with ARIA support
 */
import React from 'react';
interface FormFieldProps {
    children: React.ReactNode;
    label: string;
    required?: boolean;
    error?: string;
    helpText?: string;
    fieldId: string;
}
export declare function FormField({ children, label, required, error, helpText, fieldId, }: FormFieldProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=FormField.d.ts.map