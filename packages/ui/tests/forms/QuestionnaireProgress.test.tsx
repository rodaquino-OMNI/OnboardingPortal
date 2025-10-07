/**
 * QuestionnaireProgress component tests
 * Progress indication and ARIA compliance
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { QuestionnaireProgress } from '../../src/forms/QuestionnaireProgress';

describe('QuestionnaireProgress', () => {
  test('displays current step correctly', () => {
    render(
      <QuestionnaireProgress
        currentStep={2}
        totalSteps={5}
        completionPercentage={40}
      />
    );

    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
  });

  test('displays percentage correctly', () => {
    render(
      <QuestionnaireProgress
        currentStep={1}
        totalSteps={4}
        completionPercentage={25}
      />
    );

    expect(screen.getByText('25% Complete')).toBeInTheDocument();
  });

  test('progressbar has proper ARIA attributes', () => {
    render(
      <QuestionnaireProgress
        currentStep={1}
        totalSteps={3}
        completionPercentage={33}
      />
    );

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '33');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });

  test('clamps percentage to valid range', () => {
    const { rerender } = render(
      <QuestionnaireProgress
        currentStep={0}
        totalSteps={3}
        completionPercentage={150}
      />
    );

    let progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '100');

    rerender(
      <QuestionnaireProgress
        currentStep={0}
        totalSteps={3}
        completionPercentage={-10}
      />
    );

    progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '0');
  });

  test('renders step labels when provided', () => {
    const labels = ['Demographics', 'Health History', 'Mental Health', 'Review'];

    render(
      <QuestionnaireProgress
        currentStep={1}
        totalSteps={4}
        completionPercentage={25}
        stepLabels={labels}
      />
    );

    labels.forEach(label => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  test('highlights current and completed steps', () => {
    const labels = ['Step 1', 'Step 2', 'Step 3'];

    const { container } = render(
      <QuestionnaireProgress
        currentStep={1}
        totalSteps={3}
        completionPercentage={50}
        stepLabels={labels}
      />
    );

    const step1 = screen.getByText('Step 1');
    const step2 = screen.getByText('Step 2');
    const step3 = screen.getByText('Step 3');

    // Step 1 (completed) and Step 2 (current) should be highlighted
    expect(step1).toHaveClass('text-blue-600');
    expect(step2).toHaveClass('text-blue-600');
    expect(step3).toHaveClass('text-gray-400');
  });

  test('has no a11y violations', async () => {
    const { container } = render(
      <QuestionnaireProgress
        currentStep={1}
        totalSteps={3}
        completionPercentage={33}
        stepLabels={['Step 1', 'Step 2', 'Step 3']}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('percentage live region updates', () => {
    render(
      <QuestionnaireProgress
        currentStep={1}
        totalSteps={3}
        completionPercentage={50}
      />
    );

    const liveRegion = screen.getByText('50% Complete');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
  });
});
