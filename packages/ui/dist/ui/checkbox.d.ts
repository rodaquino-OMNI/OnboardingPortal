import * as React from "react";
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'checked' | 'onCheckedChange'> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
}
declare const Checkbox: React.ForwardRefExoticComponent<CheckboxProps & React.RefAttributes<HTMLInputElement>>;
export { Checkbox };
//# sourceMappingURL=checkbox.d.ts.map