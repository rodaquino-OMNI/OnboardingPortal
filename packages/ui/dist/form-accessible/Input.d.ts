/**
 * Input - Accessible text input component
 * ADR-003: Presentation-only input with ARIA support
 */
import React from 'react';
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: boolean;
}
export declare const Input: React.ForwardRefExoticComponent<InputProps & React.RefAttributes<HTMLInputElement>>;
export {};
//# sourceMappingURL=Input.d.ts.map