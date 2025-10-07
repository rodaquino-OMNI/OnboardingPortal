/**
 * Error Summary Component
 * ADR-003 Compliance: Presentation-only error display
 * WCAG 2.1 AA: ARIA alert region with keyboard navigation
 */

import React, { useEffect, useRef } from 'react';
import { ErrorSummaryProps } from './types';

export function ErrorSummary({ errors, onErrorClick }: ErrorSummaryProps) {
  const errorEntries = Object.entries(errors);
  const summaryRef = useRef<HTMLDivElement>(null);

  // Focus error summary when errors appear (accessibility requirement)
  useEffect(() => {
    if (errorEntries.length > 0 && summaryRef.current) {
      summaryRef.current.focus();
    }
  }, [errorEntries.length]);

  if (errorEntries.length === 0) {
    return null;
  }

  const handleErrorClick = (fieldId: string) => {
    onErrorClick?.(fieldId);

    // Focus the field with error
    const element = document.getElementById(fieldId);
    if (element) {
      element.focus();
      // Scroll into view with smooth behavior
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div
      ref={summaryRef}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      tabIndex={-1}
      className="border-l-4 border-red-500 bg-red-50 p-4 mb-6 rounded-r focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
    >
      <div className="flex items-start">
        {/* Error icon */}
        <div className="flex-shrink-0" aria-hidden="true">
          <svg
            className="h-5 w-5 text-red-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        {/* Error content */}
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            There {errorEntries.length === 1 ? 'is' : 'are'}{' '}
            {errorEntries.length} error{errorEntries.length === 1 ? '' : 's'}{' '}
            with your submission
          </h3>

          {/* Error list */}
          <ul className="mt-2 text-sm text-red-700 space-y-1" role="list">
            {errorEntries.map(([fieldId, message]) => (
              <li key={fieldId}>
                <button
                  type="button"
                  className="underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded text-left"
                  onClick={() => handleErrorClick(fieldId)}
                  aria-label={`Error: ${message}. Click to go to field.`}
                >
                  {message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

ErrorSummary.displayName = 'ErrorSummary';
