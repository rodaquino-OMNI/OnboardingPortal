import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";
const buttonVariants = cva("inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transform", {
    variants: {
        variant: {
            primary: "bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 focus:ring-blue-500 shadow-md hover:shadow-lg hover:-translate-y-0.5",
            secondary: "bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 focus:ring-purple-500 shadow-md hover:shadow-lg hover:-translate-y-0.5",
            achievement: "bg-gradient-to-r from-yellow-400 to-orange-500 text-white hover:from-yellow-500 hover:to-orange-600 shadow-lg transform transition-transform hover:scale-105",
            outline: "border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hover:border-gray-300 shadow-sm hover:shadow-md hover:-translate-y-0.5",
            ghost: "hover:bg-gray-100 hover:text-gray-900",
            destructive: "bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 focus:ring-red-500 shadow-md hover:shadow-lg hover:-translate-y-0.5",
        },
        size: {
            default: "h-10 py-2 px-4",
            sm: "h-9 px-3 rounded-md",
            lg: "h-11 px-8 rounded-md",
            icon: "h-10 w-10",
        },
    },
    defaultVariants: {
        variant: "primary",
        size: "default",
    },
});
const Button = React.forwardRef(({ className, variant, size, asChild = false, fullWidth = false, isLoading = false, children, ...props }, ref) => {
    const Comp = asChild ? React.Fragment : "button";
    return (_jsx(Comp, { className: cn(buttonVariants({ variant, size }), fullWidth && "w-full", className), disabled: isLoading || props.disabled, ref: ref, ...props, children: isLoading ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" }), children] })) : (children) }));
});
Button.displayName = "Button";
export { Button, buttonVariants };
