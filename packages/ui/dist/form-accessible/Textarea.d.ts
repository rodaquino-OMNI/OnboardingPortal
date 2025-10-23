/**
 * Textarea - Accessible multiline text input
 * ADR-003: Presentation-only textarea with ARIA support
 */
import React from 'react';
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    error?: boolean;
}
export declare const Textarea: React.ForwardRefExoticComponent<TextareaProps & React.RefAttributes<HTMLTextAreaElement>>;
export {};
//# sourceMappingURL=Textarea.d.ts.map