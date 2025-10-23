import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Textarea - Accessible multiline text input
 * ADR-003: Presentation-only textarea with ARIA support
 */
import React from 'react';
import { cn } from '../lib/utils';
export const Textarea = React.forwardRef(({ className, error, ...props }, ref) => {
    return (_jsx("textarea", { ref: ref, className: cn('w-full px-3 py-2 border rounded-md shadow-sm', 'focus:outline-none focus:ring-2 focus:ring-offset-2', 'disabled:bg-gray-100 disabled:cursor-not-allowed', 'resize-vertical', error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:ring-blue-500', className), ...props }));
});
Textarea.displayName = 'Textarea';
