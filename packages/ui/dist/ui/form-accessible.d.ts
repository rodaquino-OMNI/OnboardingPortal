import * as React from 'react';
interface FormFieldProps {
    label: string;
    htmlFor: string;
    required?: boolean;
    children: React.ReactNode;
    error?: string;
    description?: string;
    success?: boolean;
}
export declare function FormField({ label, htmlFor, required, children, error, description, success }: FormFieldProps): import("react/jsx-runtime").JSX.Element;
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: boolean;
}
export declare const Input: React.ForwardRefExoticComponent<InputProps & React.RefAttributes<HTMLInputElement>>;
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    error?: boolean;
}
export declare const Textarea: React.ForwardRefExoticComponent<TextareaProps & React.RefAttributes<HTMLTextAreaElement>>;
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    error?: boolean;
    options: Array<{
        value: string;
        label: string;
    }>;
    placeholder?: string;
}
export declare const Select: React.ForwardRefExoticComponent<SelectProps & React.RefAttributes<HTMLSelectElement>>;
interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: boolean;
}
export declare const Checkbox: React.ForwardRefExoticComponent<CheckboxProps & React.RefAttributes<HTMLInputElement>>;
interface RadioGroupProps {
    name: string;
    options: Array<{
        value: string;
        label: string;
    }>;
    value?: string;
    onChange?: (value: string) => void;
    error?: boolean;
    required?: boolean;
    legend: string;
}
export declare function RadioGroup({ name, options, value, onChange, error, required, legend }: RadioGroupProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=form-accessible.d.ts.map