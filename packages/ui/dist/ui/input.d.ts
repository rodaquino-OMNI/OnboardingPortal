import * as React from "react";
import { LucideIcon } from "lucide-react";
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    mask?: "cpf" | "phone" | "date" | "cep";
    icon?: LucideIcon;
    error?: string | undefined;
}
declare const Input: React.ForwardRefExoticComponent<InputProps & React.RefAttributes<HTMLInputElement>>;
export { Input };
//# sourceMappingURL=input.d.ts.map