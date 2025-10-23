import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '../lib/utils';
export function RadioGroup({ name, value, onChange, options, 'aria-label': ariaLabel, 'aria-invalid': ariaInvalid, required = false, className, }) {
    return (_jsx("div", { role: "radiogroup", "aria-label": ariaLabel, "aria-invalid": ariaInvalid, "aria-required": required, className: cn('space-y-3', className), children: options.map((option) => (_jsxs("label", { className: "flex items-center space-x-3 cursor-pointer group", children: [_jsx("input", { type: "radio", name: name, value: option.value, checked: value === option.value, onChange: (e) => onChange(e.target.value), required: required, className: cn('w-4 h-4 border-gray-300', 'focus:ring-2 focus:ring-offset-2 focus:ring-blue-500', 'text-blue-600 cursor-pointer') }), _jsx("span", { className: "text-sm text-gray-700 group-hover:text-gray-900", children: option.label })] }, option.value))) }));
}
RadioGroup.displayName = 'RadioGroup';
