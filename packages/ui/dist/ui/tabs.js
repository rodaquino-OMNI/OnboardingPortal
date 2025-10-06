'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { cn } from '@/lib/utils';
const TabsContext = React.createContext(null);
export function Tabs({ value: controlledValue, defaultValue, onValueChange, children, className, }) {
    const [internalValue, setInternalValue] = React.useState(defaultValue || '');
    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : internalValue;
    const handleValueChange = (newValue) => {
        if (!isControlled) {
            setInternalValue(newValue);
        }
        onValueChange?.(newValue);
    };
    return (_jsx(TabsContext.Provider, { value: { value, onValueChange: handleValueChange }, children: _jsx("div", { className: cn('w-full', className), children: children }) }));
}
export function TabsList({ children, className }) {
    return (_jsx("div", { className: cn('inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground', className), role: "tablist", children: children }));
}
export function TabsTrigger({ value: triggerValue, children, className, disabled = false, }) {
    const context = React.useContext(TabsContext);
    if (!context) {
        throw new Error('TabsTrigger must be used within a Tabs component');
    }
    const { value, onValueChange } = context;
    const isSelected = value === triggerValue;
    return (_jsx("button", { type: "button", role: "tab", "aria-selected": isSelected, "aria-controls": `tabpanel-${triggerValue}`, disabled: disabled, onClick: () => onValueChange(triggerValue), className: cn('inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50', isSelected
            ? 'bg-background text-foreground shadow-sm'
            : 'hover:bg-muted/50 hover:text-foreground', className), children: children }));
}
export function TabsContent({ value: contentValue, children, className, }) {
    const context = React.useContext(TabsContext);
    if (!context) {
        throw new Error('TabsContent must be used within a Tabs component');
    }
    const { value } = context;
    const isSelected = value === contentValue;
    if (!isSelected) {
        return null;
    }
    return (_jsx("div", { id: `tabpanel-${contentValue}`, role: "tabpanel", "aria-labelledby": `tab-${contentValue}`, className: cn('mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', className), children: children }));
}
