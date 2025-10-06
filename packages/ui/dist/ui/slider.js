import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/utils";
const Slider = React.forwardRef(({ className, value, onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => (_jsx("input", { ref: ref, type: "range", min: min, max: max, step: step, value: value[0] || 0, onChange: (e) => onValueChange([parseFloat(e.target.value)]), className: cn("w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer", "slider-thumb:appearance-none slider-thumb:h-5 slider-thumb:w-5", "slider-thumb:rounded-full slider-thumb:bg-blue-600 slider-thumb:cursor-pointer", className), ...props })));
Slider.displayName = "Slider";
export { Slider };
