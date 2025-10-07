/**
 * Section Header Component
 * ADR-003 Compliance: Pure presentation component
 * WCAG 2.1 AA: Semantic heading hierarchy
 */

import React from 'react';
import { SectionHeaderProps } from './types';

export function SectionHeader({
  title,
  description,
  icon
}: SectionHeaderProps) {
  return (
    <header className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        {icon && (
          <div
            className="flex-shrink-0 text-blue-600"
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <h2 className="text-2xl font-bold text-gray-900">
          {title}
        </h2>
      </div>

      {description && (
        <p className="text-sm text-gray-600 leading-relaxed">
          {description}
        </p>
      )}
    </header>
  );
}

SectionHeader.displayName = 'SectionHeader';
