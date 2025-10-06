import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '@/lib/utils';
export function StatCard({ title, value, description, icon: Icon, iconColor = 'text-blue-600', iconBg = 'bg-blue-50', trend, className }) {
    return (_jsx("div", { className: cn("card-modern p-6", className), children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: title }), _jsx("p", { className: "text-2xl font-bold tracking-tight text-gray-900 mt-1", children: value }), description && (_jsx("p", { className: "text-xs text-gray-500 mt-1", children: description })), trend && (_jsxs("div", { className: cn("flex items-center gap-1 mt-2 text-xs font-medium", trend.isPositive ? "text-green-600" : "text-red-600"), children: [_jsx("span", { children: trend.isPositive ? '↑' : '↓' }), _jsxs("span", { children: [Math.abs(trend.value), "%"] })] }))] }), Icon && (_jsx("div", { className: cn("p-3 rounded-lg", iconBg), children: _jsx(Icon, { className: cn("w-6 h-6", iconColor) }) }))] }) }));
}
export function ActionCard({ title, description, icon: Icon, iconColor = 'text-blue-600', iconBg = 'bg-blue-50', onClick, className }) {
    return (_jsxs("div", { className: cn("card-modern p-6 cursor-pointer transition-all duration-300", "hover:shadow-lg hover:translate-y-[-2px]", className), onClick: onClick, children: [_jsx("div", { className: cn("w-12 h-12 rounded-lg flex items-center justify-center mb-4", iconBg), children: _jsx(Icon, { className: cn("w-6 h-6", iconColor) }) }), _jsx("h3", { className: "font-semibold text-gray-900 mb-1", children: title }), _jsx("p", { className: "text-sm text-gray-600", children: description })] }));
}
export function FeatureCard({ title, description, features, icon: Icon, badge, className }) {
    return (_jsxs("div", { className: cn("card-modern p-6 relative overflow-hidden", className), children: [badge && (_jsx("div", { className: "absolute top-4 right-4", children: _jsx("span", { className: "px-2 py-1 text-xs font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full", children: badge }) })), _jsx("div", { className: "w-14 h-14 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center mb-4", children: _jsx(Icon, { className: "w-7 h-7 text-white" }) }), _jsx("h3", { className: "text-xl font-bold tracking-tight text-gray-900 mb-2", children: title }), _jsx("p", { className: "text-gray-600 mb-4", children: description }), _jsx("ul", { className: "space-y-2", children: features.map((feature, index) => (_jsxs("li", { className: "flex items-start gap-2 text-sm text-gray-600", children: [_jsx("span", { className: "text-blue-600 mt-0.5", children: "\u2022" }), _jsx("span", { children: feature })] }, index))) })] }));
}
export function TimelineItem({ title, description, date, icon: Icon, isActive = false, isCompleted = false, className }) {
    return (_jsxs("div", { className: cn("relative flex gap-4", className), children: [_jsx("div", { className: "absolute left-6 top-12 bottom-0 w-0.5 bg-gray-200" }), _jsx("div", { className: cn("relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300", isActive && "bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg", isCompleted && "bg-green-500", !isActive && !isCompleted && "bg-gray-200"), children: Icon ? (_jsx(Icon, { className: cn("w-6 h-6", (isActive || isCompleted) && "text-white") })) : (_jsx("div", { className: cn("w-3 h-3 rounded-full", (isActive || isCompleted) ? "bg-white" : "bg-gray-400") })) }), _jsx("div", { className: "flex-1 pb-8", children: _jsxs("div", { className: cn("card-modern p-4", isActive && "border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50"), children: [_jsxs("div", { className: "flex items-start justify-between mb-1", children: [_jsx("h4", { className: "font-semibold text-gray-900", children: title }), _jsx("span", { className: "text-xs text-gray-500", children: date })] }), _jsx("p", { className: "text-sm text-gray-600", children: description })] }) })] }));
}
export function NotificationCard({ title, message, type = 'info', icon: Icon, onClose, className }) {
    const typeStyles = {
        info: {
            bg: 'bg-gradient-to-r from-blue-50 to-blue-100',
            iconBg: 'bg-blue-100',
            iconColor: 'text-blue-600',
            border: 'border-blue-200'
        },
        success: {
            bg: 'bg-gradient-to-r from-green-50 to-green-100',
            iconBg: 'bg-green-100',
            iconColor: 'text-green-600',
            border: 'border-green-200'
        },
        warning: {
            bg: 'bg-gradient-to-r from-yellow-50 to-yellow-100',
            iconBg: 'bg-yellow-100',
            iconColor: 'text-yellow-600',
            border: 'border-yellow-200'
        },
        error: {
            bg: 'bg-gradient-to-r from-red-50 to-red-100',
            iconBg: 'bg-red-100',
            iconColor: 'text-red-600',
            border: 'border-red-200'
        }
    };
    const styles = typeStyles[type];
    return (_jsx("div", { className: cn("card-modern p-4 border animate-fade-in", styles.bg, styles.border, className), children: _jsxs("div", { className: "flex gap-3", children: [Icon && (_jsx("div", { className: cn("p-2 rounded-lg", styles.iconBg), children: _jsx(Icon, { className: cn("w-5 h-5", styles.iconColor) }) })), _jsxs("div", { className: "flex-1", children: [_jsx("h4", { className: "font-semibold text-gray-900 mb-1", children: title }), _jsx("p", { className: "text-sm text-gray-600", children: message })] }), onClose && (_jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-600 transition-colors", children: "\u00D7" }))] }) }));
}
export function EmptyState({ icon: Icon, title, description, action, className }) {
    return (_jsxs("div", { className: cn("card-modern p-12 text-center", className), children: [_jsx("div", { className: "w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4", children: _jsx(Icon, { className: "w-10 h-10 text-gray-400" }) }), _jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-2", children: title }), _jsx("p", { className: "text-gray-600 mb-6 max-w-sm mx-auto", children: description }), action && (_jsx("button", { onClick: action.onClick, className: "px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200", children: action.label }))] }));
}
export function SectionHeader({ title, description, icon: Icon, action, className }) {
    return (_jsxs("div", { className: cn("flex items-center justify-between mb-6", className), children: [_jsxs("div", { className: "flex items-center gap-3", children: [Icon && (_jsx("div", { className: "w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center", children: _jsx(Icon, { className: "w-5 h-5 text-gray-600" }) })), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold tracking-tight text-gray-900", children: title }), description && (_jsx("p", { className: "text-sm text-gray-600 mt-1", children: description }))] })] }), action && (_jsx("button", { onClick: action.onClick, className: "text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors", children: action.label }))] }));
}
// ===== LOADING CARD =====
export function LoadingCard({ className }) {
    return (_jsx("div", { className: cn("card-modern p-6", className), children: _jsxs("div", { className: "animate-pulse space-y-4", children: [_jsx("div", { className: "h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-3/4" }), _jsx("div", { className: "h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded" }), _jsx("div", { className: "h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-5/6" })] }) }));
}
export function ButtonGroup({ options, value, onChange, className }) {
    return (_jsx("div", { className: cn("inline-flex rounded-lg bg-gray-100 p-1", className), children: options.map((option) => {
            const Icon = option.icon;
            const isActive = value === option.value;
            return (_jsxs("button", { onClick: () => onChange(option.value), className: cn("px-4 py-2 rounded-md text-sm font-medium transition-all duration-200", "flex items-center gap-2", isActive ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"), children: [Icon && _jsx(Icon, { className: "w-4 h-4" }), option.label] }, option.value));
        }) }));
}
