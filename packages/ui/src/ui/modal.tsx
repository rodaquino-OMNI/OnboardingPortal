import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface ModalProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

const Modal: React.FC<ModalProps> = ({ open, onOpenChange, children }) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 card-modern p-6 shadow-2xl duration-200 animate-bounce-in md:w-full">
        {children}
        <button
          onClick={() => onOpenChange?.(false)}
          className="absolute right-4 top-4 rounded-full p-1 opacity-70 ring-offset-white transition-all hover:opacity-100 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </div>
  )
}

const ModalTrigger: React.FC<{
  children: React.ReactNode
  onClick?: () => void
  asChild?: boolean
}> = ({ children, onClick, asChild }) => {
  if (asChild) {
    // When asChild is true, render the children directly with onClick
    return React.cloneElement(children as React.ReactElement, { onClick });
  }
  return <div onClick={onClick}>{children}</div>;
}

const ModalContent: React.FC<{
  className?: string
  children: React.ReactNode
}> = ({ className, children }) => (
  <div className={cn("space-y-4", className)}>
    {children}
  </div>
)

const ModalHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ 
  className, 
  ...props 
}) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)

const ModalFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ 
  className, 
  ...props 
}) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)

const ModalTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ 
  className, 
  ...props 
}) => (
  <h2
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-gray-900",
      className
    )}
    {...props}
  />
)

const ModalDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ 
  className, 
  ...props 
}) => (
  <p
    className={cn("text-sm text-gray-600", className)}
    {...props}
  />
)

export {
  Modal,
  ModalTrigger,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
}