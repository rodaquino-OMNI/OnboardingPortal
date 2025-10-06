import * as React from 'react';
import { cn } from '@/lib/utils';
import { a11y } from '@/lib/utils/accessibility';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
  error?: string;
  description?: string;
  success?: boolean;
}

export function FormField({ 
  label, 
  htmlFor, 
  required = false, 
  children, 
  error, 
  description,
  success 
}: FormFieldProps) {
  const fieldId = htmlFor;
  const errorId = error ? `${fieldId}-error` : undefined;
  const descId = description ? `${fieldId}-description` : undefined;
  
  return (
    <div className="space-y-2">
      <label 
        htmlFor={fieldId}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required && (
          <span className="text-error-500 ml-1" aria-label="required">*</span>
        )}
      </label>
      
      {description && (
        <p id={descId} className="text-sm text-neutral-600 flex items-center gap-1">
          <Info className="h-3 w-3" aria-hidden="true" />
          {description}
        </p>
      )}
      
      {React.cloneElement(children as React.ReactElement, {
        id: fieldId,
        'aria-invalid': !!error,
        'aria-describedby': [descId, errorId].filter(Boolean).join(' ') || undefined,
        'aria-required': required,
      })}
      
      {error && (
        <p id={errorId} className="text-sm text-error-500 flex items-center gap-1" role="alert">
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          {error}
        </p>
      )}
      
      {success && !error && (
        <p className="text-sm text-success-600 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">Success:</span>
          Field is valid
        </p>
      )}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm',
          'placeholder:text-neutral-500',
          a11y.focusVisible,
          'disabled:cursor-not-allowed disabled:opacity-50',
          'min-h-[44px]', // Mobile touch target
          error && 'border-error-500',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm',
          'placeholder:text-neutral-500',
          a11y.focusVisible,
          'disabled:cursor-not-allowed disabled:opacity-50',
          'resize-y',
          error && 'border-error-500',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, options, placeholder = 'Select an option', ...props }, ref) => {
    return (
      <select
        className={cn(
          'flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm',
          a11y.focusVisible,
          'disabled:cursor-not-allowed disabled:opacity-50',
          'min-h-[44px]', // Mobile touch target
          error && 'border-error-500',
          className
        )}
        ref={ref}
        {...props}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
);

Select.displayName = 'Select';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const generatedId = React.useId();
    const checkboxId = id || generatedId;
    
    return (
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id={checkboxId}
          ref={ref}
          className={cn(
            'h-5 w-5 rounded border-neutral-300',
            a11y.focusVisible,
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-error-500',
            className
          )}
          {...props}
        />
        <label
          htmlFor={checkboxId}
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 select-none cursor-pointer"
        >
          {label}
        </label>
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

interface RadioGroupProps {
  name: string;
  options: Array<{ value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
  error?: boolean;
  required?: boolean;
  legend: string;
}

export function RadioGroup({ 
  name, 
  options, 
  value, 
  onChange, 
  error, 
  required,
  legend 
}: RadioGroupProps) {
  return (
    <fieldset role="radiogroup" aria-required={required}>
      <legend className="text-sm font-medium mb-3">{legend}</legend>
      <div className="space-y-2">
        {options.map((option) => {
          const optionId = `${name}-${option.value}`;
          return (
            <div key={option.value} className="flex items-center space-x-2">
              <input
                type="radio"
                id={optionId}
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={(e) => onChange?.(e.target.value)}
                className={cn(
                  'h-5 w-5',
                  a11y.focusVisible,
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  error && 'border-error-500'
                )}
              />
              <label
                htmlFor={optionId}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 select-none cursor-pointer"
              >
                {option.label}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}