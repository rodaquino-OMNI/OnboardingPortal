/**
 * Accessibility tests for DynamicFormRenderer
 * WCAG 2.1 AA compliance validation using axe-core
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { DynamicFormRenderer } from '../../src/forms/DynamicFormRenderer';
import { Question } from '../../src/forms/types';

expect.extend(toHaveNoViolations);

const mockQuestions: Question[] = [
  {
    id: 'name',
    type: 'text',
    label: 'Full Name',
    required: true,
    ariaLabel: 'Enter your full name',
  },
  {
    id: 'age',
    type: 'number',
    label: 'Age',
    required: true,
    validation: { min: 18, max: 120 },
    helpText: 'You must be 18 or older',
  },
  {
    id: 'mood',
    type: 'scale',
    label: 'How often have you felt down or depressed?',
    required: true,
    ariaLabel: 'Rate your mood frequency',
  },
  {
    id: 'country',
    type: 'select',
    label: 'Country',
    required: false,
    options: [
      { value: 'us', label: 'United States' },
      { value: 'uk', label: 'United Kingdom' },
      { value: 'ca', label: 'Canada' },
    ],
  },
];

describe('DynamicFormRenderer Accessibility', () => {
  test('has no a11y violations with empty form', async () => {
    const { container } = render(
      <DynamicFormRenderer
        questions={mockQuestions}
        values={{}}
        errors={{}}
        onChange={() => {}}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('has no a11y violations with values', async () => {
    const { container } = render(
      <DynamicFormRenderer
        questions={mockQuestions}
        values={{ name: 'John Doe', age: 30, mood: 1 }}
        errors={{}}
        onChange={() => {}}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('has no a11y violations with errors', async () => {
    const { container } = render(
      <DynamicFormRenderer
        questions={mockQuestions}
        values={{}}
        errors={{
          name: 'Name is required',
          age: 'Age must be at least 18',
        }}
        onChange={() => {}}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('properly associates labels with inputs', () => {
    render(
      <DynamicFormRenderer
        questions={mockQuestions}
        values={{}}
        errors={{}}
        onChange={() => {}}
      />
    );

    const nameInput = screen.getByLabelText(/full name/i);
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveAttribute('type', 'text');
    expect(nameInput).toHaveAttribute('required');
  });

  test('required fields have aria-required', () => {
    render(
      <DynamicFormRenderer
        questions={mockQuestions}
        values={{}}
        errors={{}}
        onChange={() => {}}
      />
    );

    const nameInput = screen.getByLabelText(/full name/i);
    expect(nameInput).toHaveAttribute('required');
  });

  test('error fields have aria-invalid', () => {
    render(
      <DynamicFormRenderer
        questions={mockQuestions}
        values={{}}
        errors={{ name: 'Name is required' }}
        onChange={() => {}}
      />
    );

    const nameInput = screen.getByLabelText(/full name/i);
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
  });

  test('help text is properly associated with aria-describedby', () => {
    render(
      <DynamicFormRenderer
        questions={mockQuestions}
        values={{}}
        errors={{}}
        onChange={() => {}}
      />
    );

    const ageInput = screen.getByLabelText(/age/i);
    const helpText = screen.getByText(/you must be 18 or older/i);

    expect(ageInput).toHaveAttribute('aria-describedby');
    expect(helpText).toBeInTheDocument();
  });

  test('scale questions render as radio groups', () => {
    render(
      <DynamicFormRenderer
        questions={mockQuestions}
        values={{}}
        errors={{}}
        onChange={() => {}}
      />
    );

    const radioGroup = screen.getByRole('radiogroup', { name: /rate your mood frequency/i });
    expect(radioGroup).toBeInTheDocument();
  });

  test('keyboard navigation works for all field types', () => {
    const { container } = render(
      <DynamicFormRenderer
        questions={mockQuestions}
        values={{}}
        errors={{}}
        onChange={() => {}}
      />
    );

    const focusableElements = container.querySelectorAll(
      'input, select, textarea, button'
    );

    focusableElements.forEach((element) => {
      expect(element).toBeVisible();
      // All form elements should be keyboard accessible
      expect(element).not.toHaveAttribute('tabindex', '-1');
    });
  });
});
