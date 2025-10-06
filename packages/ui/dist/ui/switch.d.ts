import * as React from 'react';
interface SwitchProps {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
    id?: string;
    name?: string;
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
}
declare const Switch: React.ForwardRefExoticComponent<SwitchProps & React.RefAttributes<HTMLButtonElement>>;
export { Switch };
//# sourceMappingURL=switch.d.ts.map