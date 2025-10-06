"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
const DialogContext = React.createContext(null);
const Dialog = ({ open, onOpenChange, children }) => {
    return (_jsx(DialogContext.Provider, { value: { open, onOpenChange }, children: children }));
};
const DialogTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
    const context = React.useContext(DialogContext);
    return (_jsx("button", { ref: ref, className: className, onClick: () => context?.onOpenChange(!context.open), ...props, children: children }));
});
DialogTrigger.displayName = "DialogTrigger";
const DialogPortal = ({ children }) => {
    if (typeof document === 'undefined')
        return null;
    return createPortal(children, document.body);
};
const DialogClose = React.forwardRef(({ className, children, ...props }, ref) => {
    const context = React.useContext(DialogContext);
    return (_jsx("button", { ref: ref, className: className, onClick: () => context?.onOpenChange(false), ...props, children: children }));
});
DialogClose.displayName = "DialogClose";
const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (_jsx("div", { ref: ref, className: cn("fixed inset-0 z-50 bg-black/80 backdrop-blur-sm", className), ...props })));
DialogOverlay.displayName = "DialogOverlay";
const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => {
    const context = React.useContext(DialogContext);
    if (!context?.open)
        return null;
    return (_jsxs(DialogPortal, { children: [_jsx(DialogOverlay, { onClick: () => context.onOpenChange(false) }), _jsxs("div", { ref: ref, className: cn("fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-gray-200 bg-white p-6 shadow-lg duration-200 rounded-lg", className), ...props, children: [children, _jsxs("button", { className: "absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 p-1", onClick: () => context.onOpenChange(false), children: [_jsx(X, { className: "h-4 w-4" }), _jsx("span", { className: "sr-only", children: "Close" })] })] })] }));
});
DialogContent.displayName = "DialogContent";
const DialogHeader = ({ className, ...props }) => (_jsx("div", { className: cn("flex flex-col space-y-1.5 text-center sm:text-left", className), ...props }));
DialogHeader.displayName = "DialogHeader";
const DialogFooter = ({ className, ...props }) => (_jsx("div", { className: cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2", className), ...props }));
DialogFooter.displayName = "DialogFooter";
const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (_jsx("h2", { ref: ref, className: cn("text-lg font-semibold leading-none tracking-tight text-gray-900", className), ...props })));
DialogTitle.displayName = "DialogTitle";
const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (_jsx("p", { ref: ref, className: cn("text-sm text-gray-600", className), ...props })));
DialogDescription.displayName = "DialogDescription";
export { Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, };
