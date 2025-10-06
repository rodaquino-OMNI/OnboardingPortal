import * as React from 'react';
export interface Toast {
    id: string;
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactElement;
    variant?: 'default' | 'destructive' | 'success' | 'warning';
    duration?: number;
}
interface ToastContextType {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => string;
    removeToast: (id: string) => void;
    clearToasts: () => void;
}
export declare function ToastProvider({ children }: {
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare const useToast: () => ToastContextType;
export declare const toast: {
    success: (title: string, description?: string) => string;
    error: (title: string, description?: string) => string;
    warning: (title: string, description?: string) => string;
    info: (title: string, description?: string) => string;
};
export {};
//# sourceMappingURL=use-toast.d.ts.map