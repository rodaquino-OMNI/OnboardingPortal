import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/utils";
const Checkbox = React.forwardRef(({ className, checked, onCheckedChange, ...props }, ref) => (_jsx("input", { ref: ref, type: "checkbox", checked: checked, onChange: (e) => onCheckedChange?.(e.target.checked), className: cn("h-4 w-4 rounded border border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2", className), ...props })));
Checkbox.displayName = "Checkbox";
export { Checkbox };
