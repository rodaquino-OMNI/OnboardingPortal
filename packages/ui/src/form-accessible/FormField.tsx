/**
 * FormField - Accessible form field wrapper
 * ADR-003: Presentation-only wrapper with ARIA support
 */

import React from 'react';
import { cn } from '../lib/utils';

interface FormFieldProps {
  children: React.ReactNode;
  label: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  fieldId: string;
}

export function FormField({
  children,
  label,
  required = false,
  error,
  helpText,
  fieldId,
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={fieldId}
        className={cn(
          'block text-sm font-medium',
          error ? 'text-red-700' : 'text-gray-700'
        )}
      >
        {label}
        {required && (
          <span className="text-red-600 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      {helpText && !error && (
        <p
          id={`${fieldId}-help`}
          className="text-sm text-gray-500"
        >
          {helpText}
        </p>
      )}

      {children}

      {error && (
        <p
          id={`${fieldId}-error`}
          className="text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
