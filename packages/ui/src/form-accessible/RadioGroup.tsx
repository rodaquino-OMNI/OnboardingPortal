/**
 * RadioGroup - Accessible radio button group
 * ADR-003: Presentation-only radio group with ARIA support
 */

import React from 'react';
import { cn } from '../lib/utils';

interface RadioOption {
  value: string;
  label: string;
}

interface RadioGroupProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  required?: boolean;
  className?: string;
}

export function RadioGroup({
  name,
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  required = false,
  className,
}: RadioGroupProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-invalid={ariaInvalid}
      aria-required={required}
      className={cn('space-y-3', className)}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            className={cn(
              'w-4 h-4 border-gray-300',
              'focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
              'text-blue-600 cursor-pointer'
            )}
          />
          <span className="text-sm text-gray-700 group-hover:text-gray-900">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}

RadioGroup.displayName = 'RadioGroup';
