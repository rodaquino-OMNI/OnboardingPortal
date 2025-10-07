/**
 * Checkbox - Accessible checkbox component
 * ADR-003: Presentation-only checkbox with ARIA support
 */

import React from 'react';
import { cn } from '../lib/utils';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: boolean;
  label?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, error, label, id, ...props }, ref) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    const checkbox = (
      <input
        type="checkbox"
        id={checkboxId}
        ref={ref}
        className={cn(
          'w-4 h-4 rounded border-gray-300',
          'focus:ring-2 focus:ring-offset-2',
          'text-blue-600 cursor-pointer',
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'focus:ring-blue-500',
          className
        )}
        {...props}
      />
    );

    if (label) {
      return (
        <label
          htmlFor={checkboxId}
          className="flex items-center space-x-2 cursor-pointer group"
        >
          {checkbox}
          <span className="text-sm text-gray-700 group-hover:text-gray-900">
            {label}
          </span>
        </label>
      );
    }

    return checkbox;
  }
);

Checkbox.displayName = 'Checkbox';
