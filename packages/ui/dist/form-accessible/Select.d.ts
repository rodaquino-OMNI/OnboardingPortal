/**
 * Select - Accessible dropdown component
 * ADR-003: Presentation-only select with ARIA support
 */
import React from 'react';
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    error?: boolean;
}
export declare const Select: React.ForwardRefExoticComponent<SelectProps & React.RefAttributes<HTMLSelectElement>>;
export {};
//# sourceMappingURL=Select.d.ts.map