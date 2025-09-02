'use client';

import * as React from 'react';
import { createContext, useContext, useCallback, useState } from 'react';

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

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = {
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

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
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

  return (
    <div className="fixed top-0 right-0 z-50 p-4 space-y-2 w-full max-w-sm">
      {toasts.map((toast) => (
        <ToastComponent key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

// Individual toast component
function ToastComponent({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const variantStyles = {
    default: 'bg-white border-gray-200',
    destructive: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  };

  return (
    <div
      className={`
        relative rounded-lg border p-4 shadow-lg transition-all duration-300
        ${variantStyles[toast.variant || 'default']}
      `}
      role="alert"
      aria-live="polite"
    >
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
        aria-label="Close notification"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      <div className="pr-8">
        {toast.title && (
          <div className="font-semibold mb-1">
            {toast.title}
          </div>
        )}
        {toast.description && (
          <div className="text-sm opacity-90">
            {toast.description}
          </div>
        )}
        {toast.action && (
          <div className="mt-3">
            {toast.action}
          </div>
        )}
      </div>
    </div>
  );
}

// Convenience hook for common toast patterns
export const toast = {
  success: (title: string, description?: string) => {
    const { addToast } = useToast();
    return addToast({ title, description, variant: 'success' });
  },
  error: (title: string, description?: string) => {
    const { addToast } = useToast();
    return addToast({ title, description, variant: 'destructive' });
  },
  warning: (title: string, description?: string) => {
    const { addToast } = useToast();
    return addToast({ title, description, variant: 'warning' });
  },
  info: (title: string, description?: string) => {
    const { addToast } = useToast();
    return addToast({ title, description, variant: 'default' });
  },
};
