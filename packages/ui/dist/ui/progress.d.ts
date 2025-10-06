import * as React from "react";
declare const Progress: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & {
    value?: number;
    max?: number;
    showLabel?: boolean;
} & React.RefAttributes<HTMLDivElement>>;
declare const CircularProgress: React.ForwardRefExoticComponent<Omit<React.SVGProps<SVGSVGElement> & {
    value?: number;
    max?: number;
    size?: number;
    strokeWidth?: number;
    showLabel?: boolean;
}, "ref"> & React.RefAttributes<SVGSVGElement>>;
export { Progress, CircularProgress };
//# sourceMappingURL=progress.d.ts.map