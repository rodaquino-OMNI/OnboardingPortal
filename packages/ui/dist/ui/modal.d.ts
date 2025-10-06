import * as React from "react";
interface ModalProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
}
declare const Modal: React.FC<ModalProps>;
declare const ModalTrigger: React.FC<{
    children: React.ReactNode;
    onClick?: () => void;
    asChild?: boolean;
}>;
declare const ModalContent: React.FC<{
    className?: string;
    children: React.ReactNode;
}>;
declare const ModalHeader: React.FC<React.HTMLAttributes<HTMLDivElement>>;
declare const ModalFooter: React.FC<React.HTMLAttributes<HTMLDivElement>>;
declare const ModalTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>>;
declare const ModalDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>>;
export { Modal, ModalTrigger, ModalContent, ModalHeader, ModalFooter, ModalTitle, ModalDescription, };
//# sourceMappingURL=modal.d.ts.map