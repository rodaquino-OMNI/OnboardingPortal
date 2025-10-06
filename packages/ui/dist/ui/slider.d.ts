import * as React from "react";
interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
    value: number[];
    onValueChange: (value: number[]) => void;
    min?: number;
    max?: number;
    step?: number;
}
declare const Slider: React.ForwardRefExoticComponent<SliderProps & React.RefAttributes<HTMLInputElement>>;
export { Slider };
//# sourceMappingURL=slider.d.ts.map