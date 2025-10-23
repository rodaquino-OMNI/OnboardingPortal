import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Input - Accessible text input component
 * ADR-003: Presentation-only input with ARIA support
 */
import React from 'react';
import { cn } from '../lib/utils';
export const Input = React.forwardRef(({ className, error, type = 'text', ...props }, ref) => {
    return (_jsx("input", { type: type, ref: ref, className: cn('w-full px-3 py-2 border rounded-md shadow-sm', 'focus:outline-none focus:ring-2 focus:ring-offset-2', 'disabled:bg-gray-100 disabled:cursor-not-allowed', error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:ring-blue-500', className), ...props }));
});
Input.displayName = 'Input';
