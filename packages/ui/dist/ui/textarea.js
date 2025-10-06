import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/utils";
const Textarea = React.forwardRef(({ className, error, ...props }, ref) => {
    return (_jsxs("div", { className: "relative", children: [_jsx("textarea", { className: cn("flex min-h-[120px] w-full rounded-lg border bg-white px-3 py-2 text-sm", "placeholder:text-gray-400", "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent", "disabled:cursor-not-allowed disabled:opacity-50", "transition-all duration-200", "resize-vertical", error && "border-red-500 focus:ring-red-500", !error && "border-gray-300", className), ref: ref, ...props }), error && (_jsx("p", { className: "mt-1 text-xs text-red-500", children: error }))] }));
});
Textarea.displayName = "Textarea";
export { Textarea };
