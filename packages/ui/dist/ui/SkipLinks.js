import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { a11y } from '@/lib/utils/accessibility';
export function SkipLinks() {
    return (_jsxs("nav", { "aria-label": "Skip navigation", children: [_jsx("a", { href: "#main-content", className: a11y.skipLink, children: "Skip to main content" }), _jsx("a", { href: "#navigation", className: a11y.skipLink, children: "Skip to navigation" }), _jsx("a", { href: "#footer", className: a11y.skipLink, children: "Skip to footer" })] }));
}
