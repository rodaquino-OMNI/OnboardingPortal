'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useContext, useCallback, useState } from 'react';
const ToastContext = createContext(undefined);
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((toast) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newToast = {
            ...toast,
            id,
            duration: toast.duration ?? 5000,
        };
        setToasts((prev) => [...prev, newToast]);
        // Auto-remove after duration
        if (newToast.duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, newToast.duration);
        }
        return id;
    }, []);
    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);
    const clearToasts = useCallback(() => {
        setToasts([]);
    }, []);
    return (_jsxs(ToastContext.Provider, { value: { toasts, addToast, removeToast, clearToasts }, children: [children, _jsx(ToastViewport, {})] }));
}
export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
// Toast viewport component
function ToastViewport() {
    const { toasts, removeToast } = useToast();
    return (_jsx("div", { className: "fixed top-0 right-0 z-50 p-4 space-y-2 w-full max-w-sm", children: toasts.map((toast) => (_jsx(ToastComponent, { toast: toast, onClose: () => removeToast(toast.id) }, toast.id))) }));
}
// Individual toast component
function ToastComponent({ toast, onClose }) {
    const variantStyles = {
        default: 'bg-white border-gray-200',
        destructive: 'bg-red-50 border-red-200 text-red-800',
        success: 'bg-green-50 border-green-200 text-green-800',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    };
    return (_jsxs("div", { className: `
        relative rounded-lg border p-4 shadow-lg transition-all duration-300
        ${variantStyles[toast.variant || 'default']}
      `, role: "alert", "aria-live": "polite", children: [_jsx("button", { onClick: onClose, className: "absolute top-2 right-2 text-gray-400 hover:text-gray-600", "aria-label": "Close notification", children: _jsx("svg", { className: "h-4 w-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) }), _jsxs("div", { className: "pr-8", children: [toast.title && (_jsx("div", { className: "font-semibold mb-1", children: toast.title })), toast.description && (_jsx("div", { className: "text-sm opacity-90", children: toast.description })), toast.action && (_jsx("div", { className: "mt-3", children: toast.action }))] })] }));
}
// Convenience hook for common toast patterns
export const toast = {
    success: (title, description) => {
        const { addToast } = useToast();
        return addToast({ title, description, variant: 'success' });
    },
    error: (title, description) => {
        const { addToast } = useToast();
        return addToast({ title, description, variant: 'destructive' });
    },
    warning: (title, description) => {
        const { addToast } = useToast();
        return addToast({ title, description, variant: 'warning' });
    },
    info: (title, description) => {
        const { addToast } = useToast();
        return addToast({ title, description, variant: 'default' });
    },
};
