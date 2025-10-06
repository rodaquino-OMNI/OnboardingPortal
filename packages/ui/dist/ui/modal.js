import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
const Modal = ({ open, onOpenChange, children }) => {
    if (!open)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in", children: _jsxs("div", { className: "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 card-modern p-6 shadow-2xl duration-200 animate-bounce-in md:w-full", children: [children, _jsxs("button", { onClick: () => onOpenChange?.(false), className: "absolute right-4 top-4 rounded-full p-1 opacity-70 ring-offset-white transition-all hover:opacity-100 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", children: [_jsx(X, { className: "h-4 w-4" }), _jsx("span", { className: "sr-only", children: "Close" })] })] }) }));
};
const ModalTrigger = ({ children, onClick, asChild }) => {
    if (asChild) {
        // When asChild is true, render the children directly with onClick
        return React.cloneElement(children, { onClick });
    }
    return _jsx("div", { onClick: onClick, children: children });
};
const ModalContent = ({ className, children }) => (_jsx("div", { className: cn("space-y-4", className), children: children }));
const ModalHeader = ({ className, ...props }) => (_jsx("div", { className: cn("flex flex-col space-y-1.5 text-center sm:text-left", className), ...props }));
const ModalFooter = ({ className, ...props }) => (_jsx("div", { className: cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className), ...props }));
const ModalTitle = ({ className, ...props }) => (_jsx("h2", { className: cn("text-lg font-semibold leading-none tracking-tight text-gray-900", className), ...props }));
const ModalDescription = ({ className, ...props }) => (_jsx("p", { className: cn("text-sm text-gray-600", className), ...props }));
export { Modal, ModalTrigger, ModalContent, ModalHeader, ModalFooter, ModalTitle, ModalDescription, };
