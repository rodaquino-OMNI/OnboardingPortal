import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import { cn } from '@/lib/utils';
import { a11y } from '@/lib/utils/accessibility';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
export function FormField({ label, htmlFor, required = false, children, error, description, success }) {
    const fieldId = htmlFor;
    const errorId = error ? `${fieldId}-error` : undefined;
    const descId = description ? `${fieldId}-description` : undefined;
    return (_jsxs("div", { className: "space-y-2", children: [_jsxs("label", { htmlFor: fieldId, className: "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", children: [label, required && (_jsx("span", { className: "text-error-500 ml-1", "aria-label": "required", children: "*" }))] }), description && (_jsxs("p", { id: descId, className: "text-sm text-neutral-600 flex items-center gap-1", children: [_jsx(Info, { className: "h-3 w-3", "aria-hidden": "true" }), description] })), React.cloneElement(children, {
                id: fieldId,
                'aria-invalid': !!error,
                'aria-describedby': [descId, errorId].filter(Boolean).join(' ') || undefined,
                'aria-required': required,
            }), error && (_jsxs("p", { id: errorId, className: "text-sm text-error-500 flex items-center gap-1", role: "alert", children: [_jsx(AlertCircle, { className: "h-3 w-3", "aria-hidden": "true" }), error] })), success && !error && (_jsxs("p", { className: "text-sm text-success-600 flex items-center gap-1", children: [_jsx(CheckCircle, { className: "h-3 w-3", "aria-hidden": "true" }), _jsx("span", { className: "sr-only", children: "Success:" }), "Field is valid"] }))] }));
}
export const Input = React.forwardRef(({ className, type, error, ...props }, ref) => {
    return (_jsx("input", { type: type, className: cn('flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm', 'placeholder:text-neutral-500', a11y.focusVisible, 'disabled:cursor-not-allowed disabled:opacity-50', 'min-h-[44px]', // Mobile touch target
        error && 'border-error-500', className), ref: ref, ...props }));
});
Input.displayName = 'Input';
export const Textarea = React.forwardRef(({ className, error, ...props }, ref) => {
    return (_jsx("textarea", { className: cn('flex min-h-[80px] w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm', 'placeholder:text-neutral-500', a11y.focusVisible, 'disabled:cursor-not-allowed disabled:opacity-50', 'resize-y', error && 'border-error-500', className), ref: ref, ...props }));
});
Textarea.displayName = 'Textarea';
export const Select = React.forwardRef(({ className, error, options, placeholder = 'Select an option', ...props }, ref) => {
    return (_jsxs("select", { className: cn('flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm', a11y.focusVisible, 'disabled:cursor-not-allowed disabled:opacity-50', 'min-h-[44px]', // Mobile touch target
        error && 'border-error-500', className), ref: ref, ...props, children: [_jsx("option", { value: "", disabled: true, children: placeholder }), options.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value)))] }));
});
Select.displayName = 'Select';
export const Checkbox = React.forwardRef(({ className, label, error, id, ...props }, ref) => {
    const generatedId = React.useId();
    const checkboxId = id || generatedId;
    return (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", id: checkboxId, ref: ref, className: cn('h-5 w-5 rounded border-neutral-300', a11y.focusVisible, 'disabled:cursor-not-allowed disabled:opacity-50', error && 'border-error-500', className), ...props }), _jsx("label", { htmlFor: checkboxId, className: "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 select-none cursor-pointer", children: label })] }));
});
Checkbox.displayName = 'Checkbox';
export function RadioGroup({ name, options, value, onChange, error, required, legend }) {
    return (_jsxs("fieldset", { role: "radiogroup", "aria-required": required, children: [_jsx("legend", { className: "text-sm font-medium mb-3", children: legend }), _jsx("div", { className: "space-y-2", children: options.map((option) => {
                    const optionId = `${name}-${option.value}`;
                    return (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "radio", id: optionId, name: name, value: option.value, checked: value === option.value, onChange: (e) => onChange?.(e.target.value), className: cn('h-5 w-5', a11y.focusVisible, 'disabled:cursor-not-allowed disabled:opacity-50', error && 'border-error-500') }), _jsx("label", { htmlFor: optionId, className: "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 select-none cursor-pointer", children: option.label })] }, option.value));
                }) })] }));
}
