import * as React from "react";
declare const Dialog: ({ open, onOpenChange, children }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}) => import("react/jsx-runtime").JSX.Element;
declare const DialogTrigger: React.ForwardRefExoticComponent<React.ButtonHTMLAttributes<HTMLButtonElement> & React.RefAttributes<HTMLButtonElement>>;
declare const DialogPortal: ({ children }: {
    children: React.ReactNode;
}) => React.ReactPortal | null;
declare const DialogClose: React.ForwardRefExoticComponent<React.ButtonHTMLAttributes<HTMLButtonElement> & React.RefAttributes<HTMLButtonElement>>;
declare const DialogOverlay: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>>;
declare const DialogContent: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>>;
declare const DialogHeader: {
    ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): import("react/jsx-runtime").JSX.Element;
    displayName: string;
};
declare const DialogFooter: {
    ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): import("react/jsx-runtime").JSX.Element;
    displayName: string;
};
declare const DialogTitle: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLHeadingElement> & React.RefAttributes<HTMLHeadingElement>>;
declare const DialogDescription: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLParagraphElement> & React.RefAttributes<HTMLParagraphElement>>;
export { Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, };
//# sourceMappingURL=dialog.d.ts.map