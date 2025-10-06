'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { cn } from '@/lib/utils';
const Separator = React.forwardRef(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => {
    return (_jsx("div", { ref: ref, className: cn('shrink-0 bg-border', orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]', className), role: decorative ? 'none' : 'separator', "aria-orientation": orientation, ...props }));
});
Separator.displayName = 'Separator';
export { Separator };
