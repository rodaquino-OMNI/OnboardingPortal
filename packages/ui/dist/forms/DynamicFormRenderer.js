import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Import accessible form components (placeholder imports - adjust based on actual UI library)
import { FormField, Input, Textarea, Select, RadioGroup, Checkbox, } from '../form-accessible';
export function DynamicFormRenderer({ questions, values, errors, onChange, onBlur, }) {
    /**
     * Render appropriate field component based on question type
     * Pure presentation logic - no side effects
     */
    const renderField = (question) => {
        const commonProps = {
            id: question.id,
            'aria-label': question.ariaLabel || question.label,
            'aria-invalid': !!errors[question.id],
            'aria-describedby': errors[question.id]
                ? `${question.id}-error`
                : question.helpText
                    ? `${question.id}-help`
                    : undefined,
        };
        switch (question.type) {
            case 'text':
            case 'number':
                return (_jsx(Input, { ...commonProps, type: question.type, value: values[question.id] || '', onChange: (e) => onChange(question.id, e.target.value), onBlur: () => onBlur?.(question.id), min: question.validation?.min, max: question.validation?.max, pattern: question.validation?.pattern, required: question.required }));
            case 'textarea':
                return (_jsx(Textarea, { ...commonProps, value: values[question.id] || '', onChange: (e) => onChange(question.id, e.target.value), onBlur: () => onBlur?.(question.id), required: question.required, rows: 4 }));
            case 'select':
                return (_jsxs(Select, { ...commonProps, value: values[question.id] || '', onChange: (e) => onChange(question.id, e.target.value), onBlur: () => onBlur?.(question.id), required: question.required, children: [_jsx("option", { value: "", children: "Select an option" }), question.options?.map((opt) => (_jsx("option", { value: opt.value, children: opt.label }, opt.value)))] }));
            case 'radio':
                return (_jsx(RadioGroup, { name: question.id, value: values[question.id] || '', onChange: (value) => onChange(question.id, value), options: question.options || [], "aria-label": question.ariaLabel || question.label, "aria-invalid": !!errors[question.id], required: question.required }));
            case 'checkbox':
                return (_jsx(Checkbox, { ...commonProps, checked: !!values[question.id], onChange: (e) => onChange(question.id, e.target.checked), onBlur: () => onBlur?.(question.id), required: question.required }));
            case 'scale':
                // PHQ-9/GAD-7 standardized 0-3 scale
                return (_jsx(RadioGroup, { name: question.id, value: values[question.id]?.toString() || '', onChange: (value) => onChange(question.id, parseInt(value, 10)), options: [
                        { value: '0', label: 'Not at all' },
                        { value: '1', label: 'Several days' },
                        { value: '2', label: 'More than half the days' },
                        { value: '3', label: 'Nearly every day' },
                    ], "aria-label": question.ariaLabel || question.label, "aria-invalid": !!errors[question.id], required: question.required }));
            default:
                console.warn(`Unsupported question type: ${question.type}`);
                return null;
        }
    };
    return (_jsx("div", { className: "space-y-6", role: "form", "aria-label": "Health questionnaire form", children: questions.map((question, index) => (_jsx(FormField, { label: question.label, required: question.required, error: errors[question.id], helpText: question.helpText, fieldId: question.id, children: renderField(question) }, question.id))) }));
}
// Display name for React DevTools
DynamicFormRenderer.displayName = 'DynamicFormRenderer';
