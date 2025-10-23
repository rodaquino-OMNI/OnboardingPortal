/**
 * RadioGroup - Accessible radio button group
 * ADR-003: Presentation-only radio group with ARIA support
 */
interface RadioOption {
    value: string;
    label: string;
}
interface RadioGroupProps {
    name: string;
    value: string;
    onChange: (value: string) => void;
    options: RadioOption[];
    'aria-label'?: string;
    'aria-invalid'?: boolean;
    required?: boolean;
    className?: string;
}
export declare function RadioGroup({ name, value, onChange, options, 'aria-label': ariaLabel, 'aria-invalid': ariaInvalid, required, className, }: RadioGroupProps): import("react/jsx-runtime").JSX.Element;
export declare namespace RadioGroup {
    var displayName: string;
}
export {};
//# sourceMappingURL=RadioGroup.d.ts.map