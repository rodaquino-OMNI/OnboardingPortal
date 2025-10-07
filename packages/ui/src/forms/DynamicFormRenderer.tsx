/**
 * Dynamic Form Renderer - Presentation-only component
 * ADR-003 Compliance: ZERO network calls, all data via props
 * WCAG 2.1 AA: Full keyboard navigation, ARIA support
 */

import React from 'react';
import { Question, DynamicFormRendererProps } from './types';
import { cn } from '../lib/utils';

// Import accessible form components (placeholder imports - adjust based on actual UI library)
import {
  FormField,
  Input,
  Textarea,
  Select,
  RadioGroup,
  Checkbox,
} from '../form-accessible';

export function DynamicFormRenderer({
  questions,
  values,
  errors,
  onChange,
  onBlur,
}: DynamicFormRendererProps) {
  /**
   * Render appropriate field component based on question type
   * Pure presentation logic - no side effects
   */
  const renderField = (question: Question) => {
    const commonProps = {
      id: question.id,
      'aria-label': question.ariaLabel || question.label,
      'aria-invalid': !!errors[question.id],
      'aria-describedby': errors[question.id]
        ? `${question.id}-error`
        : question.helpText
        ? `${question.id}-help`
        : undefined,
    };

    switch (question.type) {
      case 'text':
      case 'number':
        return (
          <Input
            {...commonProps}
            type={question.type}
            value={values[question.id] || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange(question.id, e.target.value)
            }
            onBlur={() => onBlur?.(question.id)}
            min={question.validation?.min}
            max={question.validation?.max}
            pattern={question.validation?.pattern}
            required={question.required}
          />
        );

      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            value={values[question.id] || ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              onChange(question.id, e.target.value)
            }
            onBlur={() => onBlur?.(question.id)}
            required={question.required}
            rows={4}
          />
        );

      case 'select':
        return (
          <Select
            {...commonProps}
            value={values[question.id] || ''}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              onChange(question.id, e.target.value)
            }
            onBlur={() => onBlur?.(question.id)}
            required={question.required}
          >
            <option value="">Select an option</option>
            {question.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        );

      case 'radio':
        return (
          <RadioGroup
            name={question.id}
            value={values[question.id] || ''}
            onChange={(value: string) => onChange(question.id, value)}
            options={question.options || []}
            aria-label={question.ariaLabel || question.label}
            aria-invalid={!!errors[question.id]}
            required={question.required}
          />
        );

      case 'checkbox':
        return (
          <Checkbox
            {...commonProps}
            checked={!!values[question.id]}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange(question.id, e.target.checked)
            }
            onBlur={() => onBlur?.(question.id)}
            required={question.required}
          />
        );

      case 'scale':
        // PHQ-9/GAD-7 standardized 0-3 scale
        return (
          <RadioGroup
            name={question.id}
            value={values[question.id]?.toString() || ''}
            onChange={(value: string) => onChange(question.id, parseInt(value, 10))}
            options={[
              { value: '0', label: 'Not at all' },
              { value: '1', label: 'Several days' },
              { value: '2', label: 'More than half the days' },
              { value: '3', label: 'Nearly every day' },
            ]}
            aria-label={question.ariaLabel || question.label}
            aria-invalid={!!errors[question.id]}
            required={question.required}
          />
        );

      default:
        console.warn(`Unsupported question type: ${question.type}`);
        return null;
    }
  };

  return (
    <div className="space-y-6" role="form" aria-label="Health questionnaire form">
      {questions.map((question, index) => (
        <FormField
          key={question.id}
          label={question.label}
          required={question.required}
          error={errors[question.id]}
          helpText={question.helpText}
          fieldId={question.id}
        >
          {renderField(question)}
        </FormField>
      ))}
    </div>
  );
}

// Display name for React DevTools
DynamicFormRenderer.displayName = 'DynamicFormRenderer';
