/**
 * Questionnaire Progress Indicator
 * ADR-003 Compliance: Pure presentation component
 * WCAG 2.1 AA: ARIA progressbar with live region updates
 */

import React from 'react';
import { QuestionnaireProgressProps } from './types';
import { cn } from '../lib/utils';

export function QuestionnaireProgress({
  currentStep,
  totalSteps,
  completionPercentage,
  stepLabels,
}: QuestionnaireProgressProps) {
  // Ensure percentage is within valid range
  const clampedPercentage = Math.min(100, Math.max(0, completionPercentage));

  return (
    <div className="w-full" aria-label="Questionnaire progress">
      {/* Progress text */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-900">
          Step {currentStep + 1} of {totalSteps}
        </span>
        <span
          className="text-sm text-gray-600"
          aria-live="polite"
          aria-atomic="true"
        >
          {clampedPercentage}% Complete
        </span>
      </div>

      {/* Visual progress bar */}
      <div
        className="w-full h-2 bg-gray-200 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={clampedPercentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${clampedPercentage}% complete`}
      >
        <div
          className="h-full bg-blue-600 transition-all duration-300 ease-in-out"
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>

      {/* Step labels (optional) */}
      {stepLabels && stepLabels.length > 0 && (
        <nav aria-label="Progress steps" className="mt-4">
          <ol className="flex justify-between">
            {stepLabels.map((label, index) => (
              <li
                key={index}
                className={cn(
                  'text-xs transition-colors duration-200',
                  index <= currentStep
                    ? 'text-blue-600 font-medium'
                    : 'text-gray-400'
                )}
                aria-current={index === currentStep ? 'step' : undefined}
              >
                <span className="sr-only">
                  {index < currentStep ? 'Completed: ' :
                   index === currentStep ? 'Current: ' :
                   'Upcoming: '}
                </span>
                {label}
              </li>
            ))}
          </ol>
        </nav>
      )}
    </div>
  );
}

QuestionnaireProgress.displayName = 'QuestionnaireProgress';
