import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/utils";
const Card = React.forwardRef(({ className, ...props }, ref) => (_jsx("div", { ref: ref, className: cn("rounded-lg border border-gray-200 bg-white shadow-sm", className), ...props })));
Card.displayName = "Card";
const CardHeader = React.forwardRef(({ className, ...props }, ref) => (_jsx("div", { ref: ref, className: cn("flex flex-col space-y-1.5 p-6", className), ...props })));
CardHeader.displayName = "CardHeader";
const CardTitle = React.forwardRef(({ className, ...props }, ref) => (_jsx("h3", { ref: ref, className: cn("text-2xl font-semibold leading-none tracking-tight", className), ...props })));
CardTitle.displayName = "CardTitle";
const CardDescription = React.forwardRef(({ className, ...props }, ref) => (_jsx("p", { ref: ref, className: cn("text-sm text-gray-600", className), ...props })));
CardDescription.displayName = "CardDescription";
const CardContent = React.forwardRef(({ className, ...props }, ref) => (_jsx("div", { ref: ref, className: cn("p-6 pt-0", className), ...props })));
CardContent.displayName = "CardContent";
const CardFooter = React.forwardRef(({ className, ...props }, ref) => (_jsx("div", { ref: ref, className: cn("flex items-center p-6 pt-0", className), ...props })));
CardFooter.displayName = "CardFooter";
// Progress variant of Card
const ProgressCard = React.forwardRef(({ className, progress = 0, children, ...props }, ref) => (_jsxs("div", { ref: ref, className: cn("relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm", className), ...props, children: [_jsx("div", { className: "absolute bottom-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300", style: { width: `${progress}%` } }), children] })));
ProgressCard.displayName = "ProgressCard";
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, ProgressCard };
