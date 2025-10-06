'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import { cn } from '@/lib/utils';
const Switch = React.forwardRef(({ className, checked = false, onCheckedChange, disabled = false, id, name, ...props }, ref) => {
    const handleClick = () => {
        if (!disabled && onCheckedChange) {
            onCheckedChange(!checked);
        }
    };
    const handleKeyDown = (event) => {
        if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            handleClick();
        }
    };
    return (_jsxs("button", { type: "button", role: "switch", "aria-checked": checked, "data-state": checked ? 'checked' : 'unchecked', disabled: disabled, onClick: handleClick, onKeyDown: handleKeyDown, className: cn('peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50', checked ? 'bg-primary' : 'bg-input', className), ref: ref, id: id, ...props, children: [_jsx("span", { "data-state": checked ? 'checked' : 'unchecked', className: cn('pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform', checked ? 'translate-x-5' : 'translate-x-0') }), name && _jsx("input", { type: "hidden", name: name, value: checked ? 'on' : 'off' })] }));
});
Switch.displayName = 'Switch';
export { Switch };
