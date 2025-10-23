/**
 * Checkbox - Accessible checkbox component
 * ADR-003: Presentation-only checkbox with ARIA support
 */
import React from 'react';
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    error?: boolean;
    label?: string;
}
export declare const Checkbox: React.ForwardRefExoticComponent<CheckboxProps & React.RefAttributes<HTMLInputElement>>;
export {};
//# sourceMappingURL=Checkbox.d.ts.map