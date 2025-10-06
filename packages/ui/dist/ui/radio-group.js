import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/utils";
const RadioGroupContext = React.createContext({ name: '' });
const RadioGroup = React.forwardRef(({ className, value, onValueChange, ...props }, ref) => {
    const name = React.useId();
    return (_jsx(RadioGroupContext.Provider, { value: { value, onValueChange, name }, children: _jsx("div", { ref: ref, className: cn("grid gap-2", className), role: "radiogroup", ...props }) }));
});
RadioGroup.displayName = "RadioGroup";
const RadioGroupItem = React.forwardRef(({ className, value, ...props }, ref) => {
    const context = React.useContext(RadioGroupContext);
    return (_jsx("input", { ref: ref, type: "radio", name: context.name, value: value, checked: context.value === value, onChange: () => context.onValueChange?.(value), className: cn("h-4 w-4 rounded-full border border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2", className), ...props }));
});
RadioGroupItem.displayName = "RadioGroupItem";
export { RadioGroup, RadioGroupItem };
