import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '../lib/utils';
export function FormField({ children, label, required = false, error, helpText, fieldId, }) {
    return (_jsxs("div", { className: "space-y-2", children: [_jsxs("label", { htmlFor: fieldId, className: cn('block text-sm font-medium', error ? 'text-red-700' : 'text-gray-700'), children: [label, required && (_jsx("span", { className: "text-red-600 ml-1", "aria-label": "required", children: "*" }))] }), helpText && !error && (_jsx("p", { id: `${fieldId}-help`, className: "text-sm text-gray-500", children: helpText })), children, error && (_jsx("p", { id: `${fieldId}-error`, className: "text-sm text-red-600", role: "alert", children: error }))] }));
}
