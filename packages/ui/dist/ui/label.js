import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/utils";
const Label = React.forwardRef(({ className, required, children, ...props }, ref) => (_jsxs("label", { ref: ref, className: cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className), ...props, children: [children, required && (_jsx("span", { className: "text-red-500 ml-1", "aria-label": "required", children: "*" }))] })));
Label.displayName = "Label";
export { Label };
