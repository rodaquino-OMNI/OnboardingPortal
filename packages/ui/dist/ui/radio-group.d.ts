import * as React from "react";
interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
    value?: string;
    onValueChange?: (value: string) => void;
}
interface RadioGroupItemProps extends React.InputHTMLAttributes<HTMLInputElement> {
    value: string;
}
declare const RadioGroup: React.ForwardRefExoticComponent<RadioGroupProps & React.RefAttributes<HTMLDivElement>>;
declare const RadioGroupItem: React.ForwardRefExoticComponent<RadioGroupItemProps & React.RefAttributes<HTMLInputElement>>;
export { RadioGroup, RadioGroupItem };
//# sourceMappingURL=radio-group.d.ts.map