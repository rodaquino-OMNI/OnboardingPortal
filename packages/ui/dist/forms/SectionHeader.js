import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function SectionHeader({ title, description, icon }) {
    return (_jsxs("header", { className: "mb-6", children: [_jsxs("div", { className: "flex items-center gap-3 mb-2", children: [icon && (_jsx("div", { className: "flex-shrink-0 text-blue-600", "aria-hidden": "true", children: icon })), _jsx("h2", { className: "text-2xl font-bold text-gray-900", children: title })] }), description && (_jsx("p", { className: "text-sm text-gray-600 leading-relaxed", children: description }))] }));
}
SectionHeader.displayName = 'SectionHeader';
