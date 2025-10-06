import * as React from "react";
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    error?: string | undefined;
}
declare const Textarea: React.ForwardRefExoticComponent<TextareaProps & React.RefAttributes<HTMLTextAreaElement>>;
export { Textarea };
//# sourceMappingURL=textarea.d.ts.map