import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/utils";
const Input = React.forwardRef(({ className, type, mask, onChange, icon: Icon, error, ...props }, ref) => {
    const formatValue = (value, maskType) => {
        if (!maskType || !value)
            return value;
        // Remove non-numeric characters
        const numbers = value.replace(/\D/g, "");
        switch (maskType) {
            case "cpf":
                // Format: 000.000.000-00
                return numbers
                    .replace(/(\d{3})(\d)/, "$1.$2")
                    .replace(/(\d{3})(\d)/, "$1.$2")
                    .replace(/(\d{3})(\d{1,2})/, "$1-$2")
                    .replace(/(-\d{2})\d+?$/, "$1");
            case "phone":
                // Format: (00) 00000-0000 or (00) 0000-0000
                if (numbers.length <= 10) {
                    return numbers
                        .replace(/(\d{2})(\d)/, "($1) $2")
                        .replace(/(\d{4})(\d)/, "$1-$2")
                        .replace(/(-\d{4})\d+?$/, "$1");
                }
                else {
                    return numbers
                        .replace(/(\d{2})(\d)/, "($1) $2")
                        .replace(/(\d{5})(\d)/, "$1-$2")
                        .replace(/(-\d{4})\d+?$/, "$1");
                }
            case "date":
                // Format: 00/00/0000
                return numbers
                    .replace(/(\d{2})(\d)/, "$1/$2")
                    .replace(/(\d{2})(\d)/, "$1/$2")
                    .replace(/(\d{4})\d+?$/, "$1");
            case "cep":
                // Format: 00000-000
                return numbers
                    .replace(/(\d{5})(\d)/, "$1-$2")
                    .replace(/(-\d{3})\d+?$/, "$1");
            default:
                return value;
        }
    };
    const handleChange = (e) => {
        if (mask) {
            e.target.value = formatValue(e.target.value, mask);
        }
        onChange?.(e);
    };
    return (_jsxs("div", { className: "relative", children: [Icon && (_jsx("div", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-gray-400", children: _jsx(Icon, { className: "h-5 w-5" }) })), _jsx("input", { type: type, className: cn("flex h-12 w-full rounded-lg border bg-white px-3 py-2 text-sm", "placeholder:text-gray-400", "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent", "disabled:cursor-not-allowed disabled:opacity-50", "transition-all duration-200", "hover:border-gray-400", Icon && "pl-10", error && "border-red-500 focus:ring-red-500", !error && "border-gray-200", className), ref: ref, onChange: handleChange, ...props }), error && (_jsx("p", { role: "alert", className: "mt-1 text-xs text-red-500", children: error }))] }));
});
Input.displayName = "Input";
export { Input };
